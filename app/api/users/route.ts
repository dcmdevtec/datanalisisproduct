import { NextResponse } from "next/server"

// Simulación de base de datos de usuarios
const users = [
  {
    id: "22134135-7d93-459a-8f82-6bebcb8ecb8e",
    email: "ruben@dcmsystem.co",
    name: "Admin",
    role: "admin",
    status: "active",
    lastActive: "2023-05-01T10:30:00Z",
  },
  {
    id: "2",
    email: "supervisor@example.com",
    name: "Supervisor User",
    role: "supervisor",
    status: "active",
    lastActive: "2023-05-01T09:15:00Z",
  },
  {
    id: "3",
    email: "surveyor1@example.com",
    name: "Juan Díaz",
    role: "surveyor",
    status: "active",
    lastActive: "2023-05-01T11:45:00Z",
  },
  {
    id: "4",
    email: "surveyor2@example.com",
    name: "María López",
    role: "surveyor",
    status: "active",
    lastActive: "2023-05-01T08:20:00Z",
  },
  {
    id: "5",
    email: "surveyor3@example.com",
    name: "Carlos Rodríguez",
    role: "surveyor",
    status: "inactive",
    lastActive: "2023-04-28T14:10:00Z",
  },
  {
    id: "6",
    email: "client1@example.com",
    name: "Empresa ABC",
    role: "client",
    status: "active",
    lastActive: "2023-04-30T16:05:00Z",
  },
  {
    id: "7",
    email: "client2@example.com",
    name: "Corporación XYZ",
    role: "client",
    status: "active",
    lastActive: "2023-04-29T13:40:00Z",
  },
]

export async function GET(request: Request) {
  // En una aplicación real, verificarías el token JWT aquí
  return NextResponse.json(users)
}

export async function POST(request: Request) {
  try {
    const userData = await request.json()

    // En una aplicación real, validarías los datos y los guardarías en la base de datos
    const newUser = {
      id: crypto.randomUUID(), // ✅ UUID real en lugar de contador numérico
      ...userData,
      status: "active",
      lastActive: new Date().toISOString(),
    }

    // Simulamos agregar a la base de datos
    users.push(newUser)

    return NextResponse.json(newUser)
  } catch (error) {
    console.error("Error al crear usuario:", error)
    return NextResponse.json({ error: "Error al crear el usuario" }, { status: 500 })
  }
}
