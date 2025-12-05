// types/zone.d.ts
declare module "@/types/zone" {
  import type { GeoJSON } from "geojson"

  export type Zone = {
    id: string
    name: string
    description: string
    geometry: GeoJSON | null // GeoJSON object - puede ser Polygon, MultiPolygon, etc.
    map_snapshot?: string | null // URL de la imagen del mapa guardada en Storage
    status: "active" | "inactive"
    surveyors: string[] // IDs de encuestadores asignados
    surveys: string[] // IDs de encuestas asignadas
    created_by?: string
    created_at?: string
    updated_at?: string
    zone_color?: string // Color asignado a la zona (hex)
    selected_neighborhoods?: string[] // Nombres de los barrios seleccionados (solo para modo choropleth)
  }
}
