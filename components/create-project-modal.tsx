"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Image from "next/image"
import { X, Loader2, Upload, CheckCircle } from "lucide-react"

import { supabase } from "@/lib/supabase-browser"
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
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"

type Company = {
  id: string
  name: string
}

type Project = {
  id: string
  name: string
  description: string | null
  objective: string | null
  logo: string | null
  company_id: string
  created_at: string
}

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onProjectCreated?: (project: Project) => void
  initialCompanyId?: string | null
  isEditing?: boolean
  currentProject?: Project | null
}

export function CreateProjectModal({
  isOpen,
  onClose,
  onProjectCreated,
  initialCompanyId,
  isEditing = false,
  currentProject = null,
}: CreateProjectModalProps) {
  const { toast } = useToast()
  const [companies, setCompanies] = useState<Company[]>([])
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [projectObjective, setProjectObjective] = useState("")
  const [projectCompanyId, setProjectCompanyId] = useState<string | null>(initialCompanyId || null)
  const [projectLogo, setProjectLogo] = useState<string | null>(null) // Base64 string for logo preview
  const [projectLogoFile, setProjectLogoFile] = useState<File | null>(null) // For actual file input
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadingCompanies, setLoadingCompanies] = useState(true)

  useEffect(() => {
    const fetchCompanies = async () => {
      setLoadingCompanies(true)
      const { data, error } = await supabase.from("companies").select("id, name").order("name", { ascending: true })
      if (error) {
        toast({
          title: "Error",
          description: `Error al cargar empresas: ${error.message}`,
          variant: "destructive",
        })
      } else {
        setCompanies(data || [])
      }
      setLoadingCompanies(false)
    }
    fetchCompanies()
  }, [toast])

  useEffect(() => {
    if (isOpen) {
      if (isEditing && currentProject) {
        setProjectName(currentProject.name)
        setProjectDescription(currentProject.description || "")
        setProjectObjective(currentProject.objective || "")
        setProjectCompanyId(currentProject.company_id)
        setProjectLogo(currentProject.logo || null)
      } else {
        setProjectName("")
        setProjectDescription("")
        setProjectObjective("")
        // Mantener la empresa inicial si está disponible
        setProjectCompanyId(initialCompanyId || null)
        setProjectLogo(null)
      }
      setProjectLogoFile(null) // Always clear file input on open
    }
  }, [isOpen, isEditing, currentProject, initialCompanyId])

  // Actualizar empresa cuando cambie initialCompanyId (útil cuando se cambia filtro)
  useEffect(() => {
    if (initialCompanyId && !isEditing) {
      setProjectCompanyId(initialCompanyId)
    }
  }, [initialCompanyId, isEditing])

  const companyOptions = companies.map((c) => ({
    value: c.id,
    label: c.name,
  }))

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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

      setProjectLogoFile(file)
      
      // Crear preview usando FileReader
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setProjectLogo(result) // Mostrar preview temporalmente
      }
      reader.readAsDataURL(file)
      
      console.log('📁 Archivo seleccionado para preview:', file.name, file.type, file.size)
    } else {
      setProjectLogoFile(null)
      setProjectLogo(isEditing ? currentProject?.logo || null : null)
    }
  }

  const uploadProjectLogo = async (): Promise<string | null> => {
    if (!projectLogoFile) return projectLogo

    try {
      console.log('🔄 Iniciando proceso de subida de logo del proyecto...')
      console.log('📁 Archivo a subir:', projectLogoFile.name, projectLogoFile.type, projectLogoFile.size)

      // Importar utilidades de storage
      const { uploadImage, generateUniqueFileName, getExtensionFromMimeType, resizeImage } = await import(
        "@/lib/supabase-storage"
      )

      // Redimensionar imagen
      console.log('🖼️ Redimensionando imagen...')
      const resized = await resizeImage(projectLogoFile, 500, 500)
      console.log('✅ Imagen redimensionada:', resized.size)

      // Generar nombre único
      const extension = getExtensionFromMimeType(projectLogoFile.type)
      const fileName = currentProject?.id
        ? `project_${currentProject.id}.${extension}`
        : generateUniqueFileName("project_logo", extension)
        
      console.log('📝 Nombre de archivo generado:', fileName)

      // Subir a Storage
      console.log('☁️ Subiendo a Supabase Storage...')
      const publicUrl = await uploadImage("project-logos", fileName, resized)

      console.log('✅ Logo subido exitosamente:', publicUrl)
      return publicUrl
    } catch (error: any) {
      console.error("Error uploading logo:", error)
      throw error
    }
  }

  const handleRemoveLogo = () => {
    setProjectLogo(null)
    setProjectLogoFile(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (!projectName.trim() || !projectCompanyId) {
      toast({
        title: "Error",
        description: "El nombre del proyecto y la empresa son obligatorios.",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    try {
      // Subir imagen si hay una seleccionada
      let finalLogoUrl = projectLogo
      if (projectLogoFile) {
        console.log('📤 Subiendo logo de proyecto...')
        finalLogoUrl = await uploadProjectLogo()
        if (finalLogoUrl) {
          toast({
            title: "Logo subido",
            description: "El logo se ha cargado correctamente.",
          })
        }
      }

      const projectData = {
        name: projectName,
        description: projectDescription || null,
        objective: projectObjective || null,
        company_id: projectCompanyId,
        logo: finalLogoUrl, // This will be the Storage URL or null
      }

      let result
      if (isEditing && currentProject) {
        // @ts-ignore
        result = await supabase.from("projects").update(projectData).eq("id", currentProject.id).select().single()
      } else {
        // @ts-ignore
        result = await supabase.from("projects").insert(projectData).select().single()
      }

      if ((result as any).error) {
        toast({
          title: "Error",
          description: `Hubo un error al guardar el proyecto: ${(result as any).error.message}`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Éxito",
          description: `Proyecto "${(result as any).data.name}" ha sido ${isEditing ? "actualizado" : "creado"} correctamente.`,
          variant: "default",
        })
        
        // Reset form
        setProjectName("")
        setProjectDescription("")
        setProjectObjective("")
        setProjectCompanyId("")
        setProjectLogo(null)
        setProjectLogoFile(null)
        
        onProjectCreated?.((result as any).data) // Notify parent component
        onClose() // Close the modal
      }
    } catch (error: any) {
      console.error("Error al procesar proyecto:", error)
      toast({
        title: "Error",
        description: `No se pudo ${isEditing ? "actualizar" : "crear"} el proyecto: ${error.message}`,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="dialog-content-responsive">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Proyecto" : "Crear Nuevo Proyecto"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Modifica los detalles del proyecto." : "Completa los detalles para crear un nuevo proyecto."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="projectName">Nombre del Proyecto</Label>
            <Input id="projectName" value={projectName} onChange={(e) => setProjectName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="projectCompany">Empresa</Label>
            {initialCompanyId && !isEditing && (
              <div className="text-sm text-green-600 bg-green-50 p-2 rounded-md border border-green-200">
                ✓ Empresa preseleccionada desde el filtro actual
              </div>
            )}
            {loadingCompanies ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando empresas...
              </div>
            ) : (
              <Combobox
                options={companyOptions}
                value={projectCompanyId || ""}
                onValueChange={setProjectCompanyId}
                placeholder="Selecciona una empresa..."
                searchPlaceholder="Buscar empresa..."
                emptyMessage="No se encontraron empresas."
                disabled={isEditing} // Solo deshabilitar al editar, permitir cambios al crear
              />
            )}
            {initialCompanyId && !isEditing && (
              <div className="text-xs text-gray-500">
                La empresa ha sido preseleccionada automáticamente. Puedes cambiarla si lo deseas.
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="projectDescription">Descripción (Opcional)</Label>
            <Textarea
              id="projectDescription"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="projectObjective">Objetivo (Opcional)</Label>
            <Textarea
              id="projectObjective"
              value={projectObjective}
              onChange={(e) => setProjectObjective(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="projectLogo">Logo (Opcional)</Label>
            <div className="flex flex-col gap-4">
              {/* Preview Area */}
              {(projectLogo || currentProject?.logo) && (
                <div className="relative group p-4 border-2 border-dashed border-[#18b0a4]/30 rounded-lg bg-[#18b0a4]/5">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Image
                        src={projectLogo || currentProject?.logo || "/placeholder.svg"}
                        alt="Logo preview"
                        width={80}
                        height={80}
                        className="rounded-lg border border-[#18b0a4]/20 object-contain bg-white shadow-sm"
                      />
                      {projectLogoFile && (
                        <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1 text-xs">
                          <CheckCircle className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {projectLogoFile ? "Vista previa" : "Logo actual"}
                      </p>
                      {projectLogoFile && (
                        <p className="text-xs text-gray-600 mt-1">
                          {projectLogoFile.name} ({(projectLogoFile.size / 1024).toFixed(1)} KB)
                        </p>
                      )}
                      <p className="text-xs text-[#18b0a4] mt-1">
                        {projectLogoFile ? "Se subirá al guardar" : "Almacenado en Supabase"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-red-500 hover:text-red-700 transition-colors p-1"
                      onClick={handleRemoveLogo}
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
                  htmlFor="project-logo-upload"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors group"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-2 text-gray-400 group-hover:text-[#18b0a4] transition-colors" />
                    <p className="mb-2 text-sm text-gray-500 group-hover:text-gray-700">
                      <span className="font-semibold">{projectLogo ? "Cambiar" : "Subir"} logo</span>
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF hasta 5MB</p>
                  </div>
                  <input
                    id="project-logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : isEditing ? (
                "Guardar Cambios"
              ) : (
                "Crear Proyecto"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
