import { NextResponse } from "next/server"
import { createClient, createAdminClient } from "@/lib/supabase/server" // Import both clients
import { cookies } from "next/headers"
import type { Database } from "@/types/supabase"
import { requireRole } from "@/lib/api-auth"

type SurveyorInsert = Database["public"]["Tables"]["surveyors"]["Insert"]

// SEGURIDAD (auditoría 2026-07-29): esta ruta no tenía NINGÚN check de
// sesión/rol. PUT en particular puede resetear la contraseña de cualquier
// encuestador (toma de control de cuenta) — quedaba abierto a cualquiera
// que conociera la URL. GET/lectura: admin + supervisor. Mutaciones
// (crear/editar/borrar encuestadores, incl. contraseña): solo admin.
export async function GET(request: Request) {
  const auth = await requireRole(["admin", "supervisor"])
  if (!auth.ok) return auth.response

  const cookieStore = cookies()
  const supabase = createClient(cookieStore) // Use regular client for GET

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (id) {
    const { data, error } = await supabase.from("surveyors").select("*").eq("id", id).single()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  }

  const { data, error } = await supabase.from("surveyors").select("*").order("created_at", { ascending: false })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const auth = await requireRole(["admin"])
  if (!auth.ok) return auth.response

  const supabaseAdmin = createAdminClient() // Use admin client for POST
  const { name, email, phone_number, password } = (await request.json()) as SurveyorInsert & { password?: string }

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email, and password are required." }, { status: 400 })
  }

  try {
    // Create user in Supabase Auth using admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Automatically confirm email
    })

    if (authError) {
      console.error("Supabase Auth Error:", authError.message)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user?.id // This is the ID from Supabase Auth

    if (!userId) {
      throw new Error("Failed to get user ID after creation.")
    }

    // Insert surveyor into public.surveyors table using admin client
    // This overrides the gen_random_uuid() default, which is a common pattern for user profiles.
    // user_id (además de id) liga esta fila al login del portal de encuestador
    // — ver lib/portal-encuestador/auth.ts resolveCurrentSurveyor().
    const { data: surveyorData, error: surveyorError } = await supabaseAdmin
      .from("surveyors")
      .insert({
        id: userId, // Link surveyor to auth user ID
        user_id: userId,
        name,
        email,
        phone_number,
        status: "active", // Default status
      } as any)
      .select()
      .single()

    if (surveyorError) {
      // If surveyor insertion fails, delete the auth user to prevent orphaned users
      await supabaseAdmin.auth.admin.deleteUser(userId)
      console.error("Supabase DB Error (Surveyor):", surveyorError.message)
      return NextResponse.json({ error: surveyorError.message }, { status: 500 })
    }

    // CORRECCIÓN CRÍTICA (bug reportado en producción): este endpoint nunca
    // creaba la fila correspondiente en `public.users`, que es la tabla que
    // login/page.tsx, middleware.ts y DashboardLayout consultan para decidir
    // a dónde redirigir y qué mostrar. Sin esta fila, `role` queda
    // indefinido y TODA la lógica de "si no es surveyor, mándalo al
    // dashboard admin" trataba a los encuestadores creados aquí como si
    // fueran administradores — exactamente el síntoma reportado ("le sale
    // todo lo de super admin"). Mismo patrón que POST /api/users.
    const { error: userInsertError } = await supabaseAdmin
      .from("users")
      .insert({ id: userId, email, name, role: "surveyor", status: "active", metadata: {} } as any)

    if (userInsertError) {
      // Si la fila de users ya existe (ej. el email se reutilizó desde un
      // registro previo), no es fatal — pero si falla por otra razón, se
      // registra para diagnóstico. No se revierte la creación del
      // encuestador por esto: preferimos un encuestador sin rol correcto
      // (visible y corregible desde /users) a perder el registro completo.
      console.error("Advertencia: no se pudo crear la fila en public.users para el encuestador:", userInsertError.message)
    }

    return NextResponse.json(surveyorData, { status: 201 })
  } catch (error: any) {
    console.error("Unexpected error:", error.message)
    return NextResponse.json({ error: error.message || "An unexpected error occurred." }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const auth = await requireRole(["admin"])
  if (!auth.ok) return auth.response

  const supabaseAdmin = createAdminClient() // Use admin client for PUT
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id") // This is the surveyor's ID (which is also the auth user ID)
  const { name, email, phone_number, password } = await request.json()

  if (!id) {
    return NextResponse.json({ error: "Surveyor ID is required." }, { status: 400 })
  }

  try {
    // Update user in Supabase Auth if email or password is provided
    if (email || password) {
      const updatePayload: { email?: string; password?: string } = {}
      if (email) updatePayload.email = email
      if (password) updatePayload.password = password

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, updatePayload)
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 })
      }
    }

    // Update surveyor in public.surveyors table using admin client
    const { data, error } = await supabaseAdmin
      .from("surveyors")
      .update({ name, email, phone_number })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "An unexpected error occurred." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const auth = await requireRole(["admin"])
  if (!auth.ok) return auth.response

  const supabaseAdmin = createAdminClient() // Use admin client for DELETE
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id") // This is the surveyor's ID (which is also the auth user ID)

  if (!id) {
    return NextResponse.json({ error: "Surveyor ID is required." }, { status: 400 })
  }

  try {
    // Delete from public.surveyors table first using admin client
    const { error: dbError } = await supabaseAdmin.from("surveyors").delete().eq("id", id)

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    // Limpiar también su fila en public.users (creada desde esta misma ruta
    // al dar de alta al encuestador) para no dejar perfiles huérfanos.
    const { error: userDeleteError } = await supabaseAdmin.from("users").delete().eq("id", id)
    if (userDeleteError) {
      console.warn("No se pudo eliminar la fila de public.users del encuestador:", userDeleteError.message)
    }

    // Then delete from Supabase Auth using admin client
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    return NextResponse.json({ message: "Surveyor deleted successfully." }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "An unexpected error occurred." }, { status: 500 })
  }
}
