import { useCallback } from 'react'

export function useCleanup() {
  const clearAllSessionData = useCallback(() => {
    if (typeof window === 'undefined') return

    // Limpiar localStorage
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (
        key.startsWith('sb-') || 
        key.includes('supabase') || 
        key.includes('auth') ||
        key.includes('session')
      )) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))

    // Limpiar sessionStorage
    sessionStorage.clear()

    // Limpiar cookies del navegador
    document.cookie.split(";").forEach((c) => {
      const eqPos = c.indexOf("=")
      const name = eqPos > -1 ? c.substr(0, eqPos) : c
      if (name.includes('sb-') || name.includes('supabase') || name.includes('auth')) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`
      }
    })

    console.log('🧹 Session data cleared successfully')
  }, [])

  return { clearAllSessionData }
}
