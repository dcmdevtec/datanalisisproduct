"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Search, Loader2, Edit, Trash2, UserPlus } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { Surveyor } from "@/types/surveyor"

export default function SurveyorsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [surveyors, setSurveyors] = useState<Surveyor[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSurveyor, setEditingSurveyor] = useState<Surveyor | null>(null)
  const [surveyorName, setSurveyorName] = useState("")
  const [surveyorEmail, setSurveyorEmail] = useState("")
  const [surveyorPhone, setSurveyorPhone] = useState("")
  const [surveyorPassword, setSurveyorPassword] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)
  const [surveyorToDelete, setSurveyorToDelete] = useState<Surveyor | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    } else if (!authLoading && user && user.role !== "admin") {
      router.push("/dashboard")
      toast({
        title: "Acceso restringido",
        description: "No tienes permisos para acceder a esta página",
        variant: "destructive",
      })
    }
  }, [user, authLoading, router, toast])

  const fetchSurveyors = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/surveyors")
      if (!response.ok) {
        throw new Error("Error fetching surveyors")
      }
      const data: Surveyor[] = await response.json()
      setSurveyors(data)
    } catch (error: any) {
      console.error("Error fetching surveyors:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudieron cargar los encuestadores.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role === "admin") {
      fetchSurveyors()
    }
  }, [user])

  const handleAddSurveyor = () => {
    setEditingSurveyor(null)
    setSurveyorName("")
    setSurveyorEmail("")
    setSurveyorPhone("")
    setSurveyorPassword("")
    setIsModalOpen(true)
  }

  const handleEditSurveyor = (surveyor: Surveyor) => {
    setEditingSurveyor(surveyor)
    setSurveyorName(surveyor.name)
    setSurveyorEmail(surveyor.email)
    setSurveyorPhone(surveyor.phone_number || "")
    // Do not pre-fill password for security
    setIsModalOpen(true)
  }

  const handleSaveSurveyor = async () => {
    setIsSaving(true)

    // Validaciones
    if (!surveyorName.trim() || !surveyorEmail.trim()) {
      toast({
        title: "Error",
        description: "Nombre y correo son obligatorios.",
        variant: "destructive",
      })
      setIsSaving(false)
      return
    }

    if (!editingSurveyor && !surveyorPassword.trim()) {
      toast({
        title: "Error",
        description: "La contraseña es obligatoria para nuevos encuestadores.",
        variant: "destructive",
      })
      setIsSaving(false)
      return
    }

    const payload = {
      name: surveyorName,
      email: surveyorEmail,
      phone_number: surveyorPhone || null,
      ...(surveyorPassword && { password: surveyorPassword }),
    }

    try {
      const url = editingSurveyor ? `/api/surveyors?id=${editingSurveyor.id}` : "/api/surveyors" // Use query param for ID
      const method = editingSurveyor ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const text = await response.text()
      const result = text ? JSON.parse(text) : null

      if (!response.ok) {
        throw new Error(result?.error || "Error al guardar encuestador.")
      }

      toast({
        title: "Éxito",
        description: `Encuestador ${editingSurveyor ? "actualizado" : "añadido"} correctamente.`,
      })

      fetchSurveyors() // Re-fetch surveyors to update the table
      setIsModalOpen(false)
    } catch (error: any) {
      console.error("Error saving surveyor:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el encuestador.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSurveyor = (surveyor: Surveyor) => {
    setSurveyorToDelete(surveyor)
    setIsConfirmDeleteOpen(true)
  }

  const confirmDeleteSurveyor = async () => {
    if (!surveyorToDelete) return
    setIsSaving(true)
    try {
      const response = await fetch(`/api/surveyors?id=${surveyorToDelete.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Error al eliminar encuestador.")
      }

      toast({
        title: "Éxito",
        description: "Encuestador eliminado correctamente.",
      })
      fetchSurveyors() // Re-fetch surveyors to update the table
      setIsConfirmDeleteOpen(false)
      setSurveyorToDelete(null)
    } catch (error: any) {
      console.error("Error deleting surveyor:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el encuestador.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const filteredSurveyors = surveyors.filter(
    (surveyor) =>
      surveyor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      surveyor.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (authLoading || !user || user.role !== "admin") {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Encuestadores</h1>
            <p className="text-muted-foreground">Gestiona los perfiles de los encuestadores.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar encuestador..."
                className="pl-8 w-full sm:w-[250px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button className="gap-2" onClick={handleAddSurveyor}>
              <UserPlus className="h-4 w-4" /> Añadir Encuestador
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Lista de Encuestadores</CardTitle>
              <CardDescription>Una lista de todos los encuestadores registrados en tu plataforma.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-primary-tableHeader">
                    <TableRow className="border-b border-border">
                      <TableHead className="w-[50px] py-3 px-4">Avatar</TableHead>
                      <TableHead className="py-3 px-4">Nombre</TableHead>
                      <TableHead className="py-3 px-4">Correo</TableHead>
                      <TableHead className="hidden md:table-cell py-3 px-4">Teléfono</TableHead>
                      <TableHead className="hidden sm:table-cell py-3 px-4">Estado</TableHead>
                      <TableHead className="hidden lg:table-cell py-3 px-4">Creado en</TableHead>
                      <TableHead className="text-right py-3 px-4">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSurveyors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          No se encontraron encuestadores.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSurveyors.map((surveyor) => (
                        <TableRow key={surveyor.id} className="border-b border-border hover:bg-muted/50">
                          <TableCell className="py-3 px-4">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>
                                {surveyor.name
                                  ? surveyor.name.substring(0, 2).toUpperCase()
                                  : surveyor.email.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium py-3 px-4">{surveyor.name}</TableCell>
                          <TableCell className="py-3 px-4">{surveyor.email}</TableCell>
                          <TableCell className="hidden md:table-cell py-3 px-4">
                            {surveyor.phone_number || "N/A"}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell capitalize py-3 px-4">{surveyor.status}</TableCell>
                          <TableCell className="hidden lg:table-cell py-3 px-4">
                            {new Date(surveyor.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right py-3 px-4">
                            <Button variant="ghost" size="sm" onClick={() => handleEditSurveyor(surveyor)}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Editar</span>
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteSurveyor(surveyor)}>
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Eliminar</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Surveyor Add/Edit Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingSurveyor ? "Editar Encuestador" : "Añadir Nuevo Encuestador"}</DialogTitle>
              <DialogDescription>
                {editingSurveyor
                  ? "Realiza cambios en la información del encuestador."
                  : "Registra un nuevo perfil de encuestador."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Nombre
                </Label>
                <Input
                  id="name"
                  value={surveyorName}
                  onChange={(e) => setSurveyorName(e.target.value)}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  Correo
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={surveyorEmail}
                  onChange={(e) => setSurveyorEmail(e.target.value)}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">
                  Teléfono
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={surveyorPhone}
                  onChange={(e) => setSurveyorPhone(e.target.value)}
                  className="col-span-3"
                />
              </div>
              {!editingSurveyor && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="password" className="text-right">
                    Contraseña
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={surveyorPassword}
                    onChange={(e) => setSurveyorPassword(e.target.value)}
                    className="col-span-3"
                    required={!editingSurveyor}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveSurveyor} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingSurveyor ? "Guardar cambios" : "Añadir encuestador"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Eliminación</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que quieres eliminar al encuestador{" "}
                <span className="font-semibold">{surveyorToDelete?.name}</span>? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsConfirmDeleteOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={confirmDeleteSurveyor} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
