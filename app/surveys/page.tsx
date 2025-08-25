"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Plus, Loader2, AlertCircle, Eye, Pencil, Trash2, Copy } from "lucide-react"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase-browser"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription as ShadcnDialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Combobox } from "@/components/ui/combobox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { CreateProjectModal } from "@/components/create-project-modal"

type Survey = {
  id: string
  title: string
  description: string | null
  status: string
  created_at: string
  project_id: string
  // company_id is not directly on surveys table, but derived via projects
  projects?: {
    id: string
    name: string
    company_id: string // Added company_id to projects type for easier access
    companies: {
      id: string
      name: string
    } | null
  } | null
  responses_count?: number
}

type Company = {
  id: string
  name: string
  projects_count?: number
}

type Project = {
  id: string
  name: string
  company_id: string
}

export default function SurveysPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [surveys, setSurveys] = useState<Survey[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal states for creating new survey
  const [isCreateSurveyModalOpen, setIsCreateSurveyModalOpen] = useState(false)
  const [modalSelectedCompanyId, setModalSelectedCompanyId] = useState<string | null>(null)
  const [modalSelectedProjectId, setModalSelectedProjectId] = useState<string | null>(null)
  const [isCreatingSurvey, setIsCreatingSurvey] = useState(false)

  // Confirmation dialog state
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [surveyToDeleteId, setSurveyToDeleteId] = useState<string | null>(null)

  // Project creation modal state (opened from survey creation modal)
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false)

  // Search and filter states
  const [search, setSearch] = useState("")
  const [filterCompanyId, setFilterCompanyId] = useState<string | null>(null)
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const isAdmin = user?.role === "admin"
  const isSupervisor = user?.role === "supervisor"

  const companyOptions = companies.map((company) => ({
    label: company.name,
    value: company.id,
  }))

  // Project options for the survey creation modal, filtered by the selected company in the modal
  const projectOptionsForModal = projects
    .filter((p) => (modalSelectedCompanyId ? p.company_id === modalSelectedCompanyId : true))
    .map((p) => ({ label: p.name, value: p.id }))

  const hasProjectsForSelectedCompanyInModal = projectOptionsForModal.length > 0

  // Get projectId from URL if present (this will now be updated by filter changes)
  const projectIdFromUrl = searchParams.get("projectId")

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  // Effect to read URL search parameters and apply them as filters
  useEffect(() => {
    const projectIdFromUrlParam = searchParams.get("projectId")
    const companyIdFromUrlParam = searchParams.get("companyId")

    // Set states based on URL. These will trigger fetchInitialData.
    setFilterProjectId(projectIdFromUrlParam || null)
    setFilterCompanyId(companyIdFromUrlParam || null)
    setSearch("") // Clear search when filters change from URL
    setPage(1)
  }, [searchParams])

  const fetchInitialData = useCallback(async () => {
    setLoading(true)
    setError(null)

    // Fetch companies and projects first, as they are needed for comboboxes and filtering logic
    const { data: companiesData, error: companiesError } = await supabase
      .from("companies")
      .select("id, name, projects(id)")
      .order("name", { ascending: true })

    if (companiesError) {
      setError(companiesError.message)
      setLoading(false)
      return
    }
    const mappedCompanies = (companiesData || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      projects_count: c.projects ? c.projects.length : 0,
    }))
    setCompanies(mappedCompanies)

    const { data: projectsData, error: projectsError } = await supabase
      .from("projects")
      .select("id, name, company_id")
      .order("name", { ascending: true })

    if (projectsError) {
      setError(projectsError.message)
      setLoading(false)
      return
    }
    setProjects(projectsData || [])

    // --- Survey Fetching Logic ---
    let surveyQuery = supabase
      .from("surveys")
      .select(
        `
        id,
        title,
        description,
        status,
        created_at,
        project_id,
        projects (
          id,
          name,
          company_id,
          companies (
            id,
            name
          )
        ),
        responses(count)
      `,
      )
      .order("created_at", { ascending: false })

    // Apply project filter if present
    if (filterProjectId) {
      surveyQuery = surveyQuery.eq("project_id", filterProjectId)
    } else if (filterCompanyId) {
      // If only company filter is present, find all projects for that company
      const projectsForCompany = (projectsData || []).filter((p) => p.company_id === filterCompanyId)
      const projectIds = projectsForCompany.map((p) => p.id)
      if (projectIds.length > 0) {
        surveyQuery = surveyQuery.in("project_id", projectIds)
      } else {
        // If company has no projects, no surveys will match
        setSurveys([])
        setLoading(false)
        return
      }
    }

    const { data: surveysData, error: surveysError } = await surveyQuery

    if (surveysError) {
      setError(surveysError.message)
    } else {
      const mappedSurveys = (surveysData || []).map((survey: any) => ({
        ...survey,
        responses_count: survey.responses[0]?.count || 0,
      }))
      setSurveys(mappedSurveys)
    }
    setLoading(false)
  }, [user, filterCompanyId, filterProjectId]) // Dependencies for useCallback

  useEffect(() => {
    if (user) {
      fetchInitialData()
    }
  }, [user, fetchInitialData]) // Trigger fetch when user or fetchInitialData (due to filter changes) updates

  // Reset project selection when company changes in the modal
  useEffect(() => {
    setModalSelectedProjectId(null)
  }, [modalSelectedCompanyId])

  if (authLoading || !user) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }

  // Client-side filtering for search term only, as company/project filters are now server-side
  const filteredSurveys = surveys.filter((survey) => {
    const matchesSearch =
      survey.title.toLowerCase().includes(search.toLowerCase()) ||
      (survey.description || "").toLowerCase().includes(search.toLowerCase()) ||
      (survey.projects?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (survey.projects?.companies?.name || "").toLowerCase().includes(search.toLowerCase())

    return matchesSearch
  })

  const totalPages = Math.ceil(filteredSurveys.length / pageSize) || 1
  const paginatedSurveys = filteredSurveys.slice((page - 1) * pageSize, page * pageSize)

  const handleCreateSurvey = async () => {
    if (!modalSelectedCompanyId || !modalSelectedProjectId) {
      toast({
        title: "Error",
        description: "Por favor, selecciona una empresa y un proyecto.",
        variant: "destructive",
      })
      return
    }

    setIsCreatingSurvey(true)
    // Redirect to the create survey page with selected project ID
    router.push(`/projects/${modalSelectedProjectId}/create-survey`)
    setIsCreateSurveyModalOpen(false)
    setIsCreatingSurvey(false)
  }

  const handleDuplicateSurvey = async (surveyId: string) => {
    setLoading(true)
    setError(null)

    const { data: originalSurvey, error: fetchError } = await supabase
      .from("surveys")
      .select("*")
      .eq("id", surveyId)
      .single()

    if (fetchError) {
      setError(fetchError.message)
      toast({
        title: "Error al duplicar",
        description: `No se pudo obtener la encuesta original: ${fetchError.message}`,
        variant: "destructive",
      })
      setLoading(false)
      return
    }

    // Create a new survey object with a new title
    const newSurvey = {
      ...originalSurvey,
      id: undefined, // Let Supabase generate a new ID
      title: `${originalSurvey.title} (Copia)`,
      created_at: undefined, // Let Supabase set new timestamp
      updated_at: undefined, // Let Supabase set new timestamp
      status: "draft", // Set status to draft for duplicated survey
    }

    const { error: insertError } = await supabase.from("surveys").insert(newSurvey)

    if (insertError) {
      setError(insertError.message)
      toast({
        title: "Error al duplicar",
        description: `No se pudo duplicar la encuesta: ${insertError.message}`,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Encuesta duplicada",
        description: `La encuesta "${newSurvey.title}" ha sido creada exitosamente.`,
      })
      fetchInitialData() // Re-fetch surveys to update the list
    }
    setLoading(false)
  }

  const handleDeleteClick = (surveyId: string) => {
    setSurveyToDeleteId(surveyId)
    setIsConfirmDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!surveyToDeleteId) return

    setIsConfirmDialogOpen(false)
    setLoading(true)
    setError(null)

    const { error: deleteError } = await supabase.from("surveys").delete().eq("id", surveyToDeleteId)

    if (deleteError) {
      setError(deleteError.message)
      toast({
        title: "Error al eliminar",
        description: `No se pudo eliminar la encuesta: ${deleteError.message}`,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Encuesta eliminada",
        description: "La encuesta ha sido eliminada exitosamente.",
      })
      setSurveys(surveys.filter((survey) => survey.id !== surveyToDeleteId))
    }
    setLoading(false)
    setSurveyToDeleteId(null)
  }

  const handleProjectCreated = async (newProject: Project) => {
    // Re-fetch projects to update the combobox options in the survey creation modal
    await fetchInitialData()
    // Automatically select the newly created project
    setModalSelectedProjectId(newProject.id)
    setIsCreateProjectModalOpen(false) // Close the project creation modal
    // Keep the survey creation modal open
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-8 bg-[#f7faf9] min-h-screen">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#18b0a4]">Encuestas</h1>
            <p className="mt-2 text-gray-500">Gestiona todas las encuestas de la plataforma.</p>
          </div>
          {(isAdmin || isSupervisor) && (
            <Button
              onClick={() => {
                // If a project is selected via URL param (from direct navigation or filter)
                if (projectIdFromUrl) {
                  router.push(`/projects/${projectIdFromUrl}/create-survey`)
                } else {
                  // Otherwise, open the modal to select company/project
                  setIsCreateSurveyModalOpen(true)
                }
              }}
              className="bg-[#18b0a4] hover:bg-[#18b0a4]/90"
            >
              <Plus className="h-4 w-4 mr-2" /> Nueva Encuesta
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Input
            className="w-full sm:w-80 px-4 py-2 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-0 focus-visible:ring-0 !focus:ring-0 !focus-visible:ring-0 focus:outline-none text-gray-900 placeholder:text-gray-400 shadow-sm transition"
            type="text"
            placeholder="🔍 Buscar por título, proyecto o empresa..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
          <Combobox
            options={companyOptions}
            value={
              filterProjectId ? projects.find((p) => p.id === filterProjectId)?.company_id || "" : filterCompanyId || ""
            }
            onValueChange={(value) => {
              setFilterCompanyId(value)
              setFilterProjectId(null) // Reset project filter when company filter changes
              setPage(1)

              // Update URL search params
              const newSearchParams = new URLSearchParams(searchParams.toString())
              if (value) {
                newSearchParams.set("companyId", value)
              } else {
                newSearchParams.delete("companyId")
              }
              newSearchParams.delete("projectId") // Always clear project when company changes
              router.replace(`?${newSearchParams.toString()}`)
            }}
            placeholder="Filtrar por empresa..."
            searchPlaceholder="Buscar empresa..."
            emptyMessage="No se encontraron empresas."
            className="w-full sm:w-60"
          />
          <Combobox
            options={projects
              .filter((p) => (filterCompanyId ? p.company_id === filterCompanyId : true))
              .map((p) => ({ label: p.name, value: p.id }))}
            value={filterProjectId || ""}
            onValueChange={(value) => {
              setFilterProjectId(value)
              setPage(1)

              // Update URL search params
              const newSearchParams = new URLSearchParams(searchParams.toString())
              if (value) {
                newSearchParams.set("projectId", value)
                // If a project is selected, ensure its company is also in the URL
                const selectedProject = projects.find((p) => p.id === value)
                if (selectedProject && selectedProject.company_id) {
                  newSearchParams.set("companyId", selectedProject.company_id)
                }
              } else {
                newSearchParams.delete("projectId")
              }
              router.replace(`?${newSearchParams.toString()}`)
            }}
            placeholder="Filtrar por proyecto..."
            searchPlaceholder="Buscar proyecto..."
            emptyMessage={
              filterCompanyId ? "No se encontraron proyectos para esta empresa." : "Selecciona una empresa primero."
            }
            disabled={!filterCompanyId} // Disable if no company is selected for filtering
            className="w-full sm:w-60"
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
        ) : filteredSurveys.length === 0 ? (
          <div className="text-center p-8 border rounded-lg bg-muted/50">
            <h3 className="text-lg font-medium mb-2">No hay encuestas disponibles</h3>
            <p className="text-muted-foreground mb-4">No se encontraron encuestas para mostrar.</p>
            {(isAdmin || isSupervisor) && (
              <Button
                onClick={() => {
                  // If a project is selected via URL param (from direct navigation or filter)
                  if (projectIdFromUrl) {
                    router.push(`/projects/${projectIdFromUrl}/create-survey`)
                  } else {
                    // Otherwise, open the modal to select company/project
                    setIsCreateSurveyModalOpen(true)
                  }
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> Crear tu primera encuesta
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl shadow border border-[#18b0a4]/20 bg-white">
              <Table className="min-w-[1000px]">
                <TableHeader className="bg-[#18b0a4]/10">
                  <TableRow>
                    <TableHead className="text-[#18b0a4] font-bold">Título</TableHead>
                    <TableHead className="text-[#18b0a4] font-bold">Proyecto</TableHead>
                    <TableHead className="text-[#18b0a4] font-bold">Empresa</TableHead>
                    <TableHead className="text-[#18b0a4] font-bold">Estado</TableHead>
                    <TableHead className="text-[#18b0a4] font-bold text-center">Respuestas</TableHead>
                    <TableHead className="text-[#18b0a4] font-bold">Fecha Creación</TableHead>
                    <TableHead className="text-[#18b0a4] font-bold text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSurveys.map((survey) => (
                    <TableRow key={survey.id} className="hover:bg-[#18b0a4]/5 transition group">
                      <TableCell className="font-semibold text-gray-900 group-hover:text-[#18b0a4]">
                        {survey.title}
                      </TableCell>
                      <TableCell className="text-gray-700">{survey.projects?.name || "N/A"}</TableCell>
                      <TableCell className="text-gray-700">{survey.projects?.companies?.name || "N/A"}</TableCell>
                      <TableCell className="text-gray-700 capitalize">{survey.status}</TableCell>
                      <TableCell className="text-center text-gray-700">{survey.responses_count ?? 0}</TableCell>
                      <TableCell className="text-gray-700">
                        {new Date(survey.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-[#18b0a4] hover:bg-[#18b0a4]/10"
                          onClick={() => router.push(`/surveys/${survey.id}`)}
                          title="Ver Encuesta"
                        >
                          <span className="sr-only">Ver Encuesta</span>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(isAdmin || isSupervisor) && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-[#18b0a4] hover:bg-[#18b0a4]/10"
                              onClick={() =>
                                router.push(`/projects/${survey.project_id}/create-survey?surveyId=${survey.id}`)
                              }
                              title="Editar Encuesta"
                            >
                              <span className="sr-only">Editar Encuesta</span>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-blue-500 hover:bg-blue-500/10"
                              onClick={() => handleDuplicateSurvey(survey.id)}
                              title="Duplicar Encuesta"
                            >
                              <span className="sr-only">Duplicar Encuesta</span>
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:bg-red-500/10"
                              onClick={() => handleDeleteClick(survey.id)}
                              title="Eliminar Encuesta"
                            >
                              <span className="sr-only">Eliminar Encuesta</span>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
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
                <span className="ml-2">({filteredSurveys.length} resultados)</span>
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

      {/* Create New Survey Modal */}
      <Dialog open={isCreateSurveyModalOpen} onOpenChange={setIsCreateSurveyModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Crear Nueva Encuesta</DialogTitle>
            <ShadcnDialogDescription>
              Selecciona la empresa y el proyecto para el que deseas crear la encuesta.
            </ShadcnDialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company-select">Empresa</Label>
              <Combobox
                options={companyOptions}
                value={modalSelectedCompanyId || ""}
                onValueChange={(value) => {
                  setModalSelectedCompanyId(value)
                }}
                placeholder="Selecciona una empresa..."
                searchPlaceholder="Buscar empresa..."
                emptyMessage="No se encontraron empresas."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-select">Proyecto</Label>
              <Combobox
                options={projectOptionsForModal}
                value={modalSelectedProjectId || ""}
                onValueChange={(value) => {
                  setModalSelectedProjectId(value)
                }}
                placeholder="Selecciona un proyecto..."
                searchPlaceholder="Buscar proyecto..."
                emptyMessage={
                  modalSelectedCompanyId
                    ? "No se encontraron proyectos para esta empresa."
                    : "Selecciona una empresa primero."
                }
                disabled={!modalSelectedCompanyId} // Disable if no company is selected
              />
            </div>
            {modalSelectedCompanyId && !hasProjectsForSelectedCompanyInModal && (
              <div className="text-center mt-4">
                <p className="text-sm text-gray-600 mb-2">La empresa seleccionada no tiene proyectos.</p>
                <Button
                  onClick={() => setIsCreateProjectModalOpen(true)}
                  variant="outline"
                  className="bg-[#18b0a4] text-white hover:bg-[#18b0a4]/90"
                >
                  <Plus className="h-4 w-4 mr-2" /> Crear Proyecto para esta Empresa
                </Button>
              </div>
            )}
          </div>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
            <Button variant="outline" onClick={() => setIsCreateSurveyModalOpen(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button
              onClick={handleCreateSurvey}
              disabled={isCreatingSurvey || !modalSelectedProjectId}
              className="bg-[#18b0a4] hover:bg-[#18b0a4]/90 w-full sm:w-auto"
            >
              {isCreatingSurvey ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando...
                </>
              ) : (
                "Crear Encuesta"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Survey Deletion */}
      <ConfirmationDialog
        isOpen={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Confirmar Eliminación"
        description="¿Estás seguro de que quieres eliminar esta encuesta? Esta acción es irreversible."
        confirmText="Eliminar"
        cancelText="Cancelar"
      />

      {/* Create Project Modal (opened from Survey Creation Modal) */}
      <CreateProjectModal
        isOpen={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
        initialCompanyId={modalSelectedCompanyId}
        onProjectCreated={handleProjectCreated}
      />
    </DashboardLayout>
  )
}
