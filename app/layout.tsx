import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { MantineProvider } from '@mantine/core';
import { Toaster } from "@/components/ui/toaster"
import { SupabaseProvider } from "@/components/supabase-provider"
import { ConnectionStatus } from "@/components/connection-status"
import ClientLayout from "@/app/client-layout"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Datanalisis",
  description: "A comprehensive survey platform for data collection and analysis",
    generator: 'v0.dev'
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
            <SupabaseProvider 
              keepAlive={true}
              retryDelay={3000}
              maxRetries={3}
              useReadOnlyForQueries={true}
            >
              <ClientLayout>
                {children}
              </ClientLayout>
              <Toaster />
              <ConnectionStatus 
                showBadgeOnly={true}
                position="top-right"
                autoHide={true}
              />
            </SupabaseProvider>
          </ThemeProvider>
        </MantineProvider>
      </body>
    </html>
  )
}
