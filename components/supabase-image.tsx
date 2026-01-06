"use client"

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface SupabaseImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  fallbackSrc?: string
}

export default function SupabaseImage({
  src,
  alt,
  width = 48,
  height = 48,
  className,
  fallbackSrc,
}: SupabaseImageProps) {
  const [imgSrc, setImgSrc] = useState(src)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleError = () => {
    console.error('Error loading Supabase image:', imgSrc)
    setHasError(true)
    if (fallbackSrc && imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc)
      setHasError(false)
    }
  }

  const handleLoad = () => {
    setIsLoading(false)
  }

  // Si hay un error y no hay fallback, mostrar placeholder
  if (hasError && !fallbackSrc) {
    return (
      <div 
        className={cn(
          "bg-gray-200 rounded flex items-center justify-center text-gray-400",
          className
        )}
        style={{ width, height }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="2"/>
          <path d="M21 15L16 10L5 21" stroke="currentColor" strokeWidth="2"/>
        </svg>
      </div>
    )
  }

  return (
    <div className="relative" style={{ width, height }}>
      {isLoading && (
        <div 
          className="absolute inset-0 bg-gray-200 rounded animate-pulse flex items-center justify-center"
        >
          <div className="w-4 h-4 bg-gray-300 rounded animate-pulse" />
        </div>
      )}
      {/* Usar img normal en lugar de Next.js Image para evitar problemas de optimización */}
      <img
        src={imgSrc}
        alt={alt}
        width={width}
        height={height}
        className={cn(
          "transition-opacity duration-300 rounded object-cover",
          isLoading ? "opacity-0" : "opacity-100",
          className
        )}
        onError={handleError}
        onLoad={handleLoad}
        style={{ width, height }}
      />
    </div>
  )
}