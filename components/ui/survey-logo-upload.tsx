"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ImagePlus, XCircle, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface SurveyLogoUploadProps {
  value: string | null
  onChange: (base64Image: string | null) => void
}

export function SurveyLogoUpload({ value, onChange }: SurveyLogoUploadProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      if (file.size > 2 * 1024 * 1024) {
        // 2MB limit
        toast({
          title: "Error de archivo",
          description: "El tamaño de la imagen no debe exceder los 2MB.",
          variant: "destructive",
        })
        return
      }

      setIsLoading(true)
      const reader = new FileReader()
      reader.onloadend = () => {
        onChange(reader.result as string)
        setIsLoading(false)
      }
      reader.onerror = () => {
        toast({
          title: "Error de lectura",
          description: "No se pudo leer el archivo de imagen.",
          variant: "destructive",
        })
        setIsLoading(false)
      }
      reader.readAsDataURL(file)
    },
    [onChange, toast],
  )

  const handleRemoveImage = useCallback(() => {
    onChange(null)
  }, [onChange])

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative w-32 h-32 rounded-md overflow-hidden border border-input flex items-center justify-center">
          <img src={value || "/placeholder.svg"} alt="Survey Logo" className="object-contain w-full h-full" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/80 hover:bg-background"
            onClick={handleRemoveImage}
            aria-label="Remove image"
          >
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      ) : (
        <div className="relative w-32 h-32 rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center group hover:border-primary transition-colors">
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <ImagePlus className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
         <Input
  id="logo-upload"
  type="file"
  accept="image/*"
  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
  onChange={handleFileChange}
  disabled={isLoading}
/>

          <Label htmlFor="logo-upload" className="sr-only">
            Subir logo
          </Label>
        </div>
      )}
      <p className="text-xs text-muted-foreground">PNG, JPG, GIF (Max 2MB)</p>
    </div>
  )
}
