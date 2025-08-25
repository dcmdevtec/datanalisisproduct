import { NextResponse } from "next/server"

// Simulación de base de datos de mensajes
const messages = [
  {
    id: "1",
    sender: "1",
    receiver: "3",
    content: "Hola Juan, ¿cómo va la encuesta en la Zona Norte?",
    timestamp: "2023-05-01T10:30:00Z",
    read: true,
  },
  {
    id: "2",
    sender: "3",
    receiver: "1",
    content: "Hola Admin, va bien. Ya completé 15 encuestas hoy.",
    timestamp: "2023-05-01T10:35:00Z",
    read: true,
  },
  {
    id: "3",
    sender: "1",
    receiver: "3",
    content: "Excelente. ¿Has tenido algún problema con la aplicación?",
    timestamp: "2023-05-01T10:40:00Z",
    read: true,
  },
  {
    id: "4",
    sender: "3",
    receiver: "1",
    content: "No, todo funciona correctamente. La sincronización offline es muy útil.",
    timestamp: "2023-05-01T10:45:00Z",
    read: false,
  },
  {
    id: "5",
    sender: "2",
    receiver: "4",
    content: "María, necesito que te dirijas a la Zona Sur esta tarde.",
    timestamp: "2023-05-01T09:20:00Z",
    read: true,
  },
  {
    id: "6",
    sender: "4",
    receiver: "2",
    content: "Entendido. Estaré allí después del almuerzo.",
    timestamp: "2023-05-01T09:25:00Z",
    read: true,
  },
  {
    id: "7",
    sender: "1",
    receiver: "all",
    content: "Recordatorio: La reunión semanal será mañana a las 9:00 AM.",
    timestamp: "2023-05-01T11:00:00Z",
    read: false,
  },
]

export async function GET(request: Request) {
  const url = new URL(request.url)
  const userId = url.searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ error: "Se requiere userId" }, { status: 400 })
  }

  // Filtrar mensajes para el usuario específico o mensajes para todos
  const userMessages = messages.filter(
    (msg) => msg.receiver === userId || msg.sender === userId || msg.receiver === "all",
  )

  return NextResponse.json(userMessages)
}

export async function POST(request: Request) {
  try {
    const messageData = await request.json()

    // En una aplicación real, validarías los datos y los guardarías en la base de datos
    const newMessage = {
      id: `${messages.length + 1}`,
      ...messageData,
      timestamp: new Date().toISOString(),
      read: false,
    }

    // Simulamos agregar a la base de datos
    messages.push(newMessage)

    return NextResponse.json(newMessage)
  } catch (error) {
    console.error("Error al enviar mensaje:", error)
    return NextResponse.json({ error: "Error al enviar el mensaje" }, { status: 500 })
  }
}
