"use client"

import React, { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserPermissionsEditor } from "@/components/user-permissions-editor"
import type { PermissionGrid } from "@/lib/permissions"

type EditableUser = {
  id: string
  name: string
  email: string
  role: string
  status: string
  coordinator_id?: string | null
  permissions?: PermissionGrid | null
}

type Props = {
  user: EditableUser | null
  onOpenChange: (open: boolean) => void
  onUpdated?: (user: any) => void
}

// Roles que este modal permite asignar. "surveyor" y "client" no se editan
// acá: los encuestadores se gestionan desde el módulo Encuestadores (tienen
// una fila ligada en public.surveyors que este API no toca) y "client" ya
// no se ofrece para cuentas nuevas (ver create-user-modal.tsx). Si el
// usuario que se está editando ya tiene uno de esos roles, se muestra
// deshabilitado en vez de forzar un cambio no soportado por este flujo.
const EDITABLE_ROLES = ["admin", "coordinator", "supervisor"]

export default function EditUserModal({ user, onOpenChange, onUpdated }: Props) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [role, setRole] = useState("supervisor")
  const [status, setStatus] = useState("active")
  const [coordinatorId, setCoordinatorId] = useState("")
  const [coordinators, setCoordinators] = useState<{ id: string; name: string | null }[]>([])
  const [permissions, setPermissions] = useState<PermissionGrid | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isOpen = !!user
  const roleIsManaged = user ? EDITABLE_ROLES.includes(user.role) : true

  useEffect(() => {
    if (!user) return
    setName(user.name)
    setRole(user.role)
    setStatus(user.status)
    setCoordinatorId(user.coordinator_id || "")
    setPermissions(user.permissions ?? null)
  }, [user])

  useEffect(() => {
    if (!isOpen) return
    fetch("/api/hierarchy")
      .then((r) => r.json())
      .then((json) => setCoordinators(json.coordinators || []))
      .catch(() => setCoordinators([]))
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setIsSubmitting(true)
    try {
      const payload: Record<string, any> = { name, status, permissions }
      if (roleIsManaged) {
        payload.role = role
        payload.coordinatorId = role === "supervisor" ? coordinatorId || null : null
      }
      const res = await fetch(`/api/users?id=${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Error actualizando usuario")
      }

      toast({ title: "Usuario actualizado", description: `${data.name || data.email} se actualizó correctamente` })
      onUpdated?.(data)
      onOpenChange(false)
    } catch (err: any) {
      toast({ title: "Error", description: err.message || String(err), variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-content-responsive">
        <DialogHeader>
          <DialogTitle>Editar Usuario</DialogTitle>
          <DialogDescription>Actualiza el rol, la jerarquía o el estado de {user?.email}.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="editUserName">Nombre</Label>
            <Input id="editUserName" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editUserRole">Rol</Label>
            {roleIsManaged ? (
              <Select onValueChange={(v) => { setRole(v); if (v !== "supervisor") setCoordinatorId("") }} value={role}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="coordinator">Coordinador</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground border rounded-md px-3 py-2">
                {role === "surveyor" ? "Encuestador — gestiona el rol desde el módulo Encuestadores." : "Cliente"}
              </p>
            )}
          </div>

          {roleIsManaged && role === "supervisor" && (
            <div className="space-y-2">
              <Label htmlFor="editUserCoordinator">Coordinador a cargo (opcional)</Label>
              <Select onValueChange={(v) => setCoordinatorId(v)} value={coordinatorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin coordinador asignado" />
                </SelectTrigger>
                <SelectContent>
                  {coordinators.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No hay coordinadores creados todavía</div>
                  ) : (
                    coordinators.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name || "Sin nombre"}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="editUserStatus">Estado</Label>
            <Select onValueChange={(v) => setStatus(v)} value={status}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <UserPermissionsEditor role={role} value={permissions} onChange={setPermissions} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
