"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Building2, Copy, Loader2, Pencil, Plus, Settings, Eye, BarChart3 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase-browser"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default function ProjectDetailPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()

  type Project = {
    id: string
    name: string
    description?: string | null
    objective?: string | null
    company_id: string
    created_by?: string
    created_at?: string
    updated_at?: string
    companies?: {
      name: string
      logo?: string | null
    } | null
  }

  type Survey = {
    id: string
    title: string
    description: string
    status: string
    deadline: string
    project_id?: string
    projects?: {
      id: string
      name: string
      company_id?: string
      companies?: {
        id: string
        name: string
      }
    }
    responses?: number
  }

  const [project, setProject] = useState<Project | null>(null)
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Paginación y búsqueda
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const fetchProjectAndSurveys = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch project details
        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select("*, companies(name, logo)")
          .eq("id", params.id)
          .single()

        if (projectError) throw projectError
        setProject(projectData)

        // Fetch surveys for this project
        const { data: surveysData, error: surveysError } = await supabase
          .from("surveys")
          .select(
            "id, title, description, status, deadline, project_id, projects(id, name, company_id, companies(id, name))",
          )
          .eq("project_id", params.id)
          .order("created_at", { ascending: false })

        if (surveysError) throw surveysError

        // Fetch all responses to count them
        const { data: responsesData } = await supabase.from("responses").select("survey_id")

        // Count responses by survey_id in JS
        const responsesCountMap: Record<string, number> = {}
        ;(responsesData || []).forEach((r: any) => {
          responsesCountMap[r.survey_id] = (responsesCountMap[r.survey_id] || 0) + 1
        })

        // Map surveys and attach response count
        const mappedSurveys = (surveysData || []).map((s: any) => {
          const projectObj = Array.isArray(s.projects) ? s.projects[0] : s.projects
          const companyObj =
            projectObj && Array.isArray(projectObj.companies) ? projectObj.companies[0] : projectObj?.companies
          return {
            ...s,
            projects: projectObj ? { ...projectObj, companies: companyObj } : undefined,
            responses: responsesCountMap[s.id] || 0,
          }
        })
        setSurveys(mappedSurveys)
      } catch (err: any) {
        setError(err.message || "No se pudo cargar el proyecto o las encuestas")
        toast({
          title: "Error",
          description: err.message || "No se pudo cargar el proyecto o las encuestas",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }
    if (user && params.id) fetchProjectAndSurveys()
  }, [user, params.id, toast])

  if (authLoading || !user) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }

  const isAdmin = user.role === "admin"
  const isSupervisor = user.role === "supervisor"

  // Filters and search
  const filteredSurveys = surveys.filter((survey: any) => {
    const matchesSearch =
      survey.title.toLowerCase().includes(search.toLowerCase()) ||
      (survey.description && survey.description.toLowerCase().includes(search.toLowerCase()))
    return !search || matchesSearch
  })

  // Pagination
  const totalPages = Math.ceil(filteredSurveys.length / pageSize) || 1
  const paginatedSurveys = filteredSurveys.slice((page - 1) * pageSize, page * pageSize)

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-8 bg-[#f7faf9] min-h-screen">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-2 mb-2 sm:mb-0">
                <Button variant="ghost" size="icon" onClick={() => router.push("/projects")}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold">{project?.name}</h1>
                  <div className="text-muted-foreground text-sm flex items-center gap-1">
                    <Building2 className="h-4 w-4 text-[#18b0a4]" />
                    <span>{project?.companies?.name || "-"}</span>
                  </div>
                </div>
              </div>
              <Button
                className="mt-10 gap-2 w-full sm:w-auto bg-[#18b0a4] hover:bg-[#18b0a4]/90"
                onClick={() => router.push(`/projects/${params.id}/create-survey`)}
              >
                <Plus className="h-4 w-4" /> Crear Encuesta
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <input
                className="w-full sm:w-80 px-4 py-2 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-0 focus-visible:ring-0 !focus:ring-0 !focus-visible:ring-0 focus:outline-none text-gray-900 placeholder:text-gray-400 shadow-sm transition"
                type="text"
                placeholder="🔍 Buscar por título o descripción..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>

            <h2 className="text-xl font-semibold mb-4 ml-10">Encuestas del Proyecto</h2>

            {filteredSurveys.length === 0 ? (
              <div className="text-center p-8 border rounded-lg bg-muted/50">
                <h3 className="text-lg font-medium mb-2">No hay encuestas disponibles</h3>
                <p className="text-muted-foreground mb-4">No se encontraron encuestas para este proyecto.</p>
                {(isAdmin || isSupervisor) && (
                  <Button onClick={() => router.push(`/projects/${params.id}/create-survey`)}>
                    <Plus className="h-4 w-4 mr-2" /> Crear tu primera encuesta
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl shadow border border-[#18b0a4]/20 bg-white">
                  <Table className="min-w-[900px]">
                    <TableHeader className="bg-[#18b0a4]/10">
                      <TableRow>
                        <TableHead className="text-[#18b0a4] font-bold">Título</TableHead>
                        <TableHead className="text-[#18b0a4] font-bold">Descripción</TableHead>
                        <TableHead className="text-[#18b0a4] font-bold">Estado</TableHead>
                        <TableHead className="text-[#18b0a4] font-bold">Respuestas</TableHead>
                        <TableHead className="text-[#18b0a4] font-bold">Fecha límite</TableHead>
                        <TableHead className="text-[#18b0a4] font-bold">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSurveys.map((survey: any) => {
                        return (
                          <TableRow key={survey.id} className="hover:bg-[#18b0a4]/5 transition group">
                            <TableCell className="font-semibold text-gray-900 group-hover:text-[#18b0a4]">
                              {survey.title}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm line-clamp-2 max-w-[250px]">
                              {survey.description}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  survey.status === "active"
                                    ? "default"
                                    : survey.status === "completed"
                                      ? "outline"
                                      : "secondary"
                                }
                                className="capitalize border border-[#18b0a4]/40 bg-[#18b0a4]/10 text-[#18b0a4] font-semibold"
                              >
                                {survey.status === "active"
                                  ? "Activa"
                                  : survey.status === "completed"
                                    ? "Completada"
                                    : "Borrador"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <BarChart3 className="h-4 w-4 text-[#18b0a4]" />
                                <span>{survey.responses ?? 0}</span>
                              </div>
                            </TableCell>
                            <TableCell>{survey.deadline || "-"}</TableCell>
                            <TableCell className="flex space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[#18b0a4] hover:bg-[#18b0a4]/10 flex items-center gap-1"
                                onClick={() => router.push(`/surveys/${survey.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {(isAdmin || isSupervisor) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-[#18b0a4] hover:bg-[#18b0a4]/10 flex items-center gap-1"
                                  onClick={() => router.push(`/projects/${survey.id}/create-survey`)}
                                  
                                >
                                  <Pencil className="w-4 h-4 cursor-pointer" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[#18b0a4] hover:bg-[#18b0a4]/10 flex items-center gap-1"
                                onClick={() => {
                                  /* Implement copy logic */
                                }}
                              >
                                <Copy className="w-4 h-4 cursor-pointer" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[#18b0a4] hover:bg-[#18b0a4]/10 flex items-center gap-1"
                                onClick={() => router.push(`/surveys/${survey.id}?tab=settings`)}
                              >
                                <Settings className="w-4 h-4 cursor-pointer" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
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
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
