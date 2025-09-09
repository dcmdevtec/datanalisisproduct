"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Plus, Loader2, AlertCircle, Building2, FolderKanban, Pencil, Trash2, X } from "lucide-react"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase-browser"
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
import Image from "next/image"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { CreateProjectModal } from "@/components/create-project-modal"

type Company = {
  id: string
  name: string
  description: string | null
  logo: string | null // Changed from logo_url to logo as per schema
  website: string | null
  contact: string | null
  created_at: string
  projects_count?: number
}

type Project = {
  id: string
  name: string
  description: string | null
  objective: string | null
  logo: string | null
  company_id: string
}

export default function CompaniesPage() {
  // Estado para alternar entre vista de tabla y cards
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Company Modal states
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [isEditingCompany, setIsEditingCompany] = useState(false)
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null)
  const [companyName, setCompanyName] = useState("")
  const [companyDescription, setCompanyDescription] = useState("")
  const [companyWebsite, setCompanyWebsite] = useState("")
  const [companyContact, setCompanyContact] = useState("")
  const [companyLogo, setCompanyLogo] = useState<string | null>(null) // Base64 string for logo preview
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null) // For actual file input
  const [isSubmittingCompany, setIsSubmittingCompany] = useState(false)

  // Confirmation dialog state
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [companyToDeleteId, setCompanyToDeleteId] = useState<string | null>(null)

  // Project Modal states (for creating project directly from companies page)
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false)
  const [projectModalInitialCompanyId, setProjectModalInitialCompanyId] = useState<string | null>(null)

  // Paginación y búsqueda
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  const fetchCompanies = async () => {
    setLoading(true)
    setError(null)
    // Fetch companies with project count
    const { data, error: fetchError } = await supabase
      .from("companies")
      .select("*, projects(id)") // Select projects to count them
      .order("created_at", { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      const mappedCompanies = (data || []).map((c: any) => ({
        ...c,
        projects_count: c.projects ? c.projects.length : 0, // Count projects
      }))
      setCompanies(mappedCompanies)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (user) {
      fetchCompanies()
    }
  }, [user])

  if (authLoading || !user) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }

  // Sin permisos - todos los usuarios pueden hacer todo
  // const isAdmin = user.role === "admin"
  // const isSupervisor = user.role === "supervisor"

  const filteredCompanies = companies.filter(
    (company) =>
      company.name.toLowerCase().includes(search.toLowerCase()) ||
      (company.description || "").toLowerCase().includes(search.toLowerCase()),
  )

  // Paginación
  const totalPages = Math.ceil(filteredCompanies.length / pageSize) || 1
  const paginatedCompanies = filteredCompanies.slice((page - 1) * pageSize, page * pageSize)

  // --- Company Modal Handlers ---
  const handleOpenCreateCompanyModal = () => {
    setIsEditingCompany(false)
    setCurrentCompany(null)
    setCompanyName("")
    setCompanyDescription("")
    setCompanyWebsite("")
    setCompanyContact("")
    setCompanyLogo(null)
    setCompanyLogoFile(null)
    setShowCompanyModal(true)
  }

  const handleOpenEditCompanyModal = (company: Company) => {
    setIsEditingCompany(true)
    setCurrentCompany(company)
    setCompanyName(company.name)
    setCompanyDescription(company.description || "")
    setCompanyWebsite(company.website || "")
    setCompanyContact(company.contact || "")
    setCompanyLogo(company.logo || null) // Set existing logo for preview
    setCompanyLogoFile(null) // Clear file input
    setShowCompanyModal(true)
  }

  const handleCompanyLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setCompanyLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setCompanyLogo(reader.result as string) // Store base64 string
      }
      reader.readAsDataURL(file)
    } else {
      setCompanyLogoFile(null)
      setCompanyLogo(currentCompany?.logo || null) // Revert to original if no new file
    }
  }

  const handleRemoveCompanyLogo = () => {
    setCompanyLogo(null)
    setCompanyLogoFile(null)
    if (currentCompany) {
      setCurrentCompany({ ...currentCompany, logo: null }) // Update currentCompany state for immediate preview
    }
  }

  const handleSubmitCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingCompany(true)
    setError(null)

    if (!companyName.trim()) {
      toast({
        title: "Error",
        description: "El nombre de la empresa es obligatorio.",
        variant: "destructive",
      })
      setIsSubmittingCompany(false)
      return
    }

    const companyData = {
      name: companyName,
      description: companyDescription,
      logo: companyLogo, // This will be the base64 string or null
      website: companyWebsite || null,
      contact: companyContact || null,
    }

    let dbError = null
    if (isEditingCompany && currentCompany) {
      const { error } = await supabase.from("companies").update(companyData).eq("id", currentCompany.id)
      dbError = error
    } else {
      const { error } = await supabase.from("companies").insert(companyData)
      dbError = error
    }

    if (dbError) {
      setError(`Error al guardar la empresa: ${dbError.message}`)
      toast({
        title: "Error",
        description: `Hubo un error al guardar la empresa: ${dbError.message}`,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Éxito",
        description: `Empresa ${isEditingCompany ? "actualizada" : "creada"} correctamente.`,
        variant: "default",
      })
      setShowCompanyModal(false)
      fetchCompanies() // Re-fetch companies to update the list
    }
    setIsSubmittingCompany(false)
  }

  const handleDeleteClick = (companyId: string) => {
    setCompanyToDeleteId(companyId)
    setIsConfirmDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!companyToDeleteId) return

    setIsConfirmDialogOpen(false)
    setLoading(true)
    setError(null)

    const { error: deleteError } = await supabase.from("companies").delete().eq("id", companyToDeleteId)

    if (deleteError) {
      toast({
        title: "Error al eliminar la empresa",
        description: deleteError.message,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Empresa eliminada",
        description: "La empresa y sus datos asociados han sido eliminados correctamente.",
      })
      setCompanies(companies.filter((c) => c.id !== companyToDeleteId))
    }
    setLoading(false)
    setCompanyToDeleteId(null)
  }

  // --- Project Modal Handlers (within Companies Page) ---
  const handleOpenCreateProjectModal = (companyId: string) => {
    setProjectModalInitialCompanyId(companyId)
    setIsCreateProjectModalOpen(true)
  }

  const handleProjectCreated = () => {
    fetchCompanies() // Re-fetch companies to update project counts in the table
    setIsCreateProjectModalOpen(false) // Close the project creation modal
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-8 bg-[#f7faf9] min-h-screen">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#18b0a4]">
              <Building2 className="inline-block mr-2 h-8 w-8 text-[#18b0a4]" />
              Empresas
            </h1>
            <p className="mt-2 text-gray-500">Gestiona las empresas de la plataforma</p>
          </div>
          <div className="flex gap-2">
            <Button variant={viewMode === 'table' ? 'default' : 'outline'} onClick={() => setViewMode('table')}>
              Tabla
            </Button>
            <Button variant={viewMode === 'card' ? 'default' : 'outline'} onClick={() => setViewMode('card')}>
              Cards
            </Button>
            <Button onClick={handleOpenCreateCompanyModal} className="bg-[#18b0a4] hover:bg-[#18b0a4]/90 w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" /> Nueva Empresa
            </Button>
          </div>
        </div>
        <div className="mb-8">
          <input
            className="w-full sm:w-80 px-4 py-2 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-0 focus-visible:ring-0 !focus:ring-0 !focus-visible:ring-0 focus:outline-none text-gray-900 placeholder:text-gray-400 shadow-sm transition"
            type="text"
            placeholder="🔍 Buscar por nombre o descripción..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="text-center p-8 border rounded-lg bg-muted/50">
            <h3 className="text-lg font-medium mb-2">No hay empresas disponibles</h3>
            <p className="text-muted-foreground mb-4">No se encontraron empresas para mostrar.</p>
            <Button onClick={handleOpenCreateCompanyModal}>
              <Plus className="h-4 w-4 mr-2" /> Crear tu primera empresa
            </Button>
          </div>
        ) : viewMode === 'table' ? (
          <>
            {/* ...existing code for table view... */}
            <div className="overflow-x-auto rounded-xl shadow border border-[#18b0a4]/20 bg-white">
              <Table className="min-w-[900px]">
                {/* ...existing code for table header and body... */}
                {/* ...existing code for table rows... */}
                <TableHeader className="bg-[#18b0a4]/10">
                  <TableRow>
                    <TableHead className="text-[#18b0a4] font-bold">Logo</TableHead>
                    <TableHead className="text-[#18b0a4] font-bold">Nombre</TableHead>
                    <TableHead className="text-[#18b0a4] font-bold">Descripción</TableHead>
                    <TableHead className="text-[#18b0a4] font-bold">Sitio web</TableHead>
                    <TableHead className="text-[#18b0a4] font-bold">Contacto</TableHead>
                    <TableHead className="text-[#18b0a4] font-bold">Proyectos</TableHead>
                    <TableHead className="text-[#18b0a4] font-bold">Creado</TableHead>
                    <TableHead className="text-[#18b0a4] font-bold text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCompanies.map((company) => (
                    <TableRow key={company.id} className="hover:bg-[#18b0a4]/5 transition group">
                      <TableCell>
                        {company.logo ? (
                          <Image
                            src={company.logo || "/placeholder.svg"}
                            alt={`${company.name} logo`}
                            width={40}
                            height={40}
                            className="rounded-full object-contain"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                            No Logo
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold text-gray-900 group-hover:text-[#18b0a4]">
                        {company.name}
                      </TableCell>
                      <TableCell className="text-gray-700">{company.description || "-"}</TableCell>
                      <TableCell className="text-gray-700">
                        {company.website ? (
                          <a
                            href={company.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                          >
                            {company.website}
                          </a>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                      <TableCell className="text-gray-700">{company.contact || "N/A"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <FolderKanban className="h-4 w-4 text-[#18b0a4]" />
                          <span>{company.projects_count ?? 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {new Date(company.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="flex justify-center items-center gap-2">
                        {company.projects_count && company.projects_count > 0 ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-[#18b0a4] hover:bg-[#18b0a4]/10"
                            onClick={() => router.push(`/projects?companyId=${company.id}`)}
                            title="Ver Proyectos"
                          >
                            <span className="sr-only">Ver Proyectos</span>
                            <FolderKanban className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-[#18b0a4] hover:bg-[#18b0a4]/10"
                            onClick={() => handleOpenCreateProjectModal(company.id)}
                            title="Crear Proyecto"
                          >
                            <span className="sr-only">Crear Proyecto</span>
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-[#18b0a4] hover:bg-[#18b0a4]/10"
                          onClick={() => handleOpenEditCompanyModal(company)}
                          title="Editar Empresa"
                        >
                          <span className="sr-only">Editar Empresa</span>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:bg-red-500/10"
                          onClick={() => handleDeleteClick(company.id)}
                          title="Eliminar Empresa"
                        >
                          <span className="sr-only">Eliminar Empresa</span>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Paginación */}
            <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-2">
              <div className="text-sm text-gray-500">
                Página <span className="font-semibold text-[#18b0a4]">{page}</span> de{" "}
                <span className="font-semibold text-[#18b0a4]">{totalPages}</span>{" "}
                <span className="ml-2">({filteredCompanies.length} resultados)</span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full ${page === 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-[#18b0a4]/10"}`}
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  aria-label="Primera"
                >
                  <span className="sr-only">Primera</span>
                  <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                    <path
                      d="M13 16L7 10L13 4"
                      stroke="#18b0a4"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full ${page === 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-[#18b0a4]/10"}`}
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  aria-label="Anterior"
                >
                  <span className="sr-only">Anterior</span>
                  <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                    <path
                      d="M12 16L6 10L12 4"
                      stroke="#18b0a4"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full ${page === totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-[#18b0a4]/10"}`}
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  aria-label="Siguiente"
                >
                  <span className="sr-only">Siguiente</span>
                  <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                    <path
                      d="M8 4L14 10L8 16"
                      stroke="#18b0a4"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full ${page === totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-[#18b0a4]/10"}`}
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  aria-label="Última"
                >
                  <span className="sr-only">Última</span>
                  <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                    <path
                      d="M7 4L13 10L7 16"
                      stroke="#18b0a4"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Vista en Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedCompanies.map((company) => (
                <div key={company.id} className="bg-white rounded-xl shadow border border-[#18b0a4]/20 p-6 flex flex-col">
                  <div className="flex items-center gap-4 mb-4">
                    {company.logo ? (
                      <Image
                        src={company.logo || "/placeholder.svg"}
                        alt={`${company.name} logo`}
                        width={48}
                        height={48}
                        className="rounded-full object-contain border"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                        No Logo
                      </div>
                    )}
                    <div>
                      <h2 className="text-xl font-bold text-[#18b0a4]">{company.name}</h2>
                      <p className="text-gray-700 text-sm">{company.description || '-'}</p>
                    </div>
                  </div>
                  <div className="mb-2 text-sm">
                    <span className="font-semibold text-gray-600">Sitio web: </span>
                    {company.website ? (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        {company.website}
                      </a>
                    ) : (
                      "N/A"
                    )}
                  </div>
                  <div className="mb-2 text-sm">
                    <span className="font-semibold text-gray-600">Contacto: </span>
                    {company.contact || 'N/A'}
                  </div>
                  <div className="mb-2 text-sm">
                    <span className="font-semibold text-gray-600">Proyectos: </span>
                    <span className="inline-flex items-center gap-1"><FolderKanban className="h-4 w-4 text-[#18b0a4]" />{company.projects_count ?? 0}</span>
                  </div>
                  <div className="mb-2 text-sm">
                    <span className="font-semibold text-gray-600">Creado: </span>
                    {new Date(company.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2 mt-4">
                    {company.projects_count && company.projects_count > 0 ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-[#18b0a4] hover:bg-[#18b0a4]/10"
                        onClick={() => router.push(`/projects?companyId=${company.id}`)}
                        title="Ver Proyectos"
                      >
                        <span className="sr-only">Ver Proyectos</span>
                        <FolderKanban className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-[#18b0a4] hover:bg-[#18b0a4]/10"
                        onClick={() => handleOpenCreateProjectModal(company.id)}
                        title="Crear Proyecto"
                      >
                        <span className="sr-only">Crear Proyecto</span>
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-[#18b0a4] hover:bg-[#18b0a4]/10"
                      onClick={() => handleOpenEditCompanyModal(company)}
                      title="Editar Empresa"
                    >
                      <span className="sr-only">Editar Empresa</span>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:bg-red-500/10"
                      onClick={() => handleDeleteClick(company.id)}
                      title="Eliminar Empresa"
                    >
                      <span className="sr-only">Eliminar Empresa</span>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {/* Paginación */}
            <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-2">
              <div className="text-sm text-gray-500">
                Página <span className="font-semibold text-[#18b0a4]">{page}</span> de{" "}
                <span className="font-semibold text-[#18b0a4]">{totalPages}</span>{" "}
                <span className="ml-2">({filteredCompanies.length} resultados)</span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full ${page === 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-[#18b0a4]/10"}`}
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  aria-label="Primera"
                >
                  <span className="sr-only">Primera</span>
                  <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                    <path
                      d="M13 16L7 10L13 4"
                      stroke="#18b0a4"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full ${page === 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-[#18b0a4]/10"}`}
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  aria-label="Anterior"
                >
                  <span className="sr-only">Anterior</span>
                  <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                    <path
                      d="M12 16L6 10L12 4"
                      stroke="#18b0a4"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full ${page === totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-[#18b0a4]/10"}`}
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  aria-label="Siguiente"
                >
                  <span className="sr-only">Siguiente</span>
                  <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                    <path
                      d="M8 4L14 10L8 16"
                      stroke="#18b0a4"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full ${page === totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-[#18b0a4]/10"}`}
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  aria-label="Última"
                >
                  <span className="sr-only">Última</span>
                  <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                    <path
                      d="M7 4L13 10L7 16"
                      stroke="#18b0a4"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Company Create/Edit Modal */}
      <Dialog open={showCompanyModal} onOpenChange={setShowCompanyModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{isEditingCompany ? "Editar Empresa" : "Crear Nueva Empresa"}</DialogTitle>
            <DialogDescription>
              {isEditingCompany
                ? "Modifica los detalles de la empresa."
                : "Completa los detalles para crear una nueva empresa."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitCompany} className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Nombre de la Empresa</Label>
              <Input id="company-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-description">Descripción (Opcional)</Label>
              <Textarea
                id="company-description"
                value={companyDescription}
                onChange={(e) => setCompanyDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-website">Sitio web (Opcional)</Label>
              <Input id="company-website" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-contact">Contacto (Opcional)</Label>
              <Input id="company-contact" value={companyContact} onChange={(e) => setCompanyContact(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-logo">Logo (Opcional)</Label>
              <div className="flex items-center gap-4">
                <label
                  htmlFor="company-logo-upload"
                  className="cursor-pointer px-4 py-2 bg-[#18b0a4] text-white rounded-lg font-semibold shadow hover:bg-[#139488] transition"
                >
                  {companyLogo ? "Cambiar logo" : "Subir logo"}
                  <input
                    id="company-logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleCompanyLogoFileChange}
                    className="hidden"
                  />
                </label>
                {(companyLogo || currentCompany?.logo) && (
                  <div className="relative group">
                    <Image
                      src={companyLogo || currentCompany?.logo || "/placeholder.svg"}
                      alt="Logo de la Empresa"
                      width={64}
                      height={64}
                      className="rounded border border-[#18b0a4] object-contain bg-white"
                    />
                    <button
                      type="button"
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 text-xs opacity-80 hover:opacity-100"
                      onClick={handleRemoveCompanyLogo}
                      title="Eliminar logo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCompanyModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingCompany}>
                {isSubmittingCompany ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                  </>
                ) : isEditingCompany ? (
                  "Guardar Cambios"
                ) : (
                  "Crear Empresa"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Company Deletion */}
      <ConfirmationDialog
        isOpen={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Confirmar Eliminación"
        description="¿Estás seguro de que quieres eliminar esta empresa? Esta acción eliminará también todos los proyectos y encuestas asociados."
        confirmText="Eliminar"
        cancelText="Cancelar"
      />

      {/* Create Project Modal (opened from Companies Page) */}
      <CreateProjectModal
        isOpen={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
        initialCompanyId={projectModalInitialCompanyId}
        onProjectCreated={handleProjectCreated}
      />
    </DashboardLayout>
  )
}
