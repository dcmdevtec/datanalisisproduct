// Esta es una implementación básica de un servicio de sincronización offline
// En una aplicación real, usarías IndexedDB o similar para almacenamiento local

export interface SyncItem {
  id: string
  type: "response" | "audio" | "image"
  data: any
  timestamp: string
  synced: boolean
}

// Simular almacenamiento local
let offlineStore: SyncItem[] = []

export const offlineSync = {
  // Guardar un elemento para sincronización posterior
  saveForSync: (type: "response" | "audio" | "image", data: any): string => {
    const id = crypto.randomUUID() // ✅ UUID real en lugar de timestamp
    const item: SyncItem = {
      id,
      type,
      data,
      timestamp: new Date().toISOString(),
      synced: false,
    }

    // En una app real, guardaríamos en IndexedDB
    offlineStore.push(item)

    // También guardaríamos en localStorage como respaldo
    try {
      const currentStore = JSON.parse(localStorage.getItem("offlineSync") || "[]")
      localStorage.setItem("offlineSync", JSON.stringify([...currentStore, item]))
    } catch (error) {
      console.error("Error saving to localStorage:", error)
    }

    return id
  },

  // Obtener elementos pendientes de sincronización
  getPendingItems: (): SyncItem[] => {
    return offlineStore.filter((item) => !item.synced)
  },

  // Marcar elementos como sincronizados
  markAsSynced: (ids: string[]): void => {
    offlineStore = offlineStore.map((item) => (ids.includes(item.id) ? { ...item, synced: true } : item))

    // Actualizar localStorage
    try {
      const currentStore = JSON.parse(localStorage.getItem("offlineSync") || "[]")
      const updatedStore = currentStore.map((item: SyncItem) =>
        ids.includes(item.id) ? { ...item, synced: true } : item,
      )
      localStorage.setItem("offlineSync", JSON.stringify(updatedStore))
    } catch (error) {
      console.error("Error updating localStorage:", error)
    }
  },

  // Sincronizar con el servidor
  syncWithServer: async (): Promise<{ success: boolean; syncedCount: number }> => {
    const pendingItems = offlineSync.getPendingItems()

    if (pendingItems.length === 0) {
      return { success: true, syncedCount: 0 }
    }

    try {
      // Agrupar por tipo
      const responses = pendingItems.filter((item) => item.type === "response")
      const audioRecordings = pendingItems.filter((item) => item.type === "audio")
      const images = pendingItems.filter((item) => item.type === "image")

      // Sincronizar respuestas
      if (responses.length > 0) {
        const responseData = responses.map((item) => item.data)
        const responseIds = responses.map((item) => item.id)

        const responseSyncResult = await fetch("/api/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "responses",
            responses: responseData,
          }),
        })

        if (responseSyncResult.ok) {
          offlineSync.markAsSynced(responseIds)
        } else {
          throw new Error("Error syncing responses")
        }
      }

      // Sincronizar grabaciones de audio (en una app real)
      if (audioRecordings.length > 0) {
        // Código para sincronizar audio
      }

      // Sincronizar imágenes (en una app real)
      if (images.length > 0) {
        // Código para sincronizar imágenes
      }

      return {
        success: true,
        syncedCount: pendingItems.length,
      }
    } catch (error) {
      console.error("Error syncing with server:", error)
      return {
        success: false,
        syncedCount: 0,
      }
    }
  },

  // Inicializar desde localStorage (para persistencia)
  init: (): void => {
    try {
      const storedItems = JSON.parse(localStorage.getItem("offlineSync") || "[]")
      offlineStore = storedItems
    } catch (error) {
      console.error("Error initializing offline sync:", error)
      offlineStore = []
    }
  },
}

// Inicializar al cargar
if (typeof window !== "undefined") {
  offlineSync.init()
}
