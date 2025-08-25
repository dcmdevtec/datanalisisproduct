import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase-browser"

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    // Iniciar sesión con Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    if (!data.session || !data.user) {
      return NextResponse.json({ error: "Error al iniciar sesión" }, { status: 401 })
    }

    // Obtener datos del usuario
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", data.user.id)
      .single()

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }

    return NextResponse.json({
      user: userData,
      token: data.session.access_token,
    })
  } catch (error) {
    console.error("Error en autenticación:", error)
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 })
  }
}
