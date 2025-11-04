"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { SurveyLogoUpload } from "@/app/components/ui/survey-logo-upload"

export default function CreateSurveyPage() {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const params = useParams()
  const router = useRouter()
  const supabase = createClientComponentClient()
  const projectId = params.id as string

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: surveyData, error: surveyError } = await supabase
      .from("surveys")
      .insert([
        {
          project_id: projectId,
          title,
          description,
          is_public: isPublic,
          logo_url: logoUrl,
        },
      ])
      .select("id")
      .single()

    if (surveyError) {
      console.error("Error creating survey:", surveyError)
      setError("Error al crear la encuesta. Por favor, inténtelo de nuevo.")
      setLoading(false)
      return
    }

    if (surveyData) {
      router.push(`/surveys/${surveyData.id}`)
    } else {
      setError("No se pudo obtener el ID de la encuesta creada.")
    }

    setLoading(false)
  }

  return (
    <div className="container mx-auto py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Crear Nueva Encuesta</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <SurveyLogoUpload
            surveyId="new-survey" // Provisional ID, will be updated on first upload
            onLogoChange={setLogoUrl}
            isPublic={isPublic}
            onPublicToggle={setIsPublic}
          />

          <div>
            <Label htmlFor="title" className="text-lg font-semibold">
              Título de la Encuesta
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Encuesta de Satisfacción del Cliente"
              required
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-lg font-semibold">
              Descripción
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describa el propósito de la encuesta"
              className="mt-2"
            />
          </div>

          {error && <p className="text-red-500">{error}</p>}

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear Encuesta"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}