import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/supabase"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// NOTE: @supabase/ssr@0.6.1 has a type-parameter mismatch with @supabase/supabase-js@2.101.1.
// SSR passes SupabaseClient<DB, SchemaName (string), Schema (object)> but supabase-js@2.101.1
// expects SupabaseClient<DB, SchemaNameOrClientOptions, SchemaName (string), Schema (object)>.
// This shifts all type params by one, causing Schema (4th param) to fall back to `never`.
// Fix: cast the result to SupabaseClient<Database> which resolves types correctly via
// the direct supabase-js createClient signature.
export async function createServerSupabase(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options as any)
            })
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  ) as unknown as SupabaseClient<Database>
}
// Client for server-side admin operations (e.g., managing auth.users)
// Requires SUPABASE_SERVICE_ROLE_KEY environment variable
export function createAdminSupabase() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}