import { NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import type { Database } from "@/types/supabase"
import { requireRole } from "@/lib/api-auth"

type SurveyorInsert = Database["public"]["Tables"]["surveyors"]["Insert"]

// SEGURIDAD (auditoría 2026-07-29): esta ruta no tenía NINGÚN check de
// sesión/rol. PUT en particular puede resetear la contraseña de cualquier
// encuestador (toma de control de cuenta) — quedaba abierto a cualquiera
// que conociera la URL. GET/lectura: admin + supervisor. Mutaciones
// (crear/editar/borrar encuestadores, incl. contraseña): solo admin.
//
// CORRECCIÓN (2026-08-12): el GET original usaba createClient(cookies())
// con la cookie leída sincrónicamente — en Next.js 15 cookies() es async,
// por lo que el cliente resultaba sin sesión y, con RLS activo, retornaba
// array vacío. Se migra a createAdminSupabase() en todas las operaciones
// (el rol ya fue verificado por requireRole antes de hacer cualquier query).

export async function GET(request: Request) {
  const auth = await requireRole(["admin", "supervisor"])
  if (!auth.ok) return auth.response

  // Admin client bypasses RLS — safe porque requireRole ya verificó rol.
  const admin = createAdminSupabase()

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (id) {
    const { data, error } = await admin.from("surveyors").select("*").eq("id", id).single()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  }

  const { data, error } = await admin.from("surveyors").select("*").order("created_at", { ascending: false })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const auth = await requireRole(["admin"])
  if (!auth.ok) return auth.response

  const supabaseAdmin = createAdminSupabase()
  const { name, email, phone_number, password, supervisor_id } = (await request.json()) as SurveyorInsert & {
    password?: string
    // Supervisor global de este encuestador (users.id, role="supervisor") —
    // organigrama por defecto (reunión 2026-08-27 "Jerarquías y roles").
    // Precarga la asignación en cascada de encuestas; se puede sobreescribir
    // por encuesta puntual desde "Asignación" (ver survey-hierarchy-assignment.tsx).
    supervisor_id?: string | null
  }

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

    const userId = authData.user?.id

    if (!userId) {
      throw new Error("Failed to get user ID after creation.")
    }

    // ORDEN CRÍTICO: public.users PRIMERO, luego surveyors.
    // surveyors.user_id → FK → public.users(id). Si insertamos surveyors
    // antes de que exista la fila en public.users, Postgres lanza:
    // "violates foreign key constraint surveyors_user_id_fkey".
    const { error: userInsertError } = await supabaseAdmin
      .from("users")
      .insert({ id: userId, email, name, role: "surveyor", status: "active", metadata: {} } as any)

    if (userInsertError) {
      // Si la fila ya existe (email reutilizado de registro previo) es OK — upsert implícito.
      // Cualquier otro error se registra pero no abortamos: el insert de surveyors puede
      // aún funcionar si la fila existía de antes.
      console.error("Advertencia: no se pudo crear la fila en public.users para el encuestador:", userInsertError.message)
      // Si NO es un error de unicidad, limpiar el usuario auth y abortar.
      if (!userInsertError.message.includes("duplicate") && !userInsertError.message.includes("unique") && userInsertError.code !== "23505") {
        await supabaseAdmin.auth.admin.deleteUser(userId)
        return NextResponse.json({ error: `No se pudo crear el perfil del encuestador: ${userInsertError.message}` }, { status: 500 })
      }
    }

    // Ahora sí: public.users existe → el FK de surveyors.user_id se satisface.
    // user_id (además de id) liga esta fila al login del portal de encuestador
    // — ver lib/portal-encuestador/auth.ts resolveCurrentSurveyor().
    const { data: surveyorData, error: surveyorError } = await supabaseAdmin
      .from("surveyors")
      .insert({
        id: userId,
        user_id: userId,
        name,
        email,
        phone_number,
        status: "active",
        supervisor_id: supervisor_id || null,
      } as any)
      .select()
      .single()

    if (surveyorError) {
      // Si falla el insert de surveyors, revertir auth user y la fila de users.
      await supabaseAdmin.from("users").delete().eq("id", userId)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      console.error("Supabase DB Error (Surveyor):", surveyorError.message)
      return NextResponse.json({ error: surveyorError.message }, { status: 500 })
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

  const supabaseAdmin = createAdminSupabase()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const { name, email, phone_number, password, supervisor_id } = await request.json()

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

    // Update surveyor in public.surveyors table
    const { data, error } = await supabaseAdmin
      .from("surveyors")
      .update({ name, email, phone_number, supervisor_id: supervisor_id ?? null })
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

  const supabaseAdmin = createAdminSupabase()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Surveyor ID is required." }, { status: 400 })
  }

  try {
    // Delete from public.surveyors table first
    const { error: dbError } = await supabaseAdmin.from("surveyors").delete().eq("id", id)

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    // Limpiar también su fila en public.users para no dejar perfiles huérfanos.
    const { error: userDeleteError } = await supabaseAdmin.from("users").delete().eq("id", id)
    if (userDeleteError) {
      console.warn("No se pudo eliminar la fila de public.users del encuestador:", userDeleteError.message)
    }

    // Then delete from Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    return NextResponse.json({ message: "Surveyor deleted successfully." }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "An unexpected error occurred." }, { status: 500 })
  }
}
