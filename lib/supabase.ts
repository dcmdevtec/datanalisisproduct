
// Este archivo solo debe exportar helpers de servidor y utilidades, no un cliente duplicado.

// Usa lib/supabase-server para clientes de servidor.
export { createServerSupabase } from "@/lib/supabase-server"

// Nota: Las funciones checkRLSPolicies, checkUserPermissions, y applyRLSPolicies
// requieren acceso al servidor y no deben ser importadas en componentes cliente.
// Si necesitas estas funciones en el cliente, crea versiones específicas del cliente
// o mueve la lógica a API routes.
