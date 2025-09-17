import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { ValidationError } from './validateSurveyData'

export type SaveState = 'not-started' | 'saving' | 'saved' | 'error'
export type SaveProgress = {
  state: SaveState
  message?: string
  errors?: ValidationError[]
  timestamp?: number
}

export type SectionSaveStates = {
  [sectionId: string]: SaveProgress
}

/**
 * Hook para manejar el estado de guardado de las secciones y proporcionar feedback al usuario.
 * @returns Un objeto con el estado de guardado y funciones para actualizarlo.
 */
export function useSavingState() {
  const [savingStates, setSavingStates] = useState<SectionSaveStates>({})
  const [globalState, setGlobalState] = useState<SaveState>('not-started')
  const [lastError, setLastError] = useState<string | null>(null)

  const updateSectionState = (
    sectionId: string,
    state: SaveState,
    message?: string,
    errors?: ValidationError[]
  ) => {
    setSavingStates((prev: SectionSaveStates) => ({
      ...prev,
      [sectionId]: {
        state,
        message,
        errors,
        timestamp: Date.now()
      }
    }))

    // Actualizar estado global basado en el estado de todas las secciones
    const allStates = Object.values({ ...savingStates, [sectionId]: { state } }) as SaveProgress[]
    
    if (allStates.some((s: SaveProgress) => s.state === 'error')) {
      setGlobalState('error')
      setLastError(message || 'Error al guardar una o más secciones')
    } else if (allStates.some((s: SaveProgress) => s.state === 'saving')) {
      setGlobalState('saving')
    } else if (allStates.every((s: SaveProgress) => s.state === 'saved')) {
      setGlobalState('saved')
      setLastError(null)
    } else {
      setGlobalState('not-started')
    }
  }

  const resetStates = () => {
    setSavingStates({})
    setGlobalState('not-started')
    setLastError(null)
  }

  const startSaving = (sectionId: string) => {
    updateSectionState(sectionId, 'saving', 'Guardando sección...')
  }

  const markSaved = (sectionId: string) => {
    updateSectionState(sectionId, 'saved', 'Guardado exitosamente')
  }

  const markError = (sectionId: string, error: string, validationErrors?: ValidationError[]) => {
    updateSectionState(sectionId, 'error', error, validationErrors)
  }

  return {
    savingStates,
    globalState,
    lastError,
    updateSectionState,
    resetStates,
    startSaving,
    markSaved,
    markError,
  }
}

/**
 * Función para obtener un mensaje de estado formateado basado en el estado de guardado.
 */
export function getStatusMessage(state: SaveProgress): string {
  switch (state.state) {
    case 'saving':
      return state.message || 'Guardando...'
    case 'saved':
      return state.message || 'Guardado exitosamente'
    case 'error':
      if (state.errors?.length) {
        return `Error: ${state.errors.map(e => e.message).join('; ')}`
      }
      return state.message || 'Error al guardar'
    default:
      return ''
  }
}

/**
 * Componente de UI para mostrar el estado de guardado.
 */
export function SaveStatus({ state, className }: { state: SaveProgress; className?: string }) {
  const status = useMemo(() => {
    const message = getStatusMessage(state)
    const icon = state.state === 'saving' ? '⏳' :
                 state.state === 'saved' ? '✅' :
                 state.state === 'error' ? '❌' : ''
    
    return { message, icon }
  }, [state])

  if (!status.message) return null

  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <span>{status.icon}</span>
      <span>{status.message}</span>
      {state.timestamp && (
        <span className="text-muted-foreground">
          {new Intl.DateTimeFormat('es', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }).format(state.timestamp)}
        </span>
      )}
    </div>
  )
}