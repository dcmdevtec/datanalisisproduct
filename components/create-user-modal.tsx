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

type Props = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (user: any) => void
}

export default function CreateUserModal({ isOpen, onOpenChange, onCreated }: Props) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("surveyor")
  const [coordinatorId, setCoordinatorId] = useState("")
  const [coordinators, setCoordinators] = useState<{ id: string; name: string | null }[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reunión 2026-08-27 ("Jerarquías y roles"): al crear un Supervisor se
  // puede elegir de una vez su Coordinador (organigrama global por
  // defecto) — la lista sale de /api/hierarchy, mismo endpoint que usa el
  // picker en cascada de asignación de encuestas.
  useEffect(() => {
    if (!isOpen) return
    fetch("/api/hierarchy")
      .then((r) => r.json())
      .then((json) => setCoordinators(json.coordinators || []))
      .catch(() => setCoordinators([]))
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setName("")
      setEmail("")
      setPassword("")
      setRole("surveyor")
      setCoordinatorId("")
      setIsSubmitting(false)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !name || !role) {
      toast({ title: "Error", description: "Todos los campos son obligatorios", variant: "destructive" })
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, role, coordinatorId: role === "supervisor" ? (coordinatorId || null) : undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Error creando usuario")
      }

      toast({ title: "Usuario creado", description: `${data.name || data.email} creado correctamente` })
      onCreated?.(data)
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
          <DialogTitle>Crear Usuario</DialogTitle>
          <DialogDescription>Crea un nuevo usuario y asígnale un rol.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="userName">Nombre</Label>
            <Input id="userName" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="userEmail">Correo</Label>
            <Input id="userEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="userPassword">Contraseña</Label>
            <Input id="userPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="userRole">Rol</Label>
            <Select onValueChange={(v) => { setRole(v); if (v !== "supervisor") setCoordinatorId("") }} defaultValue={role}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="coordinator">Coordinador</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role === "supervisor" && (
            <div className="space-y-2">
              <Label htmlFor="userCoordinator">Coordinador a cargo (opcional)</Label>
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
              <p className="text-xs text-muted-foreground">
                Organigrama por defecto — se puede ajustar por encuesta puntual desde "Asignación" al crear/editar una encuesta.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando...
                </>
              ) : (
                "Crear Usuario"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
