import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'

export function useAuthRedirect() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const redirectAttempted = useRef(false)

  useEffect(() => {
    // Solo intentar redirección si no está cargando y hay un usuario
    if (!loading && user && !redirectAttempted.current) {
      redirectAttempted.current = true
      
      console.log('🔄 useAuthRedirect - Usuario autenticado, redirigiendo a dashboard...')
      
      // Redirección inmediata y forzada
      try {
        router.push('/dashboard')
        // Si por alguna razón no funciona, usar replace
        setTimeout(() => {
          if (window.location.pathname !== '/dashboard') {
            console.log('🔄 useAuthRedirect - Fallback: usando router.replace')
            router.replace('/dashboard')
          }
        }, 100)
      } catch (error) {
        console.error('❌ Error en redirección:', error)
        // Último recurso: redirección directa
        window.location.href = '/dashboard'
      }
    }
    
    // Resetear el flag si no hay usuario
    if (!user) {
      redirectAttempted.current = false
    }
  }, [user, loading, router])

  return { user, loading, redirectAttempted: redirectAttempted.current }
}
