// types/zone.d.ts
declare module "@/types/zone" {
  import type { GeoJSON } from "geojson" // Import GeoJSON type

  export type Zone = {
    id: string
    name: string
    description: string
    geometry: GeoJSON | null // GeoJSON object
    map_snapshot?: string | null
    status: "active" | "inactive"
    surveyors: string[] // Assuming these are IDs
    surveys: string[] // Assuming these are IDs
    created_by?: string
    created_at?: string
    updated_at?: string
  }
}
