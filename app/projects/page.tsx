"use client"
import { useEffect, useState, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Plus, Loader2, AlertCircle, FolderKanban, Eye, Pencil, Trash2, LayoutList } from "lucide-react"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase-browser"
import Image from "next/image"
import { Combobox } from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { CreateProjectModal } from "@/components/create-project-modal"

type Project = {
  id: string
  name: string
  description: string | null
  objective: string | null
  logo: string | null
  company_id: string
  created_at: string
  company_name?: string
  surveys_count?: number
}

type Company = {
  id: string
  name: string
}

function ProjectsPageContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [projects, setProjects] = useState<Project[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal states for creating/editing project
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [isEditingProject, setIsEditingProject] = useState(false)
  const [currentProject, setCurrentProject] = useState<Project | null>(null)

  // Confirmation dialog state
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [projectToDeleteId, setProjectToDeleteId] = useState<string | null>(null)

  // Search and filter states
  const [search, setSearch] = useState("")
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const companyIdFromUrl = searchParams.get("companyId")
    if (companyIdFromUrl) {
      setSelectedCompanyFilter(companyIdFromUrl)
    } else {
      setSelectedCompanyFilter(null) // Clear filter if param is removed
    }
  }, [searchParams])

  const fetchProjectsAndCompanies = useCallback(async () => {
    setLoading(true)
    setError(null)

    // Fetch companies
    const { data: companiesData, error: companiesError } = await supabase
      .from("companies")
      .select("id, name")
      .order("name", { ascending: true })

    if (companiesError) {
      setError(companiesError.message)
      setLoading(false)
      return
    }
    setCompanies(companiesData || [])

    // Fetch projects with company name and survey count
    let query = supabase.from("projects").select("*, companies(name), surveys(id)")

    if (selectedCompanyFilter) {
      query = query.eq("company_id", selectedCompanyFilter)
    }

    const { data: projectsData, error: projectsError } = await query.order("created_at", { ascending: false })

    if (projectsError) {
      setError(projectsError.message)
    } else {
      const mappedProjects = (projectsData || []).map((project: any) => ({
        ...project,
        company_name: project.companies?.name || "N/A",
        surveys_count: project.surveys ? project.surveys.length : 0,
      }))
      setProjects(mappedProjects)
    }
    setLoading(false)
  }, [selectedCompanyFilter])

  useEffect(() => {
    if (user) {
      fetchProjectsAndCompanies()
    }
  }, [user, fetchProjectsAndCompanies])

  if (authLoading || !user) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }



  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(search.toLowerCase()) ||
      (project.description || "").toLowerCase().includes(search.toLowerCase()) ||
      (project.objective || "").toLowerCase().includes(search.toLowerCase()) ||
      (project.company_name || "").toLowerCase().includes(search.toLowerCase())

    // Company filter is now handled by the Supabase query
    return matchesSearch
  })

  const totalPages = Math.ceil(filteredProjects.length / pageSize) || 1
  const paginatedProjects = filteredProjects.slice((page - 1) * pageSize, page * pageSize)

  const companyOptions = companies.map((c) => ({
    value: c.id,
    label: c.name,
  }))

  const handleOpenCreateModal = () => {
    setIsEditingProject(false)
    setCurrentProject(null)
    setIsProjectModalOpen(true)
  }

  const handleOpenEditModal = (project: Project) => {
    setIsEditingProject(true)
    setCurrentProject(project)
    setIsProjectModalOpen(true)
  }

  const handleDeleteClick = (projectId: string) => {
    setProjectToDeleteId(projectId)
    setIsConfirmDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!projectToDeleteId) return

    setIsConfirmDialogOpen(false)
    setLoading(true)
    setError(null)

    const { error: deleteError } = await supabase.from("projects").delete().eq("id", projectToDeleteId)

    if (deleteError) {
      toast({
        title: "Error al eliminar el proyecto",
        description: deleteError.message,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Proyecto eliminado",
        description: "El proyecto y sus encuestas asociadas han sido eliminados correctamente.",
      })
      setProjects(projects.filter((p) => p.id !== projectToDeleteId))
    }
    setLoading(false)
    setProjectToDeleteId(null)
  }

  const handleProjectCreatedOrUpdated = () => {
    fetchProjectsAndCompanies() // Re-fetch projects to update the list
    setIsProjectModalOpen(false) // Close the modal
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 bg-[#f7faf9] min-h-screen">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 lg:mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18b0a4]">
              <FolderKanban className="inline-block mr-2 h-6 w-6 sm:h-8 sm:w-8 text-[#18b0a4]" />
              Proyectos
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-500">Gestiona los proyectos de la plataforma</p>
          </div>
          <Button onClick={handleOpenCreateModal} className="bg-[#18b0a4] hover:bg-[#18b0a4]/90 w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Crear Proyecto
          </Button>
        </div>
        <div className="flex flex-col gap-4 mb-6 lg:mb-8">
          <Input
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-0 focus-visible:ring-0 !focus:ring-0 !focus-visible:ring-0 focus:outline-none text-gray-900 placeholder:text-gray-400 shadow-sm transition"
            type="text"
            placeholder="🔍 Buscar por nombre, empresa o descripción..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
          <Combobox
            options={companyOptions}
            value={selectedCompanyFilter || ""}
            onValueChange={(value) => {
              setSelectedCompanyFilter(value === "" ? null : value)
              setPage(1)
            }}
            placeholder="Filtrar por empresa..."
            searchPlaceholder="Buscar empresa..."
            emptyMessage="No se encontraron empresas."
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
        ) : filteredProjects.length === 0 ? (
          <div className="text-center p-6 sm:p-8 border rounded-lg bg-muted/50">
            <h3 className="text-lg sm:text-xl font-medium mb-2">No hay proyectos disponibles</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">No se encontraron proyectos para mostrar.</p>
            <Button onClick={handleOpenCreateModal} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" /> Crear tu primer proyecto
            </Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl shadow border border-[#18b0a4]/20 bg-white">
              <Table className="w-full">
                <TableHeader className="bg-[#18b0a4]/10">
                  <TableRow>
                    <TableHead className="text-[#18b0a4] font-bold px-2 sm:px-4">Logo</TableHead>
                    <TableHead className="text-[#18b0a4] font-bold px-2 sm:px-4">Nombre</TableHead>
                    <TableHead className="text-[#18b0a4] font-bold px-2 sm:px-4 hidden sm:table-cell">Empresa</TableHead>
                    <TableHead className="text-[#18b0a4] font-bold px-2 sm:px-4 hidden lg:table-cell">Descripción</TableHead>
                    <TableHead className="text-[#18b0a4] font-bold px-2 sm:px-4 hidden lg:table-cell">Objetivo</TableHead>
                    <TableHead className="text-[#18b0a4] font-bold px-2 sm:px-4">
                      <div className="flex items-center gap-1">
                        <LayoutList className="h-4 w-4" />
                        <span className="hidden sm:inline">Encuestas</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-[#18b0a4] font-bold px-2 sm:px-4 hidden md:table-cell">Creado</TableHead>
                    <TableHead className="text-[#18b0a4] font-bold text-center px-2 sm:px-4">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProjects.map((project) => (
                    <TableRow key={project.id} className="hover:bg-[#18b0a4]/5 transition group">
                      <TableCell className="px-2 sm:px-4">
                        {project.logo ? (
                          <Image
                            src={project.logo || "/placeholder.svg"}
                            alt={`${project.name} logo`}
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
                      <TableCell className="font-semibold text-gray-900 group-hover:text-[#18b0a4] px-2 sm:px-4">
                        <div className="truncate max-w-[100px] sm:max-w-[120px] lg:max-w-[150px]" title={project.name}>
                          {project.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-700 px-2 sm:px-4 hidden sm:table-cell">
                        <div className="truncate max-w-[80px] lg:max-w-[120px]" title={project.company_name}>
                          {project.company_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-700 px-2 sm:px-4 hidden lg:table-cell">
                        <div className="truncate max-w-[100px] lg:max-w-[150px]" title={project.description || "-"}>
                          {project.description || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-700 px-2 sm:px-4 hidden lg:table-cell">
                        <div className="truncate max-w-[100px] lg:max-w-[150px]" title={project.objective || "-"}>
                          {project.objective || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="px-2 sm:px-4">
                        <div className="flex items-center gap-1">
                          <LayoutList className="h-4 w-4 text-[#18b0a4]" />
                          <span>{project.surveys_count ?? 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-700 px-2 sm:px-4 hidden md:table-cell">
                        <div className="truncate max-w-[60px] lg:max-w-[100px]">
                          {new Date(project.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="flex justify-center items-center gap-1 sm:gap-2 px-2 sm:px-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-[#18b0a4] hover:bg-[#18b0a4]/10 h-7 w-7 sm:h-8 sm:w-8 lg:h-9 lg:w-9"
                          onClick={() => router.push(`/surveys?projectId=${project.id}`)}
                          title="Ver Encuestas"
                        >
                          <span className="sr-only">Ver Encuestas</span>
                          <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-[#18b0a4] hover:bg-[#18b0a4]/10 h-7 w-7 sm:h-8 sm:w-8 lg:h-9 lg:w-9"
                          onClick={() => handleOpenEditModal(project)}
                          title="Editar Proyecto"
                        >
                          <span className="sr-only">Editar Proyecto</span>
                          <Pencil className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:bg-red-500/10 h-7 w-7 sm:h-8 sm:w-8 lg:h-9 lg:w-9"
                          onClick={() => handleDeleteClick(project.id)}
                          title="Eliminar Proyecto"
                        >
                          <span className="sr-only">Eliminar Proyecto</span>
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Paginación */}
            <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
              <div className="text-sm text-gray-500 text-center sm:text-left">
                Página <span className="font-semibold text-[#18b0a4]">{page}</span> de{" "}
                <span className="font-semibold text-[#18b0a4]">{totalPages}</span>{" "}
                <span className="ml-2">({filteredProjects.length} resultados)</span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full h-8 w-8 sm:h-9 sm:w-9 ${page === 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-[#18b0a4]/10"}`}
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  aria-label="Primera"
                >
                  <span className="sr-only">Primera</span>
                  <svg width="16" height="16" fill="none" viewBox="0 0 20 20" className="h-4 w-4 sm:h-5 sm:w-5">
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
                  className={`rounded-full h-8 w-8 sm:h-9 sm:w-9 ${page === 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-[#18b0a4]/10"}`}
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  aria-label="Anterior"
                >
                  <span className="sr-only">Anterior</span>
                  <svg width="16" height="16" fill="none" viewBox="0 0 20 20" className="h-4 w-4 sm:h-5 sm:w-5">
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
                  className={`rounded-full h-8 w-8 sm:h-9 sm:w-9 ${page === totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-[#18b0a4]/10"}`}
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  aria-label="Siguiente"
                >
                  <span className="sr-only">Siguiente</span>
                  <svg width="16" height="16" fill="none" viewBox="0 0 20 20" className="h-4 w-4 sm:h-5 sm:w-5">
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
                  className={`rounded-full h-8 w-8 sm:h-9 sm:w-9 ${page === totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-[#18b0a4]/10"}`}
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  aria-label="Última"
                >
                  <span className="sr-only">Última</span>
                  <svg width="16" height="16" fill="none" viewBox="0 0 20 20" className="h-4 w-4 sm:h-5 sm:w-5">
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

      {/* Project Create/Edit Modal */}
      <CreateProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        isEditing={isEditingProject}
        currentProject={currentProject}
        initialCompanyId={selectedCompanyFilter} // Pass filter as initial company for new projects
        onProjectCreated={handleProjectCreatedOrUpdated}
      />

      {/* Confirmation Dialog for Project Deletion */}
      <ConfirmationDialog
        isOpen={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Confirmar Eliminación"
        description="¿Estás seguro de que quieres eliminar este proyecto? Esta acción eliminará también todas las encuestas asociadas."
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </DashboardLayout>
  )
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <ProjectsPageContent />
    </Suspense>
  )
}