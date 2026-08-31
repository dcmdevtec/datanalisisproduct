"use client"

import { useEffect, useState } from "react"
import { Loader2, Save, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { UserPermissionsEditor } from "@/components/user-permissions-editor"
import type { PermissionGrid } from "@/lib/permissions"

// Roles editables acá — coincide con EDITABLE_ROLES de
// app/api/role-permissions/route.ts. "admin" queda afuera a propósito
// (riesgo de auto-bloqueo); surveyor/client no usan este panel.
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "coordinator", label: "Coordinador" },
  { value: "supervisor", label: "Supervisor" },
]

// Pestaña "Roles y permisos" de /users — corrige el enfoque anterior (editor
// de permisos metido en el modal de Editar Usuario, editando el override de
// UN usuario puntual). Pedido explícito del cliente: un tab propio del
// módulo de Usuarios, donde lo que se edita es el default del ROL completo
// (public.role_permissions vía app/api/role-permissions/route.ts) — un
// cambio acá aplica a TODOS los usuarios que tengan ese rol.
export function RolePermissionsTab() {
  const { toast } = useToast()
  const [selectedRole, setSelectedRole] = useState(ROLE_OPTIONS[0].value)
  const [byRole, setByRole] = useState<Record<string, PermissionGrid | null>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    fetch("/api/role-permissions")
      .then(async (r) => {
        const json = await r.json().catch(() => null)
        if (!r.ok) throw new Error(json?.error || "Error cargando permisos por rol")
        return json
      })
      .then((json) => {
        if (cancelled) return
        const map: Record<string, PermissionGrid | null> = {}
        for (const role of ROLE_OPTIONS.map((r) => r.value)) {
          const grid = json?.byRole?.[role]
          map[role] = grid && Object.keys(grid).length > 0 ? grid : null
        }
        setByRole(map)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err.message || String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const currentValue = byRole[selectedRole] ?? null

  const handleChange = (next: PermissionGrid | null) => {
    setByRole((prev) => ({ ...prev, [selectedRole]: next }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/role-permissions?role=${selectedRole}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: currentValue ?? {} }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Error guardando permisos del rol")

      toast({
        title: "Permisos actualizados",
        description: `Los permisos de ${ROLE_OPTIONS.find((r) => r.value === selectedRole)?.label} se guardaron correctamente.`,
      })
    } catch (err: any) {
      toast({ title: "Error", description: err.message || String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Acá se edita el default de permisos de un ROL completo: el cambio aplica de una vez a todos los usuarios
          que tengan ese rol. Para excepciones de un usuario puntual, usá el buscador de usuarios y editalo desde
          ahí.
        </p>
      </div>

      {loadError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
          {loadError}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="space-y-1.5 w-full sm:w-64">
          <label className="text-sm font-medium">Rol</label>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" onClick={handleSave} disabled={saving} className="gap-2 sm:ml-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar cambios del rol
        </Button>
      </div>

      <UserPermissionsEditor
        role={selectedRole}
        value={currentValue}
        onChange={handleChange}
        description={
          <>
            Default para <strong>{ROLE_OPTIONS.find((r) => r.value === selectedRole)?.label}</strong>. Lo que toques
            acá queda guardado como excepción sobre la base del sistema, y afecta a todos los usuarios con este rol.
          </>
        }
        resetLabel="Restablecer todo al default del sistema"
      />
    </div>
  )
}
