"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import supabase from "@/lib/supabase/client"
import { getEffectivePermissions, hasPermission, type ActionKey, type ModuleKey, type PermissionGrid } from "@/lib/permissions"

// Trae el rol + override de permisos del usuario logueado y devuelve sus
// permisos EFECTIVOS (default de rol + override), para que las páginas
// puedan ocultar/deshabilitar botones que el usuario no puede usar — mismo
// dato que ya aplican las rutas /api/** vía requirePermission(), acá solo
// para UX (la fuente de verdad sigue siendo el servidor/RLS).
//
// select("*") a propósito, no select("role, permissions"): si la migración
// de sql/2026_08_30_user_permissions.sql todavía no corrió en este
// ambiente, pedir la columna `permissions` por nombre haría fallar la
// query entera. Con "*" simplemente no viene el campo y se cae al default
// del rol — cero riesgo de romper esta página por eso.
export function useMyPermissions() {
  const { user } = useAuth()
  const [role, setRole] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<PermissionGrid>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setRole(null)
      setPermissions({})
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        const r = (data as any)?.role ?? null
        setRole(r)
        setPermissions(r ? getEffectivePermissions({ role: r, permissions: (data as any)?.permissions ?? null }) : {})
      })
      .catch(() => { /* sin perfil resuelto, se queda en "sin permisos" */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user])

  const can = useCallback(
    (module: ModuleKey, action: ActionKey) => (role ? hasPermission({ role, permissions }, module, action) : false),
    [role, permissions],
  )

  return { role, permissions, loading, can }
}
