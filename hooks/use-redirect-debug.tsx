"use client"

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export function useRedirectDebug() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    console.log('🛣️ Ruta actual:', pathname)
    
    // Interceptar todas las redirecciones
    const originalPush = router.push
    router.push = function(...args: any[]) {
      console.log('🚀 Redirección interceptada:', args)
      console.trace('Stack trace de redirección')
      return originalPush.apply(router, args)
    }

    return () => {
      router.push = originalPush
    }
  }, [router, pathname])

  return { router, pathname }
}
