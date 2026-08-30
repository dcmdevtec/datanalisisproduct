export interface User {
  id: string
  email: string
  name: string
  role: "admin" | "supervisor" | "coordinator" | "surveyor" | "client"
  status: "active" | "inactive"
  metadata?: Record<string, any>
  // Coordinador global asignado (solo aplica a role="supervisor"). Ver
  // reunión 2026-08-27 ("Jerarquías y roles") — users.coordinator_id.
  coordinator_id?: string | null
  created_at: string
  updated_at: string
}
