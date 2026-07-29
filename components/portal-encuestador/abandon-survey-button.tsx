"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { XCircle, Loader2 } from "lucide-react"

// Botón/overlay flotante "Abandonar encuesta" (pptx slide 4), disponible en
// todas las secciones. Se renderiza por FUERA del motor de encuestas
// compartido (app/preview/survey/page.tsx) para no tocar su lógica interna —
// solo se superpone visualmente.
interface AbandonSurveyButtonProps {
  onAbandon: () => Promise<void> | void
}

export function AbandonSurveyButton({ onAbandon }: AbandonSurveyButtonProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      await onAbandon()
    } finally {
      setSubmitting(false)
      setOpen(false)
    }
  }

  return (
    <>
      {/* Bug reportado 2026-07-29 ("estorba"): estaba fijo en bottom-4
          right-4, exactamente donde vive el botón principal "Finalizar
          Encuesta"/"Siguiente Sección" del motor de encuestas (también
          alineado a la derecha, abajo) — se superponían. Se mueve a la
          esquina superior derecha, que quedó libre desde que se retiró el
          botón "Limpiar Respuestas" del header (ver comentario de seguridad
          en app/preview/survey/page.tsx) y no compite con ningún control de
          navegación de la encuesta. */}
      <div className="fixed top-4 right-4 z-50">
        <Button
          variant="destructive"
          size="sm"
          className="shadow-lg"
          onClick={() => setOpen(true)}
          disabled={submitting}
        >
          {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
          Abandonar encuesta
        </Button>
      </div>
      <ConfirmationDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title="¿Está seguro de que desea abandonar la encuesta?"
        description="Se guardará como abandonada y no podrás continuar con las respuestas ya registradas en este intento."
        confirmText="Sí, abandonar"
        cancelText="No"
        confirmVariant="destructive"
      />
    </>
  )
}
