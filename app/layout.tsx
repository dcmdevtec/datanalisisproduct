import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { MantineProvider } from '@mantine/core'
import { Toaster } from "@/components/ui/toaster"
import AuthProvider from "@/components/auth-provider"
import ClientLayout from "@/app/client-layout"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Datanalisis",
  description: "A comprehensive survey platform for data collection and analysis",
  generator: 'v0.dev',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/logo.png', type: 'image/png' }
    ],
    shortcut: '/favicon.svg',
    apple: '/logo.png',
  },
  // Ítem "logo de Datanálisis" (acta de ajustes 05/10/2026, con seguimiento
  // 13/10/2026): "no usar el blanco [al compartir el link], no se ve muy
  // bien". Causa real: no había NINGÚN openGraph configurado, así que
  // WhatsApp/el unfurler que sea caía al apple-touch-icon (icons.apple
  // arriba, /logo.png) — que es la versión BLANCA del logo (correcta para
  // el círculo teal del sidebar, components/ui/logo.tsx, pero invisible
  // sobre la tarjeta blanca de una vista previa de link). app/opengraph-image.png
  // y app/twitter-image.png (versión teal, buen contraste en blanco) ya
  // generan las etiquetas og:image/twitter:image correctas por convención
  // de Next.js — acá solo se agrega el resto de metadata estándar para que
  // el título/descripción también salgan bien en la tarjeta compartida.
  openGraph: {
    title: "Datanalisis",
    description: "Plataforma de encuestas y análisis de datos",
    siteName: "Datanalisis",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Datanalisis",
    description: "Plataforma de encuestas y análisis de datos",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <MantineProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            <AuthProvider>
              <ClientLayout>
                {children}
              </ClientLayout>
              <Toaster />
            </AuthProvider>
          </ThemeProvider>
        </MantineProvider>
      </body>
    </html>
  )
}
