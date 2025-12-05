import barranquillaGeoJSON from "@/lib/geo-barranquilla.json"

export interface Neighborhood {
    nombre: string
    localidad: string
    pieza_urba: string
}

/**
 * Obtiene la lista completa de barrios con toda su información
 */
export function getNeighborhoods(): Neighborhood[] {
    const neighborhoods: Neighborhood[] = []
    const seen = new Set<string>()

    for (const feature of barranquillaGeoJSON.features) {
        const nombre = feature.properties?.nombre
        const localidad = feature.properties?.localidad
        const pieza_urba = feature.properties?.pieza_urba

        // Filtrar barrios sin nombre
        if (!nombre || nombre.trim() === "") {
            continue
        }

        // Evitar duplicados
        if (seen.has(nombre)) {
            continue
        }

        seen.add(nombre)
        neighborhoods.push({
            nombre,
            localidad: localidad || "Sin localidad",
            pieza_urba: pieza_urba || "Sin pieza urbana",
        })
    }

    // Ordenar alfabéticamente por nombre
    return neighborhoods.sort((a, b) => a.nombre.localeCompare(b.nombre))
}

/**
 * Obtiene solo los nombres de los barrios
 */
export function getNeighborhoodNames(): string[] {
    return getNeighborhoods().map((n) => n.nombre)
}
