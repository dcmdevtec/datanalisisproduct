import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { MantineProvider } from '@mantine/core';
import { Toaster } from "@/components/ui/toaster"
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
            <ClientLayout>
              {children}
            </ClientLayout>
            <Toaster />
          </ThemeProvider>
        </MantineProvider>
      </body>
    </html>
  )
}
