"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, AlertCircle, CheckCircle, UserCheck, XCircle } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"
import { EmailAutocompleteInput } from "@/components/EmailAutocompleteInput"

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
  /** Notifica al padre el estado de verificación del documento */
  onStatusChange?: (status: "valid" | "blocked" | "error") => void
  config?: any
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

const DEFAULT_FIELD_ORDER = ['firstName', 'lastName', 'phone', 'email', 'company', 'address', 'document']

export function ContactInfoQuestion({ surveyId, onChange, onStatusChange, config = {}, initialData }: ContactInfoQuestionProps) {
  const {
    includeFirstName = true,
    includeLastName = true,
    includePhone = true,
    includeDocument = true,
    includeEmail = true,
    includeCompany = true,
    includeAddress = true,
    contactFieldOrder = DEFAULT_FIELD_ORDER,
  } = config

  const [documentType, setDocumentType] = useState("CC")
  const [documentNumber, setDocumentNumber] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")
  const [address, setAddress] = useState("")
  // Campos estructurados de dirección colombiana
  // Formato: [Tipo de Vía] [Número principal] # [Cruce] - [Distancia] [Complemento]
  // Ejemplo:  Calle 23 # 45 - 12 Apto 301
  const [addrTipoVia, setAddrTipoVia] = useState("")       // Calle, Carrera, Diagonal...
  const [addrNumPrincipal, setAddrNumPrincipal] = useState("") // ej: 23
  const [addrNumCruce, setAddrNumCruce] = useState("")         // ej: 45
  const [addrNumDistancia, setAddrNumDistancia] = useState("") // ej: 12
  const [addrComplemento, setAddrComplemento] = useState("") // Apartamento, interior, etc.
  const debouncedDocumentNumber = useDebounce(documentNumber, 500)
  const [status, setStatus] = useState<VerificationStatus>("idle")
  const [message, setMessage] = useState("")

  // Combinar campos estructurados de dirección en el string address
  // Formato colombiano: Calle 23 # 45 - 12 Apto 301
  useEffect(() => {
    if (addrTipoVia || addrNumPrincipal) {
      let built = [addrTipoVia, addrNumPrincipal].filter(Boolean).join(" ")
      if (addrNumCruce) built += ` # ${addrNumCruce}`
      if (addrNumDistancia) built += ` - ${addrNumDistancia}`
      if (addrComplemento) built += ` ${addrComplemento}`
      setAddress(built.trim())
    }
  }, [addrTipoVia, addrNumPrincipal, addrNumCruce, addrNumDistancia, addrComplemento])

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

        // La API siempre devuelve 200 — revisar allowed_to_proceed para determinar el estado real
        const allowed = response.ok && (jsonBody?.allowed_to_proceed !== false)

        if (!allowed) {
          // BLOQUEADO: ya completó la encuesta
          setStatus("already_exists")
          setMessage(
            jsonBody?.message ||
            jsonBody?.error ||
            "Este número de documento ya ha completado esta encuesta."
          )
          onStatusChange?.("blocked")
        } else {
          // PERMITIDO: puede continuar
          setStatus("verified")
          setMessage("Puede continuar.")
          onStatusChange?.("valid")

          // Auto-rellenar campos con datos de encuestas anteriores si los campos están vacíos
          const prefilled = jsonBody?.prefilled_data
          if (prefilled) {
            // Nombre: dividir full_name si no hay firstName/lastName
            if (prefilled.full_name && !firstName && !lastName) {
              const parts = prefilled.full_name.trim().split(/\s+/)
              if (parts.length >= 1) setFirstName(parts[0])
              if (parts.length >= 2) setLastName(parts.slice(1).join(' '))
            }
            if (prefilled.email && !email) setEmail(prefilled.email)
            if (prefilled.phone && !phone) setPhone(prefilled.phone)
            if (prefilled.address && !address) setAddress(prefilled.address)
            if (prefilled.company && !company) setCompany(prefilled.company)
          }
        }
      } catch (error) {
        setStatus("error")
        setMessage("No se pudo verificar el documento. Intente de nuevo.")
        onStatusChange?.("error")
        console.error("Error verifying document:", error)
      }
    }

    verifyResponse()
  }, [debouncedDocumentNumber, documentType, surveyId, documentLengthIsValid, includeDocument])

  const isBlocked = status === "already_exists"

  const statusIndicator = useMemo(() => {
    if (!includeDocument) return null
    switch (status) {
      case "verifying":
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      case "verified":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "already_exists":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }, [status, includeDocument])

  return (
    <div className={`space-y-4 p-4 border rounded-lg bg-background transition-all ${isBlocked ? "border-red-300 bg-red-50/40" : ""}`}>

      {/* ── Banner: BLOQUEADO ── */}
      {isBlocked && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
          <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Ya has completado esta encuesta</p>
            <p className="text-xs text-red-600 mt-0.5">{message}</p>
          </div>
        </div>
      )}

      {/* ── Banner: datos pre-rellenados ── */}
      {status === "verified" && (firstName || lastName || email || phone) && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-teal-50 border border-teal-200">
          <UserCheck className="h-4 w-4 text-teal-600 shrink-0" />
          <p className="text-xs text-teal-700 font-medium">
            Encontramos tus datos de una encuesta anterior. Puedes editarlos si es necesario.
          </p>
        </div>
      )}

      {/* Campos en el orden configurado por el creador de la encuesta */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isBlocked ? "opacity-50 pointer-events-none select-none" : ""}`}>
        {contactFieldOrder.map((fieldKey: string) => {
          if (fieldKey === 'firstName' && includeFirstName) return (
            <div key="firstName" className="space-y-2">
              <Label htmlFor="firstName">Nombre</Label>
              <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Ingrese su nombre" disabled={isBlocked} />
            </div>
          )
          if (fieldKey === 'lastName' && includeLastName) return (
            <div key="lastName" className="space-y-2">
              <Label htmlFor="lastName">Apellido</Label>
              <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Ingrese su apellido" disabled={isBlocked} />
            </div>
          )
          if (fieldKey === 'phone' && includePhone) return (
            <div key="phone" className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Ingrese su número de teléfono" disabled={isBlocked} />
            </div>
          )
          if (fieldKey === 'email' && includeEmail) return (
            <div key="email" className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <EmailAutocompleteInput
                id="email"
                value={email}
                onChange={(eOrVal: any) => {
                  const val = typeof eOrVal === "string" ? eOrVal : eOrVal?.target?.value ?? ""
                  setEmail(val)
                }}
                placeholder="Ingrese su correo electrónico"
                disabled={isBlocked}
              />
            </div>
          )
          if (fieldKey === 'company' && includeCompany) return (
            <div key="company" className="space-y-2">
              <Label htmlFor="company">Empresa</Label>
              <Input id="company" value={company} onChange={e => setCompany(e.target.value)} placeholder="Ingrese el nombre de su empresa" disabled={isBlocked} />
            </div>
          )
          if (fieldKey === 'address' && includeAddress) return (
            <div key="address" className="space-y-2 md:col-span-2">
              <Label>Dirección</Label>
              {/* Formato dirección colombiana: Calle 23 # 45 - 12 Apto 301 */}
              <div className="flex flex-wrap items-end gap-1.5">
                {/* Tipo de Vía */}
                <div className="space-y-1 min-w-[120px] flex-shrink-0">
                  <Label htmlFor="addr-tipo" className="text-xs text-muted-foreground">Tipo de Vía</Label>
                  <Select value={addrTipoVia} onValueChange={setAddrTipoVia} disabled={isBlocked}>
                    <SelectTrigger id="addr-tipo" className="h-9 text-sm w-full"><SelectValue placeholder="Tipo..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Avenida">Avenida</SelectItem>
                      <SelectItem value="Avenida Calle">Avenida Calle</SelectItem>
                      <SelectItem value="Avenida Carrera">Avenida Carrera</SelectItem>
                      <SelectItem value="Calle">Calle</SelectItem>
                      <SelectItem value="Carrera">Carrera</SelectItem>
                      <SelectItem value="Circular">Circular</SelectItem>
                      <SelectItem value="Diagonal">Diagonal</SelectItem>
                      <SelectItem value="Transversal">Transversal</SelectItem>
                      <SelectItem value="Autopista">Autopista</SelectItem>
                      <SelectItem value="Kilómetro">Kilómetro</SelectItem>
                      <SelectItem value="Circunvalar">Circunvalar</SelectItem>
                      <SelectItem value="Manzana">Manzana</SelectItem>
                      <SelectItem value="Apartado Aéreo">Apartado Aéreo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Número principal */}
                <div className="space-y-1 w-16 flex-shrink-0">
                  <Label htmlFor="addr-num-principal" className="text-xs text-muted-foreground">Número</Label>
                  <Input id="addr-num-principal" value={addrNumPrincipal} onChange={e => setAddrNumPrincipal(e.target.value)} placeholder="23" disabled={isBlocked} className="h-9 text-sm" />
                </div>

                {/* Separador # */}
                <span className="mb-1.5 text-sm font-bold text-muted-foreground select-none">#</span>

                {/* Número de cruce */}
                <div className="space-y-1 w-16 flex-shrink-0">
                  <Label htmlFor="addr-num-cruce" className="text-xs text-muted-foreground">Cruce</Label>
                  <Input id="addr-num-cruce" value={addrNumCruce} onChange={e => setAddrNumCruce(e.target.value)} placeholder="45" disabled={isBlocked} className="h-9 text-sm" />
                </div>

                {/* Separador - */}
                <span className="mb-1.5 text-sm font-bold text-muted-foreground select-none">-</span>

                {/* Número de distancia */}
                <div className="space-y-1 w-16 flex-shrink-0">
                  <Label htmlFor="addr-num-distancia" className="text-xs text-muted-foreground">Distancia</Label>
                  <Input id="addr-num-distancia" value={addrNumDistancia} onChange={e => setAddrNumDistancia(e.target.value)} placeholder="12" disabled={isBlocked} className="h-9 text-sm" />
                </div>

                {/* Información adicional */}
                <div className="space-y-1 flex-1 min-w-[140px]">
                  <Label htmlFor="addr-complemento" className="text-xs text-muted-foreground">Información adicional</Label>
                  <Input id="addr-complemento" value={addrComplemento} onChange={e => setAddrComplemento(e.target.value)} placeholder="Apto 301, Bloque B..." disabled={isBlocked} className="h-9 text-sm" />
                </div>
              </div>
              {address && (
                <p className="text-xs text-muted-foreground mt-1"><span className="font-medium">Dirección: </span>{address}</p>
              )}
            </div>
          )
          if (fieldKey === 'document' && includeDocument) return (
            <div key="document" className="space-y-4 md:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="document-type">Tipo de Documento</Label>
                  <Select value={documentType} onValueChange={setDocumentType} disabled={isBlocked}>
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
                      disabled={isBlocked}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      {statusIndicator}
                    </div>
                  </div>
                </div>
              </div>
              {/* Mensaje de estado */}
              {!isBlocked && message && (
                <div className="text-sm flex items-center gap-2">
                  {statusIndicator}
                  <span className={status === "error" ? "text-red-600" : "text-muted-foreground"}>
                    {message}
                  </span>
                </div>
              )}
            </div>
          )
          return null
        })}
      </div>
    </div>
  )
}
