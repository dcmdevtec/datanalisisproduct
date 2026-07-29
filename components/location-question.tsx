"use client"

// Pregunta tipo "Ubicación" (pptx slide 17): al tocar "Detectar mi ubicación"
// se pide la geolocalización del navegador y se resuelve (reverse geocoding,
// vía Nominatim/OpenStreetMap — sin costo, sin API key) en País, Departamento,
// Ciudad, Barrio y Localidad. Los campos quedan editables por si el detalle
// que devuelve el geocoder no es exacto (barrios pequeños suelen fallar).
// Solo versión web — la APK maneja su propio flujo de ubicación nativo.

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { MapPin, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"

export interface LocationAnswer {
  lat?: number
  lng?: number
  pais?: string
  departamento?: string
  ciudad?: string
  barrio?: string
  localidad?: string
}

interface LocationQuestionProps {
  value?: LocationAnswer | null
  onChange: (value: LocationAnswer) => void
}

export function LocationQuestion({ value, onChange }: LocationQuestionProps) {
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current: LocationAnswer = value || {}

  const updateField = (field: keyof LocationAnswer, fieldValue: string) => {
    onChange({ ...current, [field]: fieldValue })
  }

  const detectLocation = () => {
    if (!("geolocation" in navigator)) {
      setError("Este dispositivo no soporta geolocalización.")
      return
    }
    setDetecting(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`,
            { headers: { Accept: "application/json" } }
          )
          if (!res.ok) throw new Error("reverse geocoding failed")
          const json = await res.json()
          const addr = json?.address || {}
          onChange({
            lat: latitude,
            lng: longitude,
            pais: addr.country || "",
            departamento: addr.state || addr.region || "",
            ciudad: addr.city || addr.town || addr.municipality || "",
            barrio: addr.suburb || addr.neighbourhood || addr.quarter || "",
            localidad: addr.city_district || addr.borough || addr.locality || "",
          })
        } catch {
          // Si falla el reverse geocoding, al menos guardamos las coordenadas
          // para que la respuesta no se pierda; el usuario puede llenar el resto a mano.
          onChange({ ...current, lat: latitude, lng: longitude })
          setError("No se pudo resolver la dirección automáticamente. Puedes completarla manualmente.")
        } finally {
          setDetecting(false)
        }
      },
      (geoErr) => {
        setDetecting(false)
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setError("Permiso de ubicación denegado. Actívalo en tu navegador para continuar.")
        } else {
          setError("No se pudo obtener tu ubicación. Intenta de nuevo.")
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  const hasLocation = current.lat !== undefined && current.lng !== undefined

  return (
    <div className="space-y-3">
      <Button type="button" variant={hasLocation ? "outline" : "default"} onClick={detectLocation} disabled={detecting} className="gap-2">
        {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        {hasLocation ? "Detectar de nuevo" : "Detectar mi ubicación"}
      </Button>

      {hasLocation && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          Ubicación detectada ({current.lat?.toFixed(5)}, {current.lng?.toFixed(5)})
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </p>
      )}

      {hasLocation && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">País</Label>
            <Input value={current.pais || ""} onChange={(e) => updateField("pais", e.target.value)} placeholder="País" />
          </div>
          <div>
            <Label className="text-xs">Departamento</Label>
            <Input value={current.departamento || ""} onChange={(e) => updateField("departamento", e.target.value)} placeholder="Departamento" />
          </div>
          <div>
            <Label className="text-xs">Ciudad</Label>
            <Input value={current.ciudad || ""} onChange={(e) => updateField("ciudad", e.target.value)} placeholder="Ciudad" />
          </div>
          <div>
            <Label className="text-xs">Barrio</Label>
            <Input value={current.barrio || ""} onChange={(e) => updateField("barrio", e.target.value)} placeholder="Barrio" />
          </div>
          <div>
            <Label className="text-xs">Localidad</Label>
            <Input value={current.localidad || ""} onChange={(e) => updateField("localidad", e.target.value)} placeholder="Localidad" />
          </div>
        </div>
      )}
    </div>
  )
}
