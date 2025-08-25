
// Este archivo solo debe exportar helpers de servidor y utilidades, no un cliente duplicado.

// Usa lib/supabase-server para clientes de servidor.
export { createServerSupabase } from "@/lib/supabase-server"

// Puedes mover helpers utilitarios aquí, pero usa el cliente correcto según el entorno.

// Función para verificar y obtener políticas RLS
export const checkRLSPolicies = async () => {
  try {
    const serviceClient = getServiceSupabase()
    const { data, error } = await serviceClient.rpc("get_table_policies")

    if (error) throw error

    return { success: true, data }
  } catch (error) {
    console.error("Error al obtener políticas RLS:", error)
    return { success: false, message: `Error al obtener políticas: ${error.message}` }
  }
}

// Función para verificar permisos de usuario
export const checkUserPermissions = async () => {
  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) throw sessionError
    if (!session) return { success: false, message: "No hay sesión activa" }

    // Verificar si el usuario puede leer encuestas
    const { data: surveyData, error: surveyError } = await supabase.from("surveys").select("id").limit(1)

    // Verificar si el usuario puede crear encuestas
    const testId = `test-${Date.now()}`
    const { data: insertData, error: insertError } = await supabase
      .from("surveys")
      .insert({
        id: testId,
        title: "Test Survey",
        description: "Testing permissions",
        created_by: session.user.id,
        status: "draft",
      })
      .select()

    // Limpiar datos de prueba
    if (!insertError) {
      await supabase.from("surveys").delete().eq("id", testId)
    }

    return {
      success: true,
      permissions: {
        read: !surveyError,
        create: !insertError,
        readError: surveyError?.message,
        createError: insertError?.message,
      },
    }
  } catch (error) {
    console.error("Error al verificar permisos:", error)
    return { success: false, message: `Error al verificar permisos: ${error.message}` }
  }
}

// Función para aplicar políticas RLS
export const applyRLSPolicies = async () => {
  try {
    const serviceClient = getServiceSupabase()

    // Aplicar políticas para la tabla surveys
    await serviceClient.rpc("apply_surveys_policies")

    return { success: true, message: "Políticas RLS aplicadas correctamente" }
  } catch (error) {
    console.error("Error al aplicar políticas RLS:", error)
    return { success: false, message: `Error al aplicar políticas: ${error.message}` }
  }
}
