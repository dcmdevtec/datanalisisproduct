#!/usr/bin/env tsx

/**
 * Script para verificar y configurar los buckets de Supabase Storage
 * 
 * Uso: 
 * npm run check-storage
 * 
 * o directamente:
 * npx tsx scripts/check-storage.ts
 */

import { checkBuckets, initializeBuckets } from '../lib/supabase-storage'

async function main() {
    console.log('🔍 Verificando buckets de Supabase Storage...\n')
    
    const { missing, existing } = await checkBuckets()
    
    console.log('✅ Buckets existentes:')
    existing.forEach(bucket => console.log(`   - ${bucket}`))
    
    if (missing.length > 0) {
        console.log('\n❌ Buckets faltantes:')
        missing.forEach(bucket => console.log(`   - ${bucket}`))
        
        console.log('\n🔧 Intentando crear buckets faltantes...')
        await initializeBuckets()
        
        console.log('\n📋 Instrucciones manuales:')
        console.log('Si la creación automática falló, cree manualmente los siguientes buckets en su dashboard de Supabase:')
        missing.forEach(bucket => {
            console.log(`   - ${bucket} (público: ${bucket !== 'response-media'})`)
        })
        
        console.log('\nConfiguración recomendada para cada bucket:')
        console.log('- Permitir tipos MIME: image/jpeg, image/png, image/gif, image/webp')
        console.log('- Límite de tamaño: 10MB')
        console.log('- Público: Sí (excepto response-media)')
    } else {
        console.log('\n✅ ¡Todos los buckets necesarios están configurados!')
    }
    
    console.log('\n🔗 Dashboard de Supabase Storage:')
    console.log('https://app.supabase.com/project/YOUR_PROJECT_ID/storage/buckets')
}

main().catch(error => {
    console.error('❌ Error:', error)
    process.exit(1)
})