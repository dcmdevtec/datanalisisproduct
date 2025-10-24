/**
 * Script: download_images_to_base64.js
 * - Busca filas en `question_options` con image_url y sin image_base64
 * - Descarga la imagen, la codifica en Base64 y actualiza la fila
 * - Requiere variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * - Usa node-fetch para descargar imágenes
 *
 * Usage:
 *   npm install node-fetch@2
 *   node download_images_to_base64.js
 */

const fetch = require('node-fetch')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY in env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function toBase64(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const buffer = await res.buffer()
  return buffer.toString('base64')
}

async function run() {
  console.log('Querying question_options with image_url and missing image_base64...')
  const { data: rows, error } = await supabase
    .from('question_options')
    .select('id, image_url')
    .not('image_url', 'is', null)
    .is('image_base64', null)

  if (error) throw error

  if (!rows || rows.length === 0) {
    console.log('No rows found (note: the current query returns rows where image_url IS NULL; adjust if needed).')
    return
  }

  for (const r of rows) {
    const url = r.image_url
    if (!url) continue
    try {
      console.log('Downloading', url)
      const b64 = await toBase64(url)
      const { error: upErr } = await supabase.from('question_options').update({ image_base64: b64 }).eq('id', r.id)
      if (upErr) console.error('Update error for', r.id, upErr)
      else console.log('Updated', r.id)
    } catch (err) {
      console.error('Failed to process', url, err.message)
    }
  }
}

run().catch(err => {
  console.error('Fatal', err)
  process.exit(1)
})
