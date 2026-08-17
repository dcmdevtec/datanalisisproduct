"use client"

import { useEffect, useState, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Plus, Loader2, AlertCircle, Eye, Pencil, Trash2, Copy, FileText, LayoutGrid, LayoutList, Download, MoreHorizontal, BarChart3 } from "lucide-react"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

function SurveysPageContent() {
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
  // Vista cards/tabla — persiste en localStorage
  const [viewType, setViewType] = useState<'table' | 'cards'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('surveys_viewType')
      if (saved === 'table' || saved === 'cards') return saved
    }
    return 'table'
  })

  useEffect(() => {
    localStorage.setItem('surveys_viewType', viewType)
  }, [viewType])

  // Sin permisos - todos los usuarios pueden hacer todo
  // const isAdmin = user?.role === "admin"
  // const isSupervisor = user?.role === "supervisor"

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
    setProjects((projectsData || []) as any)

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
  const projectsForCompany = ((projectsData as any) || []).filter((p: any) => p.company_id === filterCompanyId)
  const projectIds = (projectsForCompany as any[]).map((p: any) => p.id)
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

  // AUDITORÍA (2026-08-17): "Descargar PDF" abría /api/surveys/[id]/pdf con
  // window.open — esa ruta exige rol admin/supervisor (requireRole), así que
  // si el usuario no tenía permiso, la pestaña nueva mostraba el JSON crudo
  // del error ({"error": "..."}) en vez de un mensaje claro (checklist:
  // "Mostrar errores claros de permisos... en lugar de fallar
  // silenciosamente"). Se reemplaza por fetch + toast, y solo se dispara la
  // descarga si la respuesta realmente es el PDF.
  const handleDownloadPdf = async (surveyId: string, surveyTitle?: string) => {
    try {
      const res = await fetch(`/api/surveys/${surveyId}/pdf`)
      if (!res.ok) {
        let message = "No se pudo generar el PDF."
        if (res.status === 401 || res.status === 403) {
          message = "No tienes permiso para descargar el PDF de esta encuesta."
        } else {
          const body = await res.json().catch(() => null)
          if (body?.error) message = body.error
        }
        toast({ title: "No se pudo descargar", description: message, variant: "destructive" })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `encuesta-${(surveyTitle || surveyId).replace(/[^a-z0-9]/gi, "_").substring(0, 40)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      toast({
        title: "No se pudo descargar",
        description: err?.message || "Error de conexión al generar el PDF.",
        variant: "destructive",
      })
    }
  }

  const handleDuplicateSurvey = async (surveyId: string) => {
    setLoading(true)
    setError(null)

    try {
      // 1. Obtener la encuesta original
      const { data: originalSurvey, error: fetchError } = await supabase
        .from("surveys")
        .select("*")
        .eq("id", surveyId)
        .single()

      if (fetchError || !originalSurvey) {
        throw new Error(fetchError?.message ?? "No se pudo obtener la encuesta original")
      }

      // 2. Obtener secciones y preguntas de la encuesta original
      const { data: sectionsData, error: sectionsError } = await supabase
        .from("survey_sections")
        .select(`
          id, title, title_html, description, order_num, skip_logic,
          questions (
            id, type, text, text_html, options, required, order_num,
            file_url, matrix_rows, matrix_cols, rating, settings,
            display_logic, skip_logic, validation_rules,
            question_config, matrix, comment_box, style, parent_id
          )
        `)
        .eq("survey_id", surveyId)
        .order("order_num", { ascending: true })

      if (sectionsError) {
        throw new Error(sectionsError.message)
      }

      // 3. Crear la nueva encuesta (sin ID, sin timestamps, en draft)
      const { id: _id, created_at: _ca, updated_at: _ua, ...surveyFields } = originalSurvey as any
      const newSurveyPayload = {
        ...surveyFields,
        title: `${originalSurvey.title} (Copia)`,
        status: "draft",
      }

      const { data: newSurvey, error: insertSurveyError } = await supabase
        .from("surveys")
        .insert(newSurveyPayload)
        .select()
        .single()

      if (insertSurveyError || !newSurvey) {
        throw new Error(insertSurveyError?.message ?? "No se pudo crear la encuesta duplicada")
      }

      const newSurveyId = (newSurvey as any).id

      // 4. Clonar secciones y preguntas manteniendo el orden
      for (const section of (sectionsData ?? [])) {
        const newSectionId = crypto.randomUUID()

        const { error: sectionInsertError } = await (supabase as any)
          .from("survey_sections")
          .insert({
            id: newSectionId,
            survey_id: newSurveyId,
            title: section.title,
            title_html: (section as any).title_html ?? null,
            description: section.description ?? null,
            order_num: section.order_num,
            skip_logic: section.skip_logic ?? null,
          })

        if (sectionInsertError) {
          throw new Error(`Error al clonar sección "${section.title}": ${sectionInsertError.message}`)
        }

        // 5. Clonar preguntas de esta sección
        const questions: any[] = (section as any).questions ?? []
        if (questions.length > 0) {
          const questionInserts = questions.map((q: any) => ({
            id: crypto.randomUUID(),
            survey_id: newSurveyId,
            section_id: newSectionId,
            type: q.type,
            text: q.text ?? "",
            text_html: q.text_html ?? null,
            options: q.options ?? [],
            required: q.required ?? true,
            order_num: q.order_num,
            file_url: q.file_url ?? null,
            matrix_rows: q.matrix_rows ?? [],
            matrix_cols: q.matrix_cols ?? [],
            rating: q.rating ?? null,
            settings: q.settings ?? {},
            display_logic: q.display_logic ?? null,
            skip_logic: q.skip_logic ?? null,
            validation_rules: q.validation_rules ?? null,
            question_config: q.question_config ?? null,
            matrix: q.matrix ?? null,
            comment_box: q.comment_box ?? null,
            style: q.style ?? null,
            parent_id: null, // no copiar referencias a preguntas de la encuesta original
          }))

          const { error: questionsInsertError } = await supabase
            .from("questions")
            .insert(questionInserts)

          if (questionsInsertError) {
            throw new Error(`Error al clonar preguntas de sección "${section.title}": ${questionsInsertError.message}`)
          }
        }
      }

      toast({
        title: "Encuesta duplicada",
        description: `"${originalSurvey.title} (Copia)" creada con ${sectionsData?.length ?? 0} sección(es) y todas sus preguntas.`,
      })
      fetchInitialData()
    } catch (err: any) {
      setError(err.message)
      toast({
        title: "Error al duplicar",
        description: err.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
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
      <div className="p-4 sm:p-6 lg:p-8 bg-[#f7faf9] min-h-screen">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 lg:mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18b0a4]">
              <FileText className="inline-block mr-2 h-6 w-6 sm:h-8 sm:w-8 text-[#18b0a4]" />
              Encuestas
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-500">Gestiona todas las encuestas de la plataforma.</p>
          </div>
          <Button
            onClick={() => {
              // Si hay un projectId en la URL, navegar directamente a crear encuesta
              if (projectIdFromUrl) {
                router.push(`/projects/${projectIdFromUrl}/create-survey`)
              } else {
                // Si no hay projectId, mostrar el modal de selección
                setModalSelectedCompanyId(null)
                setModalSelectedProjectId(null)
                setIsCreateSurveyModalOpen(true)
              }
            }}
            className="bg-[#18b0a4] hover:bg-[#18b0a4]/90 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" /> Nueva Encuesta
          </Button>
        </div>
        {/* Botones para alternar vista (íconos estilo Google Drive) */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={viewType === 'table' ? 'default' : 'outline'}
            onClick={() => setViewType('table')}
            title="Ver en lista"
            className="h-9 w-9 flex items-center justify-center"
          >
            <span className="sr-only">Lista</span>
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={viewType === 'cards' ? 'default' : 'outline'}
            onClick={() => setViewType('cards')}
            title="Ver en cuadricula"
            className="h-9 w-9 flex items-center justify-center"
          >
            <span className="sr-only">Cuadrícula</span>
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-col gap-4 mb-6 lg:mb-8">
          <Input
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-0 focus-visible:ring-0 !focus:ring-0 !focus-visible:ring-0 focus:outline-none text-gray-900 placeholder:text-gray-400 shadow-sm transition"
            type="text"
            placeholder="🔍 Buscar por título, proyecto o empresa..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
          <div className="flex flex-col sm:flex-row gap-4">
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
            />
          </div>
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
          <div className="text-center p-6 sm:p-8 border rounded-lg bg-muted/50">
            <h3 className="text-lg sm:text-xl font-medium mb-2">No hay encuestas disponibles</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">No se encontraron encuestas para mostrar.</p>
            <Button
              onClick={() => {
                // Si hay un projectId en la URL, navegar directamente a crear encuesta
                if (projectIdFromUrl) {
                  router.push(`/projects/${projectIdFromUrl}/create-survey`)
                } else {
                  // Si no hay projectId, mostrar el modal de selección
                  setModalSelectedCompanyId(null)
                  setModalSelectedProjectId(null)
                  setIsCreateSurveyModalOpen(true)
                }
              }}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" /> Crear tu primera encuesta
            </Button>
          </div>
        ) : (
          <>
            {viewType === 'table' ? (
              <div className="overflow-x-auto rounded-xl shadow border border-[#18b0a4]/20 bg-white">
                <Table className="w-full">
                  <TableHeader className="bg-[#18b0a4]/10">
                    <TableRow>
                      <TableHead className="text-[#18b0a4] font-bold px-2 sm:px-4">Título</TableHead>
                      <TableHead className="text-[#18b0a4] font-bold px-2 sm:px-4 hidden sm:table-cell">Proyecto</TableHead>
                      <TableHead className="text-[#18b0a4] font-bold px-2 sm:px-4 hidden lg:table-cell">Empresa</TableHead>
                      <TableHead className="text-[#18b0a4] font-bold px-2 sm:px-4">Estado</TableHead>
                      <TableHead className="text-[#18b0a4] font-bold text-center px-2 sm:px-4">Respuestas</TableHead>
                      <TableHead className="text-[#18b0a4] font-bold px-2 sm:px-4 hidden md:table-cell">Fecha Creación</TableHead>
                      <TableHead className="text-[#18b0a4] font-bold text-center px-2 sm:px-4">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSurveys.map((survey) => (
                      <TableRow key={survey.id} className="hover:bg-[#18b0a4]/5 transition group">
                        <TableCell className="font-semibold text-gray-900 group-hover:text-[#18b0a4] px-2 sm:px-4">
                          <div className="truncate max-w-[120px] sm:max-w-[150px] lg:max-w-[200px]" title={survey.title}>
                            {survey.title}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-700 px-2 sm:px-4 hidden sm:table-cell">
                          <div className="truncate max-w-[100px] lg:max-w-[150px]" title={survey.projects?.name || "N/A"}>
                            {survey.projects?.name || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-700 px-2 sm:px-4 hidden lg:table-cell">
                          <div className="truncate max-w-[100px] lg:max-w-[150px]" title={survey.projects?.companies?.name || "N/A"}>
                            {survey.projects?.companies?.name || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-700 capitalize px-2 sm:px-4">
                          <div className="truncate max-w-[60px] sm:max-w-[80px]">
                            {survey.status === "draft" ? "Prueba" : survey.status}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-gray-700 px-2 sm:px-4">
                          {survey.responses_count ?? 0}
                        </TableCell>
                        <TableCell className="text-gray-700 px-2 sm:px-4 hidden md:table-cell">
                          <div className="truncate max-w-[80px] lg:max-w-[120px]">
                            {new Date(survey.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-center px-2 sm:px-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-[#18b0a4] hover:bg-[#18b0a4]/10 h-7 w-7 sm:h-8 sm:w-8 lg:h-9 lg:w-9"
                              >
                                <span className="sr-only">Abrir acciones</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => router.push(`/surveys/${survey.id}`)}>
                                <Eye className="h-4 w-4 mr-2" /> Ver Encuesta
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/projects/${survey.project_id}/create-survey?surveyId=${survey.id}`)
                                }
                              >
                                <Pencil className="h-4 w-4 mr-2" /> Editar Encuesta
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/reports?survey=${survey.id}`)}>
                                <BarChart3 className="h-4 w-4 mr-2" /> Reporte
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicateSurvey(survey.id)}>
                                <Copy className="h-4 w-4 mr-2" /> Duplicar Encuesta
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadPdf(survey.id, survey.title)}>
                                <Download className="h-4 w-4 mr-2" /> Descargar PDF
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteClick(survey.id)}
                                className="text-red-500 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Eliminar Encuesta
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
                {paginatedSurveys.map((survey) => (
                  <div key={survey.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-[#18b0a4]/20 p-4 sm:p-5 flex flex-col min-h-[320px]">
                    {/* Header */}
                    <div className="mb-4">
                      <h3 className="font-bold text-[#18b0a4] text-base sm:text-lg leading-tight mb-2" title={survey.title}>
                        {survey.title.length > 30 ? `${survey.title.substring(0, 30)}...` : survey.title}
                      </h3>
                      <div className="space-y-1">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium text-gray-900">Proyecto:</span>
                          <span className="ml-1" title={survey.projects?.name || 'N/A'}>
                            {survey.projects?.name && survey.projects.name.length > 25 
                              ? `${survey.projects.name.substring(0, 25)}...` 
                              : (survey.projects?.name || 'N/A')}
                          </span>
                        </p>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium text-gray-900">Empresa:</span>
                          <span className="ml-1" title={survey.projects?.companies?.name || 'N/A'}>
                            {survey.projects?.companies?.name && survey.projects.companies.name.length > 25 
                              ? `${survey.projects.companies.name.substring(0, 25)}...` 
                              : (survey.projects?.companies?.name || 'N/A')}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-3 mb-4">
                      <div className="text-sm">
                        <span className="font-medium text-gray-900">Descripción:</span>
                        <p className="mt-1 text-gray-600 text-sm leading-relaxed">
                          {survey.description && survey.description.length > 60 
                            ? `${survey.description.substring(0, 60)}...` 
                            : (survey.description || 'Sin descripción')}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium text-gray-900">Estado:</span>
                          <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                            survey.status === 'draft' 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : survey.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {survey.status === "draft" ? "Borrador" : survey.status}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-medium text-[#18b0a4]">{survey.responses_count ?? 0}</span>
                          <span className="text-gray-500 text-xs ml-1">respuestas</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-100 pt-4 mt-auto">
                      <div className="flex justify-between items-center mb-3">
                        <div className="text-xs text-gray-400">
                          {new Date(survey.created_at).toLocaleDateString('es-ES', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric' 
                          })}
                        </div>
                      </div>
                      
                      {/* Menú de acciones */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full gap-2 text-gray-700">
                            <MoreHorizontal className="h-4 w-4" /> Acciones
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => router.push(`/surveys/${survey.id}`)}>
                            <Eye className="h-4 w-4 mr-2" /> Ver Encuesta
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => router.push(`/projects/${survey.project_id}/create-survey?surveyId=${survey.id}`)}
                          >
                            <Pencil className="h-4 w-4 mr-2" /> Editar Encuesta
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/reports?survey=${survey.id}`)}>
                            <BarChart3 className="h-4 w-4 mr-2" /> Reporte
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateSurvey(survey.id)}>
                            <Copy className="h-4 w-4 mr-2" /> Duplicar Encuesta
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadPdf(survey.id, survey.title)}>
                            <Download className="h-4 w-4 mr-2" /> Descargar PDF
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(survey.id)}
                            className="text-red-500 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Eliminar Encuesta
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Paginación */}
            <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
              <div className="text-sm text-gray-500 text-center sm:text-left">
                Página <span className="font-semibold text-[#18b0a4]">{page}</span> de{" "}
                <span className="font-semibold text-[#18b0a4]">{totalPages}</span>{" "}
                <span className="ml-2">({filteredSurveys.length} resultados)</span>
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

      {/* Create New Survey Modal */}
      <Dialog open={isCreateSurveyModalOpen} onOpenChange={setIsCreateSurveyModalOpen}>
        <DialogContent className="dialog-content-responsive overflow-hidden flex flex-col">
          <DialogHeader className="text-left pb-4 flex-shrink-0">
            <DialogTitle className="text-lg font-semibold">Crear Nueva Encuesta</DialogTitle>
            <ShadcnDialogDescription className="text-sm text-gray-600">
              Selecciona la empresa y el proyecto para el que deseas crear la encuesta.
            </ShadcnDialogDescription>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-y-auto px-1 min-h-0">
            <div className="space-y-2">
              <Label htmlFor="company-select" className="text-sm font-medium">Empresa</Label>
              <div className="relative">
                <Combobox
                  options={companyOptions}
                  value={modalSelectedCompanyId || ""}
                  onValueChange={(value) => {
                    setModalSelectedCompanyId(value)
                  }}
                  placeholder="Seleccionar empresa..."
                  searchPlaceholder="Buscar empresa..."
                  emptyMessage="No hay empresas disponibles."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-select" className="text-sm font-medium">Proyecto</Label>
              <div className="relative">
                <Combobox
                  options={projectOptionsForModal}
                  value={modalSelectedProjectId || ""}
                  onValueChange={(value) => {
                    setModalSelectedProjectId(value)
                  }}
                  placeholder="Seleccionar proyecto..."
                  searchPlaceholder="Buscar proyecto..."
                  emptyMessage={
                    modalSelectedCompanyId
                      ? "No hay proyectos para esta empresa."
                      : "Selecciona una empresa primero."
                  }
                  disabled={!modalSelectedCompanyId}
                />
              </div>
            </div>
            {modalSelectedCompanyId && !hasProjectsForSelectedCompanyInModal && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                <p className="text-sm text-amber-800 mb-3">La empresa seleccionada no tiene proyectos.</p>
                <Button
                  onClick={() => setIsCreateProjectModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="bg-[#18b0a4] text-white hover:bg-[#18b0a4]/90 border-[#18b0a4]"
                >
                  <Plus className="h-4 w-4 mr-2" /> 
                  <span className="whitespace-nowrap">Crear Proyecto</span>
                </Button>
              </div>
            )}
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-4 border-t mt-4 flex-shrink-0">
            <Button 
              variant="outline" 
              onClick={() => setIsCreateSurveyModalOpen(false)} 
              className="w-full sm:w-auto order-2 sm:order-1"
              size="sm"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateSurvey}
              disabled={isCreatingSurvey || !modalSelectedProjectId}
              className="bg-[#18b0a4] hover:bg-[#18b0a4]/90 w-full sm:w-auto order-1 sm:order-2"
              size="sm"
            >
              {isCreatingSurvey ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                  <span className="whitespace-nowrap">Creando...</span>
                </>
              ) : (
                <span className="whitespace-nowrap">Crear Encuesta</span>
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

export default function SurveysPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <SurveysPageContent />
    </Suspense>
  )
}
