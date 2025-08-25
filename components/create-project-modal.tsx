"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Image from "next/image"
import { X, Loader2 } from "lucide-react"

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
        setProjectCompanyId(initialCompanyId || null)
        setProjectLogo(null)
      }
      setProjectLogoFile(null) // Always clear file input on open
    }
  }, [isOpen, isEditing, currentProject, initialCompanyId])

  const companyOptions = companies.map((c) => ({
    value: c.id,
    label: c.name,
  }))

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setProjectLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setProjectLogo(reader.result as string) // Store base64 string
      }
      reader.readAsDataURL(file)
    } else {
      setProjectLogoFile(null)
      setProjectLogo(isEditing ? currentProject?.logo || null : null) // Revert to original if no new file
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

    const projectData = {
      name: projectName,
      description: projectDescription || null,
      objective: projectObjective || null,
      company_id: projectCompanyId,
      logo: projectLogo, // This will be the base64 string or null
    }

    let result
    if (isEditing && currentProject) {
      result = await supabase.from("projects").update(projectData).eq("id", currentProject.id).select().single()
    } else {
      result = await supabase.from("projects").insert(projectData).select().single()
    }

    if (result.error) {
      toast({
        title: "Error",
        description: `Hubo un error al guardar el proyecto: ${result.error.message}`,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Éxito",
        description: `Proyecto "${result.data.name}" ha sido ${isEditing ? "actualizado" : "creado"} correctamente.`,
        variant: "default",
      })
      onProjectCreated?.(result.data) // Notify parent component
      onClose() // Close the modal
    }
    setIsSubmitting(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
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
                disabled={isEditing || !!initialCompanyId} // Disable if editing or initialCompanyId is provided
              />
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
            <div className="flex items-center gap-4">
              <label
                htmlFor="project-logo-upload"
                className="cursor-pointer px-4 py-2 bg-[#18b0a4] text-white rounded-lg font-semibold shadow hover:bg-[#139488] transition"
              >
                {projectLogo ? "Cambiar logo" : "Subir logo"}
                <input
                  id="project-logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileChange}
                  className="hidden"
                />
              </label>
              {(projectLogo || currentProject?.logo) && (
                <div className="relative group">
                  <Image
                    src={projectLogo || currentProject?.logo || "/placeholder.svg"}
                    alt="Logo del Proyecto"
                    width={64}
                    height={64}
                    className="rounded border border-[#18b0a4] object-contain bg-white"
                  />
                  <button
                    type="button"
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 text-xs opacity-80 hover:opacity-100"
                    onClick={handleRemoveLogo}
                    title="Eliminar logo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
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
