"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, MoreHorizontal, Loader2, UserPlus } from "lucide-react"
import dynamic from "next/dynamic"
import CreateUserModal from "@/components/create-user-modal"
import EditUserModal from "@/components/edit-user-modal"
import { useToast } from "@/components/ui/use-toast"

type User = {
  id: string
  name: string
  email: string
  role: string
  status: string
  coordinator_id?: string | null
  // Nombre del coordinador asignado (solo aplica a role="supervisor") —
  // lo arma el propio GET /api/users, no viene de una relación de Supabase.
  coordinatorName?: string | null
  // The API may return created_at / updated_at instead of lastActive
  lastActive?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export default function UsersPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null)

  const refreshUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/users")
      if (!response.ok) throw new Error("Error al cargar usuarios")
      const data = await response.json()
      setUsers(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return
    refreshUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Antes este botón solo mostraba un toast — no llamaba a ningún API, así
  // que "desactivar" un usuario no tenía ningún efecto real (el usuario
  // seguía pudiendo iniciar sesión). Ahora persiste el cambio vía PATCH y
  // refleja el resultado real devuelto por el servidor, no un valor optimista.
  const handleToggleStatus = async (target: User) => {
    const nextStatus = target.status === "active" ? "inactive" : "active"
    setTogglingStatusId(target.id)
    try {
      const res = await fetch(`/api/users?id=${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "No se pudo actualizar el estado")

      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, status: data.status } : u)))
      toast({
        title: "Cambio de estado",
        description: `Usuario ${data.status === "active" ? "activado" : "desactivado"} correctamente`,
      })
    } catch (err: any) {
      toast({ title: "Error", description: err.message || String(err), variant: "destructive" })
    } finally {
      setTogglingStatusId(null)
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-"
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return "-"
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  const getRoleName = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrador"
      case "supervisor":
        return "Supervisor"
      case "coordinator":
        return "Coordinador"
      case "surveyor":
        return "Encuestador"
      case "client":
        return "Cliente"
      default:
        return role
    }
  }

  if (authLoading || !user) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }



  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Usuarios</h1>
            <p className="text-muted-foreground">Gestiona los usuarios de la plataforma</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative mt-10">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar usuarios..."
                className="pl-8 w-full sm:w-[250px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button className="gap-2 mt-10" onClick={() => setIsCreateOpen(true)}>
              <UserPlus className="h-4 w-4" /> Añadir Usuario
            </Button>
            <CreateUserModal
              isOpen={isCreateOpen}
              onOpenChange={(open) => setIsCreateOpen(open)}
              onCreated={() => refreshUsers()}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mobile Card View */}
            <div className="block md:hidden space-y-4">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No se encontraron usuarios
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <div key={user.id} className="border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 min-w-0 flex-1">
                        <h3 className="font-medium text-base truncate" title={user.name}>
                          {user.name}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate" title={user.email}>
                          {user.email}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Abrir menú</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setEditingUser(user)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={togglingStatusId === user.id}
                            onClick={() => handleToggleStatus(user)}
                          >
                            {user.status === "active" ? "Desactivar" : "Activar"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Rol:</span>
                        <span className="font-medium">{getRoleName(user.role)}</span>
                      </div>
                      <Badge variant={user.status === "active" ? "default" : "secondary"} className="capitalize">
                        {user.status === "active" ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    {user.role === "supervisor" && (
                      <div className="text-sm text-muted-foreground">
                        <span>Coordinador: </span>
                        <span className="font-medium">{user.coordinatorName || "Sin asignar"}</span>
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground">
                      <span>Última actividad: </span>
                      <span className="font-medium">
                        {formatDate(user.lastActive ?? user.updated_at ?? user.created_at)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
              <div className="rounded-md border overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">Nombre</TableHead>
                        <TableHead className="min-w-[200px]">Correo</TableHead>
                        <TableHead className="min-w-[120px]">Rol</TableHead>
                        <TableHead className="min-w-[140px]">Coordinador</TableHead>
                        <TableHead className="min-w-[100px]">Estado</TableHead>
                        <TableHead className="min-w-[140px]">Última actividad</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center h-24">
                            No se encontraron usuarios
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              <div className="truncate max-w-[150px]" title={user.name}>
                                {user.name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="truncate max-w-[200px]" title={user.email}>
                                {user.email}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="whitespace-nowrap">{getRoleName(user.role)}</span>
                            </TableCell>
                            <TableCell>
                              <span className="whitespace-nowrap text-sm text-muted-foreground">
                                {user.role === "supervisor" ? user.coordinatorName || "Sin asignar" : "—"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={user.status === "active" ? "default" : "secondary"} className="capitalize">
                                {user.status === "active" ? "Activo" : "Inactivo"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              <span className="whitespace-nowrap">
                                {formatDate(user.lastActive ?? user.updated_at ?? user.created_at)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Abrir menú</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setEditingUser(user)}>Editar</DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={togglingStatusId === user.id}
                                    onClick={() => handleToggleStatus(user)}
                                  >
                                    {user.status === "active" ? "Desactivar" : "Activar"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        )}

        <EditUserModal
          user={editingUser}
          onOpenChange={(open) => { if (!open) setEditingUser(null) }}
          onUpdated={() => refreshUsers()}
        />
      </div>
    </DashboardLayout>
  )
}
