"use client"

import { Loader2 } from "lucide-react"

interface AuthLoadingProps {
  message?: string
  size?: "sm" | "md" | "lg"
}

export function AuthLoading({ message = "Verificando autenticación...", size = "md" }: AuthLoadingProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8", 
    lg: "h-12 w-12"
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50">
      <div className="flex flex-col items-center space-y-4 p-8">
        <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
        <p className="text-center text-muted-foreground text-sm">{message}</p>
      </div>
    </div>
  )
}
