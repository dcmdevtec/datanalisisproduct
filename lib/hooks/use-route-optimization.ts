import { useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

/**
 * Hook para optimizar la navegación entre rutas
 * Implementa prefetching inteligente y optimizaciones de rendimiento
 */
export function useRouteOptimization() {
  const router = useRouter()
  const pathname = usePathname()

  // Prefetch de rutas principales
  const prefetchMainRoutes = useCallback(() => {
    const mainRoutes = [
      '/dashboard',
      '/projects',
      '/surveys',
      '/companies',
      '/users',
      '/zones',
      '/reports',
      '/settings'
    ]

    mainRoutes.forEach(route => {
      if (route !== pathname) {
        router.prefetch(route)
      }
    })
  }, [router, pathname])

  // Prefetch de rutas relacionadas basado en la ruta actual
  const prefetchRelatedRoutes = useCallback(() => {
    if (pathname.startsWith('/projects/')) {
      router.prefetch('/projects')
      router.prefetch('/surveys')
    }
    
    if (pathname.startsWith('/surveys/')) {
      router.prefetch('/surveys')
      router.prefetch('/projects')
    }
    
    if (pathname.startsWith('/companies/')) {
      router.prefetch('/companies')
      router.prefetch('/projects')
    }
  }, [router, pathname])

  // Prefetch inteligente basado en hover
  const handleRouteHover = useCallback((route: string) => {
    router.prefetch(route)
  }, [router])

  // Prefetch de rutas al montar el componente
  useEffect(() => {
    // Delay para no bloquear el render inicial
    const timer = setTimeout(() => {
      prefetchMainRoutes()
      prefetchRelatedRoutes()
    }, 1000)

    return () => clearTimeout(timer)
  }, [prefetchMainRoutes, prefetchRelatedRoutes])

  return {
    prefetchRoute: router.prefetch,
    handleRouteHover,
    currentPath: pathname
  }
}

/**
 * Hook para optimizar la carga de componentes pesados
 */
export function useComponentOptimization() {
  const preloadComponent = useCallback((componentPath: string) => {
    // Preload de componentes cuando se hace hover en navegación
    import(componentPath)
  }, [])

  return {
    preloadComponent
  }
}

/**
 * Hook para optimizar las transiciones de página
 */
export function usePageTransition() {
  const router = useRouter()

  const navigateWithTransition = useCallback((route: string) => {
    // Agregar clase de transición
    document.body.classList.add('page-transitioning')
    
    // Navegar a la ruta
    router.push(route)
    
    // Remover clase después de un delay
    setTimeout(() => {
      document.body.classList.remove('page-transitioning')
    }, 300)
  }, [router])

  return {
    navigateWithTransition
  }
}
