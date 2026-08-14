"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Plus, Loader2, AlertCircle, Building2, FolderKanban, Pencil, Trash2, X, LayoutList, LayoutGrid, Upload, CheckCircle } from "lucide-react"
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
import SupabaseImage from "@/components/supabase-image"
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
  // Vista tabla/cards — persiste en localStorage igual que surveys y projects
  const [viewMode, setViewMode] = useState<'table' | 'card'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('companies_viewMode')
      if (saved === 'table' || saved === 'card') return saved
    }
    return 'card'
  })

  useEffect(() => {
    localStorage.setItem('companies_viewMode', viewMode)
  }, [viewMode])
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
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Archivo inválido",
          description: "Por favor selecciona un archivo de imagen válido.",
          variant: "destructive",
        })
        return
      }

      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Archivo muy grande",
          description: "El archivo debe ser menor a 5MB.",
          variant: "destructive",
        })
        return
      }

      setCompanyLogoFile(file)
      
      // Crear preview usando FileReader
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setCompanyLogo(result) // Mostrar preview temporalmente
      }
      reader.readAsDataURL(file)
      
      console.log('📁 Archivo seleccionado para preview:', file.name, file.type, file.size)
    } else {
      setCompanyLogoFile(null)
      setCompanyLogo(isEditingCompany ? currentCompany?.logo || null : null)
    }
  }

  const uploadCompanyLogo = async (): Promise<string | null> => {
    if (!companyLogoFile) return companyLogo

    try {
      console.log('🔄 Iniciando proceso de subida de logo...')
      console.log('📁 Archivo a subir:', companyLogoFile.name, companyLogoFile.type, companyLogoFile.size)

      // Importar utilidades de storage
      const { uploadImage, generateUniqueFileName, getExtensionFromMimeType, resizeImage } = await import(
        "@/lib/supabase-storage"
      )

      // Redimensionar imagen
      console.log('🖼️ Redimensionando imagen...')
      const resized = await resizeImage(companyLogoFile, 500, 500)
      console.log('✅ Imagen redimensionada:', resized.size)

      // Generar nombre único
      const extension = getExtensionFromMimeType(companyLogoFile.type)
      const fileName = currentCompany?.id
        ? `company_${currentCompany.id}.${extension}`
        : generateUniqueFileName("company_logo", extension)
        
      console.log('📝 Nombre de archivo generado:', fileName)

      // Subir a Storage
      console.log('☁️ Subiendo a Supabase Storage...')
      const publicUrl = await uploadImage("company-logos", fileName, resized)

      console.log('✅ Logo subido exitosamente:', publicUrl)
      return publicUrl
    } catch (error: any) {
      console.error("Error uploading logo:", error)
      throw error
    }
  }

  const handleRemoveCompanyLogo = () => {
    setCompanyLogo(null)
    setCompanyLogoFile(null)
    if (currentCompany) {
      setCurrentCompany({ ...currentCompany, logo: null })
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

    try {
      // Subir imagen si hay una seleccionada
      let finalLogoUrl = companyLogo
      if (companyLogoFile) {
        console.log('📤 Subiendo logo de empresa...')
        finalLogoUrl = await uploadCompanyLogo()
        if (finalLogoUrl) {
          toast({
            title: "Logo subido",
            description: "El logo se ha cargado correctamente.",
          })
        }
      }

      const companyData = {
        name: companyName,
        description: companyDescription,
        logo: finalLogoUrl, // This will be the Storage URL or null
        website: companyWebsite || null,
        contact: companyContact || null,
      }

      let dbError = null
      if (isEditingCompany && currentCompany) {
        const { error } = await (supabase as any).from("companies").update(companyData).eq("id", currentCompany.id)
        dbError = error
      } else {
        const { error } = await (supabase as any).from("companies").insert(companyData)
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
        setCompanyName("")
        setCompanyDescription("")
        setCompanyWebsite("")
        setCompanyContact("")
        setCompanyLogo(null)
        setCompanyLogoFile(null)
        setIsEditingCompany(false)
        setCurrentCompany(null)
        fetchCompanies() // Re-fetch companies to update the list
      }
    } catch (error: any) {
      console.error("Error al procesar empresa:", error)
      setError(`Error al procesar empresa: ${error.message}`)
      toast({
        title: "Error",
        description: `No se pudo ${isEditingCompany ? "actualizar" : "crear"} la empresa: ${error.message}`,
        variant: "destructive",
      })
    } finally {
      setIsSubmittingCompany(false)
    }
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
            <div className="flex gap-2 mt-4">
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                onClick={() => setViewMode('table')}
                title="Ver en lista"
                className="h-9 w-9 flex items-center justify-center"
              >
                <span className="sr-only">Lista</span>
                <LayoutList className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'card' ? 'default' : 'outline'}
                onClick={() => setViewMode('card')}
                title="Ver en cuadricula"
                className="h-9 w-9 flex items-center justify-center"
              >
                <span className="sr-only">Cuadrícula</span>
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
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
                          <SupabaseImage
                            src={company.logo || "/placeholder.svg"}
                            alt={`${company.name} logo`}
                            width={40}
                            height={40}
                            className="rounded-full object-contain"
                            fallbackSrc="/placeholder.svg"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
              {paginatedCompanies.map((company) => (
                <div key={company.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-[#18b0a4]/20 p-4 sm:p-6 flex flex-col min-h-[320px]">
                  {/* Header con logo y nombre */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex-shrink-0">
                      {company.logo ? (
                        <SupabaseImage
                          src={company.logo || "/placeholder.svg"}
                          alt={`${company.name} logo`}
                          width={56}
                          height={56}
                          className="rounded-full object-cover border-2 border-[#18b0a4]/10"
                          fallbackSrc="/placeholder.svg"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#18b0a4]/20 to-[#18b0a4]/10 flex items-center justify-center text-sm font-bold text-[#18b0a4]">
                          {company.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg sm:text-xl font-bold text-[#18b0a4] leading-tight mb-2" title={company.name}>
                        {company.name.length > 20 ? `${company.name.substring(0, 20)}...` : company.name}
                      </h2>
                      {company.description && (
                        <p className="text-gray-600 text-sm leading-relaxed">
                          {company.description.length > 80 
                            ? `${company.description.substring(0, 80)}...` 
                            : company.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Información de contacto */}
                  <div className="flex-1 space-y-3 mb-4">
                    {company.website && (
                      <div className="text-sm">
                        <span className="font-medium text-gray-900 block mb-1">Sitio web:</span>
                        <a
                          href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#18b0a4] hover:text-[#18b0a4]/80 text-xs break-all underline decoration-dotted"
                          title={company.website}
                        >
                          {company.website.length > 30 
                            ? `${company.website.substring(0, 30)}...` 
                            : company.website}
                        </a>
                      </div>
                    )}
                    
                    {company.contact && (
                      <div className="text-sm">
                        <span className="font-medium text-gray-900 block mb-1">Contacto:</span>
                        <p className="text-gray-600 text-xs break-words">
                          {company.contact.length > 40 
                            ? `${company.contact.substring(0, 40)}...` 
                            : company.contact}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer con estadísticas y acciones */}
                  <div className="border-t border-gray-100 pt-4 mt-auto">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <FolderKanban className="h-4 w-4 text-[#18b0a4]" />
                        <span className="font-medium">{company.projects_count ?? 0}</span>
                        <span className="text-gray-500">Proyectos</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(company.created_at).toLocaleDateString('es-ES', { 
                          day: '2-digit', 
                          month: '2-digit', 
                          year: 'numeric' 
                        })}
                      </div>
                    </div>
                    
                    {/* Botones de acción */}
                    <div className="flex gap-1">
                      {company.projects_count && company.projects_count > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#18b0a4] hover:bg-[#18b0a4]/10 h-8 px-2 flex-1 text-xs"
                          onClick={() => router.push(`/projects?companyId=${company.id}`)}
                          title="Ver Proyectos"
                        >
                          <FolderKanban className="h-3 w-3 mr-1" />
                          <span className="hidden sm:inline">Ver</span>
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#18b0a4] hover:bg-[#18b0a4]/10 h-8 px-2 flex-1 text-xs"
                          onClick={() => handleOpenCreateProjectModal(company.id)}
                          title="Crear Proyecto"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          <span className="hidden sm:inline">Crear</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#18b0a4] hover:bg-[#18b0a4]/10 h-8 px-2 flex-1 text-xs"
                        onClick={() => handleOpenEditCompanyModal(company)}
                        title="Editar Empresa"
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">Editar</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:bg-red-500/10 h-8 px-2 flex-1 text-xs"
                        onClick={() => handleDeleteClick(company.id)}
                        title="Eliminar Empresa"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">Eliminar</span>
                      </Button>
                    </div>
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
              <div className="flex flex-col gap-4">
                {/* Preview Area */}
                {(companyLogo || currentCompany?.logo) && (
                  <div className="relative group p-4 border-2 border-dashed border-[#18b0a4]/30 rounded-lg bg-[#18b0a4]/5">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <SupabaseImage
                          src={companyLogo || currentCompany?.logo || "/placeholder.svg"}
                          alt="Logo preview"
                          width={80}
                          height={80}
                          className="rounded-lg border border-[#18b0a4]/20 object-contain bg-white shadow-sm"
                          fallbackSrc="/placeholder.svg"
                        />
                        {companyLogoFile && (
                          <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1 text-xs">
                            <CheckCircle className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {companyLogoFile ? "Vista previa" : "Logo actual"}
                        </p>
                        {companyLogoFile && (
                          <p className="text-xs text-gray-600 mt-1">
                            {companyLogoFile.name} ({(companyLogoFile.size / 1024).toFixed(1)} KB)
                          </p>
                        )}
                        <p className="text-xs text-[#18b0a4] mt-1">
                          {companyLogoFile ? "Se subirá al guardar" : "Almacenado en Supabase"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-red-500 hover:text-red-700 transition-colors p-1"
                        onClick={handleRemoveCompanyLogo}
                        title="Eliminar logo"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Upload Area */}
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor="company-logo-upload"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors group"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-gray-400 group-hover:text-[#18b0a4] transition-colors" />
                      <p className="mb-2 text-sm text-gray-500 group-hover:text-gray-700">
                        <span className="font-semibold">{companyLogo ? "Cambiar" : "Subir"} logo</span>
                      </p>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF hasta 5MB</p>
                    </div>
                    <input
                      id="company-logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleCompanyLogoFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
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
