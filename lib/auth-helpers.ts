// lib/auth-helpers.ts
import { supabase } from "@/lib/supabase-browser"

export async function getSessionWithRole() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError || !session) {
    console.error("Error al obtener sesión:", sessionError)
    return { session: null, role: null }
  }

  const userId:any = session.user.id

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single()

  if (userError || !userData) {
    console.error("Error al obtener rol del usuario:", userError)
    return { session, role: null }
  }

  return { session, role: userData.role }
}
