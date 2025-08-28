import { NextResponse } from "next/server"

// Esta ruta simula la sincronización de datos offline
export async function POST(request: Request) {
  try {
    const syncData = await request.json()

    // En una aplicación real, aquí procesaríamos los datos
    // y los guardaríamos en la base de datos



    // Simular procesamiento
    await new Promise((resolve) => setTimeout(resolve, 1000))

    return NextResponse.json({
      success: true,
      message: `Se sincronizaron ${syncData.responses?.length || 0} respuestas correctamente`,
      syncedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error en sincronización:", error)
    return NextResponse.json({ error: "Error al procesar la sincronización", details: error }, { status: 500 })
  }
}
