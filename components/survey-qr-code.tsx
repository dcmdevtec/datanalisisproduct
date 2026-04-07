"use client"

import React, { useRef, useCallback } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Copy, Download, QrCode, Check } from "lucide-react"
import { useState } from "react"

interface SurveyQRCodeProps {
  surveyId: string
  surveyTitle?: string
  size?: number
  className?: string
}

export function SurveyQRCode({
  surveyId,
  surveyTitle,
  size = 200,
  className,
}: SurveyQRCodeProps) {
  const qrRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/encuesta/${surveyId}`
      : `/encuesta/${surveyId}`

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const input = document.createElement("input")
      input.value = publicUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand("copy")
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [publicUrl])

  const handleDownload = useCallback(() => {
    if (!qrRef.current) return
    const svg = qrRef.current.querySelector("svg")
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()

    img.onload = () => {
      canvas.width = img.width * 2
      canvas.height = img.height * 2
      if (ctx) {
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      }
      const pngUrl = canvas.toDataURL("image/png")
      const link = document.createElement("a")
      link.download = `QR-${surveyTitle || surveyId}.png`
      link.href = pngUrl
      link.click()
    }

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)))
  }, [surveyId, surveyTitle])

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <QrCode className="h-4 w-4" />
            <span>Código QR de la Encuesta</span>
          </div>

          <div ref={qrRef} className="p-4 bg-white rounded-lg border">
            <QRCodeSVG
              value={publicUrl}
              size={size}
              level="H"
              includeMargin={false}
            />
          </div>

          <p className="text-xs text-muted-foreground text-center break-all max-w-xs">
            {publicUrl}
          </p>

          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4 mr-1.5 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 mr-1.5" />
              )}
              {copied ? "Copiado" : "Copiar Link"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 mr-1.5" />
              Descargar QR
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
