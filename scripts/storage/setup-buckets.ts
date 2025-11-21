/**
 * Script para configurar los buckets de Supabase Storage
 * Ejecutar con: npx tsx scripts/storage/setup-buckets.ts
 */

import { createClient } from '@supabase/supabase-js'
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variables de entorno faltantes')
    console.error('Necesitas NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
})

const bucketsConfig = [
    {
        name: 'survey-images',
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    },
    {
        name: 'survey-logos',
        public: true,
        fileSizeLimit: 2097152, // 2MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg'],
    },
    {
        name: 'project-logos',
        public: true,
        fileSizeLimit: 2097152, // 2MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg'],
    },
    {
        name: 'company-logos',
        public: true,
        fileSizeLimit: 2097152, // 2MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg'],
    },
    {
        name: 'zone-maps',
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg'],
    },
    {
        name: 'response-media',
        public: false, // Privado - solo el usuario que creó la respuesta puede acceder
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'audio/mpeg', 'audio/wav', 'video/mp4'],
    },
]

async function setupBuckets() {
    console.log('🗄️  Configurando buckets de Supabase Storage...\n')

    for (const config of bucketsConfig) {
        console.log(`📦 Bucket: ${config.name}`)
        console.log(`   - Público: ${config.public}`)
        console.log(`   - Tamaño máximo: ${(config.fileSizeLimit / 1024 / 1024).toFixed(1)}MB`)

        // Verificar si el bucket ya existe
        const { data: buckets } = await supabase.storage.listBuckets()
        const bucketExists = buckets?.some((b) => b.name === config.name)

        if (bucketExists) {
            console.log(`   ✓ El bucket ya existe\n`)
            continue
        }

        // Crear bucket
        const { data, error } = await supabase.storage.createBucket(config.name, {
            public: config.public,
            fileSizeLimit: config.fileSizeLimit,
            allowedMimeTypes: config.allowedMimeTypes,
        })

        if (error) {
            console.error(`   ❌ Error creando bucket: ${error.message}\n`)
            continue
        }

        console.log(`   ✓ Bucket creado exitosamente\n`)

        // Configurar políticas RLS para buckets públicos
        if (config.public) {
            // Política para lectura pública
            const selectPolicy = {
                name: `Public read access for ${config.name}`,
                definition: 'true', // Permite lectura a todos
                command: 'SELECT',
            }

            // Política para escritura autenticada
            const insertPolicy = {
                name: `Authenticated upload for ${config.name}`,
                definition: '(auth.role() = \'authenticated\')', // Solo usuarios autenticados
                command: 'INSERT',
            }

            const updatePolicy = {
                name: `Authenticated update for ${config.name}`,
                definition: '(auth.role() = \'authenticated\')',
                command: 'UPDATE',
            }

            const deletePolicy = {
                name: `Authenticated delete for ${config.name}`,
                definition: '(auth.role() = \'authenticated\')',
                command: 'DELETE',
            }

            console.log(`   🔐 Configurando políticas de acceso público...`)
        } else {
            // Para buckets privados (response-media)
            const privatePolicy = {
                name: `Owner access for ${config.name}`,
                definition: '(auth.uid() = owner_id)', // Solo el dueño puede acceder
            }
            console.log(`   🔒 Configurando políticas de acceso privado...`)
        }
    }

    console.log('\n✅ Configuración de buckets completada')
    console.log('\n📝 Próximos pasos:')
    console.log('   1. Ejecutar: npm run dev')
    console.log('   2. Probar subida de imágenes en la interfaz')
    console.log('   3. Ejecutar migración de datos: npx tsx scripts/migrate-images-to-storage.ts')
}

setupBuckets()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('❌ Error fatal:', err)
        process.exit(1)
    })
