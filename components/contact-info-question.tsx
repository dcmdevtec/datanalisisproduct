"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, AlertCircle, CheckCircle } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"
import { EmailAutocompleteInput } from "@/components/EmailAutocompleteInput"

// Asumimos que el ID de la encuesta está disponible a través de un contexto o props
interface ContactInfoQuestionProps {
  surveyId: string
  onChange: (value: {
    documentType?: string
    documentNumber?: string
    firstName?: string
    lastName?: string
    phone?: string
    email?: string
    company?: string
    address?: string
    fullName?: string
  }) => void
  onStatusChange?: (status: "valid" | "blocked" | "error") => void
  config?: {
    includeFirstName?: boolean
    includeLastName?: boolean
    includePhone?: boolean
    includeDocument?: boolean
    includeEmail?: boolean
    includeCompany?: boolean
    includeAddress?: boolean
  }
  initialData?: {
    documentType?: string
    documentNumber?: string
    firstName?: string
    lastName?: string
    phone?: string
    email?: string
    company?: string
    address?: string
    fullName?: string
  }
}

type VerificationStatus = "idle" | "verifying" | "verified" | "error" | "already_exists"

export function ContactInfoQuestion({ surveyId, onChange, onStatusChange, config = {}, initialData }: ContactInfoQuestionProps) {
  const {
    includeFirstName = true,
    includeLastName = true,
    includePhone = true,
    includeDocument = true,
    includeEmail = true,
    includeCompany = true,
    includeAddress = true,
  } = config

  const [documentType, setDocumentType] = useState("CC")
  const [documentNumber, setDocumentNumber] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")
  const [address, setAddress] = useState("")
  const debouncedDocumentNumber = useDebounce(documentNumber, 500)
  const [status, setStatus] = useState<VerificationStatus>("idle")
  const [message, setMessage] = useState("")

  // Efecto para cargar datos iniciales si cambian (auto-relleno)
  useEffect(() => {
    if (initialData) {
      if (initialData.documentType) setDocumentType(initialData.documentType)
      if (initialData.documentNumber) setDocumentNumber(initialData.documentNumber)
      if (initialData.phone) setPhone(initialData.phone)
      if (initialData.email) setEmail(initialData.email)
      if (initialData.company) setCompany(initialData.company)
      if (initialData.address) setAddress(initialData.address)

      // Manejo inteligente de nombres
      if (initialData.firstName) setFirstName(initialData.firstName)
      if (initialData.lastName) setLastName(initialData.lastName)

      // Si viene fullName pero no firstName/lastName, intentar dividir
      if (initialData.fullName && !initialData.firstName && !initialData.lastName) {
        const parts = initialData.fullName.trim().split(' ')
        if (parts.length > 0) {
          setFirstName(parts[0])
          if (parts.length > 1) {
            setLastName(parts.slice(1).join(' '))
          }
        }
      }
    }
  }, [initialData])

  const documentLengthIsValid = useMemo(() => {
    if (!includeDocument) return false
    const length = (debouncedDocumentNumber || "").trim().length
    return length === 7 || length === 10
  }, [debouncedDocumentNumber, includeDocument])

  const isInitialMount = useRef(true)

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const dataToChange: {
      documentType?: string
      documentNumber?: string
      firstName?: string
      lastName?: string
      phone?: string
      email?: string
      company?: string
      address?: string
      fullName?: string // Enviamos también fullName combinado para el backend
    } = {}

    if (includeDocument) {
      dataToChange.documentType = documentType
      dataToChange.documentNumber = documentNumber
    }
    if (includeFirstName) {
      dataToChange.firstName = firstName
    }
    if (includeLastName) {
      dataToChange.lastName = lastName
    }
    // Construir fullName combinado siempre
    const full = [firstName, lastName].filter(Boolean).join(' ').trim()
    if (full) dataToChange.fullName = full

    if (includePhone) {
      dataToChange.phone = phone
    }
    if (includeEmail) {
      dataToChange.email = email
    }
    if (includeCompany) {
      dataToChange.company = company
    }
    if (includeAddress) {
      dataToChange.address = address
    }

    onChange(dataToChange)
  }, [
    documentType,
    documentNumber,
    firstName,
    lastName,
    phone,
    email,
    company,
    address,
    includeDocument,
    includeFirstName,
    includeLastName,
    includePhone,
    includeEmail,
    includeCompany,
    includeAddress,
  ])

  useEffect(() => {
    if (!includeDocument || !documentLengthIsValid) {
      setStatus("idle")
      setMessage("")
      if (onStatusChange) onStatusChange("valid") // Reset status if input is cleared/invalid length
      return
    }

    const verifyResponse = async () => {
      setStatus("verifying")
      setMessage("Verificando...")

      try {
        const fetchUrl = surveyId ? `/api/surveys/${surveyId}/verify-respondent` : `/api/surveys/verify-respondent`
        // build payload matching public_respondents schema
        const payload: any = {
          survey_id: surveyId || undefined,
          document_type: documentType,
          document_number: debouncedDocumentNumber,
          full_name: [firstName, lastName].filter(Boolean).join(' ').trim() || undefined,
        }
        if (email) payload.email = email
        if (phone) payload.phone = phone
        if (company) payload.company = company
        if (address) payload.address = address

        const response = await fetch(fetchUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        // parse response safely
        let jsonBody: any = null
        try {
          jsonBody = await response.json()
        } catch (e) {
          // non-json response
        }

        if (response.ok) {
          // Check allowed_to_proceed flag from backend
          if (jsonBody?.allowed_to_proceed === false) {
            setStatus("already_exists")
            setMessage((jsonBody && (jsonBody.message || jsonBody.msg)) || "Este número de documento ya ha completado la encuesta.")
            if (onStatusChange) onStatusChange("blocked")
          } else {
            setStatus("verified")
            setMessage((jsonBody && (jsonBody.message || jsonBody.msg)) || "Puede continuar.")
            if (onStatusChange) onStatusChange("valid")

            // Auto-fill contact info from prefilled_data if available
            if (jsonBody?.prefilled_data) {
              const prefilled = jsonBody.prefilled_data

              // Parse full_name into firstName and lastName if available
              if (prefilled.full_name && !firstName && !lastName) {
                const parts = prefilled.full_name.trim().split(' ')
                if (parts.length > 0) {
                  setFirstName(parts[0])
                  if (parts.length > 1) {
                    setLastName(parts.slice(1).join(' '))
                  }
                }
              }

              // Auto-fill other contact fields if empty
              if (prefilled.email && !email) setEmail(prefilled.email)
              if (prefilled.phone && !phone) setPhone(prefilled.phone)
              if (prefilled.address && !address) setAddress(prefilled.address)
              if (prefilled.company && !company) setCompany(prefilled.company)
            }
          }
        } else {
          setStatus("already_exists")
          setMessage((jsonBody && (jsonBody.error || jsonBody.message)) || "Este número de documento ya ha completado la encuesta.")
          if (onStatusChange) onStatusChange("blocked")
        }
      } catch (error) {
        setStatus("error")
        setMessage("No se pudo verificar el documento. Intente de nuevo.")
        console.error("Error verifying document:", error)
        if (onStatusChange) onStatusChange("error")
      }
    }

    verifyResponse()
  }, [debouncedDocumentNumber, documentType, surveyId, documentLengthIsValid, includeDocument])

  const statusIndicator = useMemo(() => {
    if (!includeDocument) return null
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
  }, [status, includeDocument])

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-background">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {includeFirstName && (
          <div className="space-y-2">
            <Label htmlFor="firstName">Nombre</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="Ingrese su nombre"
            />
          </div>
        )}
        {includeLastName && (
          <div className="space-y-2">
            <Label htmlFor="lastName">Apellido</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Ingrese su apellido"
            />
          </div>
        )}
        {includePhone && (
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Ingrese su número de teléfono"
            />
          </div>
        )}
        {includeEmail && (
          <div className="space-y-2">
            <Label htmlFor="email">Correo Electrónico</Label>
            <EmailAutocompleteInput
              id="email"
              value={email}
              onChange={(eOrVal: any) => {
                const val = typeof eOrVal === "string" ? eOrVal : eOrVal?.target?.value ?? ""
                setEmail(val)
              }}
              placeholder="Ingrese su correo electrónico"
            />
          </div>
        )}
        {includeCompany && (
          <div className="space-y-2">
            <Label htmlFor="company">Empresa</Label>
            <Input
              id="company"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Ingrese el nombre de su empresa"
            />
          </div>
        )}
        {includeAddress && (
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Dirección</Label>
            <Textarea
              id="address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Ingrese su dirección"
            />
          </div>
        )}
      </div>
      {includeDocument && (
        <>
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
                  onChange={e => setDocumentNumber(e.target.value)}
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
        </>
      )}
    </div>
  )
}
