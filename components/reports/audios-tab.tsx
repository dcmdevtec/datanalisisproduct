"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Download, FileAudio, AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

// Pestaña "Audios" (reunión 2026-08-27): descarga en un solo ZIP todas las
// grabaciones de la encuesta, organizadas en carpetas
// Proyecto/Encuesta/Fecha/Encuestador/archivo — ver
// app/api/surveys/[id]/audios/zip/route.ts.
//
// Reusa /api/surveys/[id]/recordings (ya existente, usado en
// app/surveys/[id]/page.tsx) solo para mostrar el conteo antes de generar
// el ZIP — no descarga los audios acá, eso lo arma el endpoint de zip.
interface AudiosTabProps {
  surveyId: string
}

export function AudiosTab({ surveyId }: AudiosTabProps) {
  const { toast } = useToast()
  const [loadingCount, setLoadingCount] = useState(true)
  const [count, setCount] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingCount(true)
    setHint(null)
    fetch(`/api/surveys/${surveyId}/recordings`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        setCount(json.recordings?.length ?? 0)
        setHint(json.diagnostic?.hint ?? null)
      })
      .catch(() => { if (!cancelled) setCount(0) })
      .finally(() => { if (!cancelled) setLoadingCount(false) })
    return () => { cancelled = true }
  }, [surveyId])

  const handleDownloadZip = async () => {
    setDownloading(true)
    const loadingToast = toast({ title: "Generando ZIP...", description: "Descargando y empaquetando los audios, puede tardar unos segundos." })
    try {
      const res = await fetch(`/api/surveys/${surveyId}/audios/zip`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        toast({ title: "No se pudo descargar", description: body?.error || "Error al generar el ZIP de audios.", variant: "destructive" })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `audios_${surveyId}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      toast({ title: "No se pudo descargar", description: err?.message || "Error de conexión.", variant: "destructive" })
    } finally {
      loadingToast.dismiss()
      setDownloading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileAudio className="h-5 w-5 text-[#18b0a4]" /> Audios de la encuesta
        </CardTitle>
        <CardDescription>
          Descarga todas las grabaciones en un solo ZIP, organizadas por Proyecto / Encuesta / Fecha / Encuestador.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadingCount ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando grabaciones...
          </div>
        ) : count === 0 ? (
          <div className="flex flex-col items-center gap-2 text-center py-10 text-muted-foreground">
            <AlertCircle className="h-8 w-8 opacity-40" />
            <p className="text-sm">No hay grabaciones de audio para esta encuesta todavía.</p>
            {hint && <p className="text-xs max-w-md">{hint}</p>}
          </div>
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-4 py-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{count}</span> grabación{count !== 1 ? "es" : ""} encontrada{count !== 1 ? "s" : ""}.
            </p>
            <Button onClick={handleDownloadZip} disabled={downloading} className="gap-2">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloading ? "Generando ZIP..." : "Descargar todos (ZIP)"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
