"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, ArrowRight, Loader2, FileText } from "lucide-react"

interface IdentificationStepProps {
  surveyId: string
  surveyTitle: string
  surveyDescription?: string
  logo?: string | null
  primaryColor: string
  onVerified: (data: {
    public_respondent_id?: string
    document_type: string
    document_number: string
    full_name?: string
    email?: string
    phone?: string
  }) => void
  onSkip?: () => void
  requireIdentification: boolean
}

export function IdentificationStep({
  surveyId,
  surveyTitle,
  surveyDescription,
  logo,
  primaryColor,
  onVerified,
  onSkip,
  requireIdentification,
}: IdentificationStepProps) {
  const [documentType, setDocumentType] = useState("")
  const [documentNumber, setDocumentNumber] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!documentType) {
      setError("Selecciona el tipo de documento")
      return
    }
    if (!documentNumber.trim()) {
      setError("Ingresa el número de documento")
      return
    }

    setLoading(true)

    try {
      // Verificar con la API existente
      const res = await fetch(`/api/surveys/${surveyId}/verify-respondent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_type: documentType,
          document_number: documentNumber.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Error al verificar")
        return
      }

      // Si el respondente ya completó la encuesta
      if (data.allowed_to_proceed === false) {
        setError("Ya has completado esta encuesta. No puedes responderla nuevamente.")
        return
      }

      // Pasar datos al padre
      onVerified({
        public_respondent_id: data.respondent?.id,
        document_type: documentType,
        document_number: documentNumber.trim(),
        full_name: data.respondent?.full_name,
        email: data.respondent?.email,
        phone: data.respondent?.phone,
      })
    } catch {
      setError("Error de conexión. Intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#f8fafc" }}>
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="pt-8 pb-8">
          {/* Logo */}
          {logo && (
            <div className="flex justify-center mb-6">
              <img src={logo} alt="Logo" className="h-16 object-contain" />
            </div>
          )}

          {/* Título */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-2" style={{ color: primaryColor }}>
              {surveyTitle}
            </h1>
            {surveyDescription && (
              <p className="text-sm text-muted-foreground">{surveyDescription}</p>
            )}
          </div>

          {/* Identificación */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5" style={{ color: primaryColor }} />
              <h2 className="font-semibold text-base">Identificación</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Por favor ingresa tus datos para comenzar la encuesta.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="doc-type" className="text-sm">Tipo de documento *</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger id="doc-type">
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
                  <SelectItem value="CE">Cédula de Extranjería</SelectItem>
                  <SelectItem value="TI">Tarjeta de Identidad</SelectItem>
                  <SelectItem value="NIT">NIT</SelectItem>
                  <SelectItem value="PP">Pasaporte</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="doc-number" className="text-sm">Número de documento *</Label>
              <Input
                id="doc-number"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="Ej: 1234567890"
                autoComplete="off"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full text-white"
              style={{ backgroundColor: primaryColor }}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Comenzar Encuesta
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>

            {!requireIdentification && onSkip && (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={onSkip}
              >
                Continuar sin identificarse
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
