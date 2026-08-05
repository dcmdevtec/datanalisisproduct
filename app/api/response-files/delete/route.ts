import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { requireRole } from "@/lib/api-auth"

// Elimina un archivo de respuesta del storage y lo quita del array de valores
// en la tabla answers. Solo admin/supervisor pueden borrar.
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireRole(["admin", "supervisor"])
    if (!auth.ok) return auth.response

    const { answerId, path } = await request.json()
    if (!answerId || !path || typeof path !== "string") {
      return NextResponse.json({ error: "answerId y path son requeridos" }, { status: 400 })
    }
    // Previene path traversal: solo rutas dentro del prefix esperado
    if (!path.startsWith("survey-responses/")) {
      return NextResponse.json({ error: "Path inválido" }, { status: 400 })
    }

    const admin = createAdminSupabase() as any

    // Lee el valor actual del answer
    const { data: answer, error: ansErr } = await admin
      .from("answers")
      .select("id, value, question_id")
      .eq("id", answerId)
      .maybeSingle()

    if (ansErr || !answer) {
      return NextResponse.json({ error: "Answer no encontrado" }, { status: 404 })
    }

    // Elimina el archivo del storage
    const { error: storageErr } = await admin.storage.from("response-media").remove([path])
    if (storageErr) {
      console.error("Error eliminando archivo del storage:", storageErr)
      // Continúa de todas formas para limpiar el answer — el archivo queda huérfano
      // pero mejor eso que dejar el reference en la BD
    }

    // Actualiza el valor del answer quitando el descriptor del archivo eliminado
    let newValue = answer.value
    if (Array.isArray(newValue)) {
      newValue = newValue.filter(
        (f: any) => !(f && typeof f === "object" && f.path === path)
      )
    } else if (typeof newValue === "string") {
      // Formato CSV del APK — si el path está en el string, pone valor vacío
      if (newValue.includes(path)) {
        newValue = []
      }
    }

    await admin.from("answers").update({ value: newValue }).eq("id", answerId)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("Error en /api/response-files/delete:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
