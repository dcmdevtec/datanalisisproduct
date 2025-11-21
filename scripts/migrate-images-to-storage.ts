/**
 * Script para migrar imágenes base64 existentes a Supabase Storage
 * Ejecutar con: npx tsx scripts/migrate-images-to-storage.ts
 */

import { createClient } from '@supabase/supabase-js'
require('dotenv').config({ path: '.env.local' })
import { decode } from 'base64-arraybuffer'

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

// Helper para detectar si es base64
function isBase64(str: string): boolean {
    return str && (str.startsWith('data:image/') || str.length > 1000) // Heurística simple
}

// Helper para obtener extensión
function getExtension(base64Header: string): string {
    if (base64Header.includes('image/jpeg') || base64Header.includes('image/jpg')) return 'jpg'
    if (base64Header.includes('image/png')) return 'png'
    if (base64Header.includes('image/gif')) return 'gif'
    if (base64Header.includes('image/webp')) return 'webp'
    return 'bin'
}

async function uploadBase64ToStorage(bucket: string, path: string, base64Str: string) {
    try {
        // Extraer data y tipo
        let contentType = 'image/png'
        let base64Data = base64Str

        if (base64Str.includes(',')) {
            const parts = base64Str.split(',')
            const header = parts[0]
            base64Data = parts[1]

            const mimeMatch = header.match(/:(.*?);/)
            if (mimeMatch) {
                contentType = mimeMatch[1]
            }
        }

        const fileData = decode(base64Data)

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(path, fileData, {
                contentType,
                upsert: true
            })

        if (error) throw error

        const { data: publicUrlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(path)

        return publicUrlData.publicUrl
    } catch (error) {
        console.error(`Error subiendo a ${bucket}/${path}:`, error)
        return null
    }
}

async function migrateCompanies() {
    console.log('\n🏢 Migrando Companies...')
    const { data: companies, error } = await supabase
        .from('companies')
        .select('id, logo')
        .not('logo', 'is', null)

    if (error) {
        console.error('Error fetching companies:', error)
        return
    }

    let count = 0
    for (const company of companies) {
        if (!company.logo || !isBase64(company.logo)) continue

        const ext = getExtension(company.logo.substring(0, 50))
        const path = `${company.id}.${ext}`

        console.log(`   Migrando company ${company.id}...`)
        const publicUrl = await uploadBase64ToStorage('company-logos', path, company.logo)

        if (publicUrl) {
            await supabase
                .from('companies')
                .update({ logo: publicUrl })
                .eq('id', company.id)
            count++
        }
    }
    console.log(`✅ ${count} companies migradas.`)
}

async function migrateProjects() {
    console.log('\n📁 Migrando Projects...')
    const { data: projects, error } = await supabase
        .from('projects')
        .select('id, logo')
        .not('logo', 'is', null)

    if (error) {
        console.error('Error fetching projects:', error)
        return
    }

    let count = 0
    for (const project of projects) {
        if (!project.logo || !isBase64(project.logo)) continue

        const ext = getExtension(project.logo.substring(0, 50))
        const path = `${project.id}.${ext}`

        console.log(`   Migrando project ${project.id}...`)
        const publicUrl = await uploadBase64ToStorage('project-logos', path, project.logo)

        if (publicUrl) {
            await supabase
                .from('projects')
                .update({ logo: publicUrl })
                .eq('id', project.id)
            count++
        }
    }
    console.log(`✅ ${count} projects migrados.`)
}

async function migrateSurveys() {
    console.log('\n📋 Migrando Surveys...')
    const { data: surveys, error } = await supabase
        .from('surveys')
        .select('id, logo')
        .not('logo', 'is', null)

    if (error) {
        console.error('Error fetching surveys:', error)
        return
    }

    let count = 0
    for (const survey of surveys) {
        if (!survey.logo || !isBase64(survey.logo)) continue

        const ext = getExtension(survey.logo.substring(0, 50))
        const path = `${survey.id}.${ext}`

        console.log(`   Migrando survey ${survey.id}...`)
        const publicUrl = await uploadBase64ToStorage('survey-logos', path, survey.logo)

        if (publicUrl) {
            await supabase
                .from('surveys')
                .update({ logo: publicUrl })
                .eq('id', survey.id)
            count++
        }
    }
    console.log(`✅ ${count} surveys migrados.`)
}

async function migrateZones() {
    console.log('\n🗺️ Migrando Zones...')
    const { data: zones, error } = await supabase
        .from('zones')
        .select('id, map_snapshot')
        .not('map_snapshot', 'is', null)

    if (error) {
        console.error('Error fetching zones:', error)
        return
    }

    let count = 0
    for (const zone of zones) {
        if (!zone.map_snapshot || !isBase64(zone.map_snapshot)) continue

        const ext = 'jpg' // Snapshots suelen ser jpg
        const path = `${zone.id}.${ext}`

        console.log(`   Migrando zone ${zone.id}...`)
        const publicUrl = await uploadBase64ToStorage('zone-maps', path, zone.map_snapshot)

        if (publicUrl) {
            await supabase
                .from('zones')
                .update({ map_snapshot: publicUrl })
                .eq('id', zone.id)
            count++
        }
    }
    console.log(`✅ ${count} zones migradas.`)
}

async function migrateQuestionOptions() {
    console.log('\n❓ Migrando Question Options...')
    // Esta es más compleja porque está dentro de un JSONB o array de objetos
    // Dependiendo de cómo se guarde, puede requerir iterar todas las preguntas

    // Opción 1: Si tienes una columna específica image_base64 (legacy)
    /*
    const { data: options, error } = await supabase
      .from('question_options')
      .select('id, question_id, image_base64')
      .not('image_base64', 'is', null)
    
    // ... lógica similar ...
    */

    // Opción 2: Iterar preguntas y buscar imágenes en options (JSONB)
    const { data: questions, error } = await supabase
        .from('questions')
        .select('id, options')
        .not('options', 'is', null)

    if (error) {
        console.error('Error fetching questions:', error)
        return
    }

    let count = 0
    for (const question of questions) {
        let updated = false
        let newOptions = [...(question.options || [])]

        // Iterar opciones
        for (let i = 0; i < newOptions.length; i++) {
            const opt = newOptions[i]
            if (typeof opt === 'object' && opt.image && isBase64(opt.image)) {
                const ext = getExtension(opt.image.substring(0, 50))
                const path = `${question.id}/${i}_${Date.now()}.${ext}`

                console.log(`   Migrando opción ${i} de pregunta ${question.id}...`)
                const publicUrl = await uploadBase64ToStorage('survey-images', path, opt.image)

                if (publicUrl) {
                    newOptions[i] = { ...opt, image: publicUrl }
                    updated = true
                    count++
                }
            }
        }

        if (updated) {
            await supabase
                .from('questions')
                .update({ options: newOptions })
                .eq('id', question.id)
        }
    }
    console.log(`✅ ${count} opciones de preguntas migradas.`)
}

async function main() {
    console.log('🚀 Iniciando migración de imágenes a Storage...')

    await migrateCompanies()
    await migrateProjects()
    await migrateSurveys()
    await migrateZones()
    await migrateQuestionOptions()

    console.log('\n✨ Migración completada!')
}

main()
    .catch(console.error)
    .finally(() => process.exit())
