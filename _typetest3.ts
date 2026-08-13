import type { Database } from './types/supabase'
import { createServerClient } from '@supabase/ssr'

declare const url: string
declare const anyVal: any

const client = createServerClient<Database>(url, '', {
  cookies: { getAll() { return anyVal }, setAll(c: any) {} }
})

const result = client.from('surveys').insert({ title: 'test' })
const result2 = client.from('surveys').insert({ title: 'test', status: 'draft', settings: {} })
