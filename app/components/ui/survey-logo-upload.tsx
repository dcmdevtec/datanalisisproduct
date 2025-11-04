"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

interface SurveyLogoUploadProps {
  surveyId: string
  onLogoChange: (logoUrl: string | null) => void
  isPublic: boolean
  onPublicToggle: (isPublic: boolean) => void
}

export function SurveyLogoUpload({
  surveyId,
  onLogoChange,
  isPublic,
  onPublicToggle,
}: SurveyLogoUploadProps) {
  const [logo, setLogo] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const supabase = createClientComponentClient()

  useEffect(() => {
    const fetchLogo = async () => {
      const { data } = supabase.storage
        .from("survey-logos")
        .getPublicUrl(`${surveyId}/logo.png`)

      if (data) {
        const response = await fetch(data.publicUrl)
        if (response.ok) {
          setPreview(data.publicUrl)
          onLogoChange(data.publicUrl)
        } else {
          setPreview(null)
          onLogoChange(null)
        }
      }
    }
    fetchLogo()
  }, [surveyId, onLogoChange, supabase.storage])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setLogo(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleUpload = async () => {
    if (!logo) return
    setUploading(true)
    const { error } = await supabase.storage
      .from("survey-logos")
      .upload(`${surveyId}/logo.png`, logo, {
        cacheControl: "3600",
        upsert: true,
      })

    if (error) {
      console.error("Error uploading logo:", error)
    } else {
      const { data } = supabase.storage
        .from("survey-logos")
        .getPublicUrl(`${surveyId}/logo.png`)
      setPreview(data.publicUrl)
      onLogoChange(data.publicUrl)
    }
    setUploading(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="survey-logo" className="text-lg font-semibold">
          Logo de la Encuesta
        </Label>
        <div className="flex items-center space-x-2">
          <Switch
            id="public-switch"
            checked={isPublic}
            onCheckedChange={onPublicToggle}
          />
          <Label htmlFor="public-switch">Público</Label>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <div className="w-24 h-24 border rounded-md flex items-center justify-center">
          {preview ? (
            <img
              src={preview}
              alt="Logo Preview"
              className="object-contain w-full h-full"
            />
          ) : (
            <div className="text-xs text-gray-500">Sin logo</div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <Input id="survey-logo" type="file" onChange={handleFileChange} />
          <Button onClick={handleUpload} disabled={!logo || uploading}>
            {uploading ? "Subiendo..." : "Subir Logo"}
          </Button>
        </div>
      </div>
    </div>
  )
}