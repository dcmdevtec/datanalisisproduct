/**
 * Script: migrate_options_to_question_options.js
 * - Lee todas las filas de `questions` y migra su campo JSONB `options`
 *   hacia la tabla `question_options` (ya creada).
 * - Conservador: sólo inserta; no borra opciones antiguas.
 * - Requiere variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node migrate_options_to_question_options.js
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY in env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function run() {
  console.log('Fetching questions...')
  const { data: questions, error } = await supabase.from('questions').select('id, options')
  if (error) throw error

  for (const q of questions) {
    const opts = q.options || []
    if (!Array.isArray(opts) || opts.length === 0) continue

    let idx = 0
    for (const opt of opts) {
      idx += 1
      let value = null
      let label = null
      let image = null

      if (typeof opt === 'string') {
        value = opt
        label = opt
        // attempt to detect URL inside string
        const urlMatch = String(opt).match(/https?:\/\/[\w\-\.\/%#?=&]+\.(png|jpe?g|gif|webp|svg)(\?[^\s]+)?/i)
        if (urlMatch) image = urlMatch[0]
      } else if (typeof opt === 'object') {
        value = opt.value || null
        label = opt.label || opt.value || ''
        image = opt.image || opt.url || opt.src || null
      } else {
        label = String(opt)
      }

      // insert into question_options if not exists (by question_id + label + order)
      const { data: existing } = await supabase
        .from('question_options')
        .select('id')
        .eq('question_id', q.id)
        .eq('order_num', idx)
        .limit(1)

      if (existing && existing.length > 0) {
        console.log(`Skipping existing option for question ${q.id} order ${idx}`)
        continue
      }

      const insert = {
        question_id: q.id,
        value,
        label: label || value || `Opción ${idx}`,
        image_url: image,
        order_num: idx,
        metadata: opt
      }

      const { error: insErr } = await supabase.from('question_options').insert(insert)
      if (insErr) {
        console.error('Insert error', insErr)
      } else {
        console.log(`Inserted option for question ${q.id} order ${idx}`)
      }
    }
  }

  console.log('Done')
}

run().catch(err => {
  console.error('Fatal error', err)
  process.exit(1)
})
