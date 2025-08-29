"use client"

import { useState } from "react"

interface LogoProps {
  size?: "sm" | "md" | "lg"
  showText?: boolean
  className?: string
}

export function Logo({ size = "md", showText = true, className = "" }: LogoProps) {
  const [imageError, setImageError] = useState(false)
  
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8", 
    lg: "w-12 h-12"
  }
  
  const imageSizes = {
    sm: { width: 20, height: 20 },
    md: { width: 28, height: 28 },
    lg: { width: 44, height: 44 }
  }
  
  const textSizes = {
    sm: "text-sm",
    md: "text-xl",
    lg: "text-2xl"
  }

  const handleImageError = () => {
    setImageError(true)
    console.error("Error loading logo image")
  }

  return (
    <div className={`flex items-center gap-2 font-bold ${className}`}>
      <div className={`${sizeClasses[size]} rounded-full bg-[#18b0a4] flex items-center justify-center p-0.5`}>
        {!imageError ? (
          <img 
            src="/logo.png" 
            alt="Logo Datanálisis" 
            {...imageSizes[size]}
            className="object-contain"
            onError={handleImageError}
          />
        ) : (
          <div className="text-white font-bold text-lg">
            D
          </div>
        )}
      </div>
      {showText && (
        <span className={textSizes[size]}>Datanálisis</span>
      )}
    </div>
  )
}
