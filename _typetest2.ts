import type { Database } from './types/supabase'
import { createServerClient } from '@supabase/ssr'

// Fake minimal call to get the return type
declare const url: string
declare const key: string
declare const cookieStore: any

const client = createServerClient<Database>(url, key, {
  cookies: {
    getAll() { return cookieStore.getAll() },
    setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options as any)
      })
    }
  }
})

// Test: from surveys should accept title
const q = client.from('surveys').insert({ title: 'test', status: 'draft' })
