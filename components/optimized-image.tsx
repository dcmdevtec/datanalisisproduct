"use client"

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  fill?: boolean
  fallbackSrc?: string
}

export default function OptimizedImage({
  src,
  alt,
  width = 48,
  height = 48,
  className,
  priority = false,
  fill = false,
  fallbackSrc,
}: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = useState(src)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleError = () => {
    console.error('Error loading image:', imgSrc)
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
    <div className={cn("relative", className)} style={fill ? undefined : { width, height }}>
      {isLoading && (
        <div 
          className={cn(
            "absolute inset-0 bg-gray-200 rounded animate-pulse flex items-center justify-center",
            fill ? "w-full h-full" : ""
          )}
        >
          <div className="w-4 h-4 bg-gray-300 rounded animate-pulse" />
        </div>
      )}
      <Image
        src={imgSrc}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        priority={priority}
        className={cn(
          "transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          fill ? "object-cover" : "",
          className
        )}
        onError={handleError}
        onLoad={handleLoad}
        unoptimized={process.env.NODE_ENV === 'development'} // Solo en desarrollo
      />
    </div>
  )
}