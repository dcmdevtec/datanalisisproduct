"use client"

import { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, AlertCircle, CheckCircle } from "lucide-react"
import { useDebounce } from "use-debounce"

// Asumimos que el ID de la encuesta está disponible a través de un contexto o props
interface ContactInfoQuestionProps {
  surveyId: string
  onChange: (value: {
    documentType: string
    documentNumber: string
    name: string
    phone: string
  }) => void
}

type VerificationStatus = "idle" | "verifying" | "verified" | "error" | "already_exists"

export function ContactInfoQuestion({ surveyId, onChange }: ContactInfoQuestionProps) {
  const [documentType, setDocumentType] = useState("CC")
  const [documentNumber, setDocumentNumber] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [debouncedDocumentNumber] = useDebounce(documentNumber, 500)
  const [status, setStatus] = useState<VerificationStatus>("idle")
  const [message, setMessage] = useState("")

  const documentLengthIsValid = useMemo(() => {
    const length = debouncedDocumentNumber.trim().length
    return length === 7 || length === 10
  }, [debouncedDocumentNumber])

  useEffect(() => {
    onChange({ documentType, documentNumber, name, phone })
  }, [documentType, documentNumber, name, phone])

  useEffect(() => {
    if (!documentLengthIsValid) {
      setStatus("idle")
      setMessage("")
      return
    }

    const verifyResponse = async () => {
      setStatus("verifying")
      setMessage("Verificando...")

      try {
        // TODO: Reemplazar con la llamada real a la API
        // const response = await fetch(`/api/surveys/${surveyId}/verify-respondent`, {
        //   method: "POST",
        //   headers: { "Content-Type": "application/json" },
        //   body: JSON.stringify({ documentType, documentNumber: debouncedDocumentNumber }),
        // })

        // --- INICIO: Lógica de simulación ---
        await new Promise(resolve => setTimeout(resolve, 1000));
        const mockResponse = {
            ok: Math.random() > 0.5,
            json: async () => {
                if (mockResponse.ok) {
                    return { message: "Puede continuar." };
                }
                return { error: "Este número de documento ya ha completado la encuesta." };
            }
        };
        const response = mockResponse;
        // --- FIN: Lógica de simulación ---


        if (response.ok) {
          const data = await response.json()
          setStatus("verified")
          setMessage(data.message || "Puede continuar.")
        } else {
          const errorData = await response.json()
          setStatus("already_exists")
          setMessage(errorData.error || "Este número de documento ya ha completado la encuesta.")
        }
      } catch (error) {
        setStatus("error")
        setMessage("No se pudo verificar el documento. Intente de nuevo.")
        console.error("Error verifying document:", error)
      }
    }

    verifyResponse()
  }, [debouncedDocumentNumber, documentType, surveyId, documentLengthIsValid])

  const statusIndicator = useMemo(() => {
    switch (status) {
      case "verifying":
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      case "verified":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "already_exists":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }, [status])

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-background">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre Completo</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ingrese su nombre completo"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Ingrese su número de teléfono"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="document-type">Tipo de Documento</Label>
          <Select value={documentType} onValueChange={setDocumentType}>
            <SelectTrigger id="document-type">
              <SelectValue placeholder="Seleccione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
              <SelectItem value="CE">Cédula de Extranjería</SelectItem>
              <SelectItem value="TI">Tarjeta de Identidad</SelectItem>
              <SelectItem value="PA">Pasaporte</SelectItem>
              <SelectItem value="NIT">NIT</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="document-number">Número de Documento</Label>
          <div className="relative">
            <Input
              id="document-number"
              type="number"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="Ingrese el número de documento"
              className="pr-8"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {statusIndicator}
            </div>
          </div>
        </div>
      </div>
      {message && (
        <div className="text-sm flex items-center gap-2">
          {statusIndicator}
          <span
            className={
              status === "error"
                ? "text-red-600"
                : status === "already_exists"
                ? "text-yellow-600"
                : "text-muted-foreground"
            }
          >
            {message}
          </span>
        </div>
      )}
    </div>
  )
}
