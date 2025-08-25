export interface User {
  id: string
  email: string
  name: string
  role: "admin" | "supervisor" | "surveyor" | "client"
  status: "active" | "inactive"
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}
