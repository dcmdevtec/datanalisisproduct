import { createServerClient, type CookieOptions } from "@supabase/ssr"
import type { cookies } from "next/headers"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase" // Assuming you have a types/supabase.ts for your DB types

export function createClient(cookieStore: ReturnType<typeof cookies>) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `cookies().set()` method can only be called from a Server Component or Route Handler.
            // This error `cookies().set()` is not supported in a Client Component.
            // is thrown if you're trying to call it from a Client Component.
            // This is expected if you're using a client-side Supabase client with Server Components.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options })
          } catch (error) {
            // The `cookies().set()` method can only be called from a Server Component or Route Handler.
            // This error `cookies().set()` is not supported in a Client Component.
            // is thrown if you're trying to call it from a Client Component.
            // This is expected if you're using a client-side Supabase client with Server Components.
          }
        },
      },
    },
  )
}

// For admin operations that bypass RLS (e.g., in API routes for creating users, managing data)
export function createAdminSupabaseClient() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use the service role key here
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
