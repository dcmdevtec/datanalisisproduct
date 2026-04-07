"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ExternalLink } from "lucide-react"

interface ThankYouScreenProps {
  surveyTitle: string
  logo?: string | null
  primaryColor: string
  companyName?: string
  message?: string
}

export function ThankYouScreen({
  surveyTitle,
  logo,
  primaryColor,
  companyName,
  message,
}: ThankYouScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#f8fafc" }}>
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="pt-10 pb-10">
          {/* Logo */}
          {logo && (
            <div className="flex justify-center mb-6">
              <img src={logo} alt="Logo" className="h-16 object-contain" />
            </div>
          )}

          {/* Ícono de éxito */}
          <div className="flex justify-center mb-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor}15` }}
            >
              <CheckCircle2 className="h-12 w-12" style={{ color: primaryColor }} />
            </div>
          </div>

          {/* Mensaje */}
          <div className="text-center space-y-3">
            <h2 className="text-2xl font-bold" style={{ color: primaryColor }}>
              ¡Gracias por participar!
            </h2>
            <p className="text-muted-foreground">
              {message || `Tu respuesta a la encuesta "${surveyTitle}" ha sido registrada exitosamente.`}
            </p>
            {companyName && (
              <p className="text-sm text-muted-foreground">
                — {companyName}
              </p>
            )}
          </div>

          {/* Botón cerrar */}
          <div className="mt-8 text-center">
            <Button
              variant="outline"
              onClick={() => window.close()}
              className="text-sm"
            >
              Cerrar ventana
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
