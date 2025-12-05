"use client"

import type React from "react"
import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import * as turf from "@turf/turf"
import barranquillaGeoJSON from "@/lib/geo-barranquilla.json"

interface MapWithChoroplethProps {
  initialGeometry?: any
  onGeometryChange?: (geometry: any) => void
  zoneColor: string
  selectedNeighborhoods: string[]
  onNeighborhoodSelect: (neighborhoods: string[]) => void
}

const MapWithChoropleth = forwardRef<any, MapWithChoroplethProps>(
  (
    {
      initialGeometry,
      onGeometryChange,
      zoneColor,
      selectedNeighborhoods,
      onNeighborhoodSelect,
    },
    ref
  ) => {
    const mapRef = useRef<L.Map | null>(null)
    const layerRef = useRef<L.GeoJSON | null>(null)
    const containerIdRef = useRef(`map-choropleth-${Math.random().toString(36).substr(2, 9)}`)
    const [isMapReady, setIsMapReady] = useState(false)
    const isInitializedRef = useRef(false)

    // Función para obtener la geometría combinada de los barrios seleccionados
    const getGeometryFromNeighborhoods = useCallback(() => {
      if (selectedNeighborhoods.length === 0) return null

      try {
        // Filtrar las features de los barrios seleccionados
        const selectedFeatures = barranquillaGeoJSON.features.filter((feature: any) =>
          selectedNeighborhoods.includes(feature.properties?.nombre)
        )

        if (selectedFeatures.length === 0) return null

        // Si solo hay un barrio, retornar su geometría directamente
        if (selectedFeatures.length === 1) {
          console.log("✅ Single neighborhood geometry:", selectedFeatures[0].geometry)
          return selectedFeatures[0].geometry
        }

        // Si hay múltiples barrios, combinarlos en un MultiPolygon o unirlos
        try {
          // Intentar unir las geometrías con turf.union
          let combined = turf.polygon(selectedFeatures[0].geometry.coordinates)

          for (let i = 1; i < selectedFeatures.length; i++) {
            const nextPolygon = turf.polygon(selectedFeatures[i].geometry.coordinates)
            combined = turf.union(combined, nextPolygon) as any
          }

          console.log("✅ Combined neighborhoods geometry (union):", combined.geometry)
          return combined.geometry
        } catch (unionError) {
          console.warn("⚠️ Could not union polygons, using MultiPolygon instead:", unionError)

          // Fallback: crear un MultiPolygon
          const multiPolygonCoordinates = selectedFeatures.map((f: any) => f.geometry.coordinates)

          const multiPolygon = {
            type: "MultiPolygon",
            coordinates: multiPolygonCoordinates,
          }

          console.log("✅ Combined neighborhoods geometry (MultiPolygon):", multiPolygon)
          return multiPolygon
        }
      } catch (error) {
        console.error("❌ Error getting geometry from neighborhoods:", error)
        return null
      }
    }, [selectedNeighborhoods])

    // Actualizar geometría cuando cambian los barrios seleccionados
    useEffect(() => {
      if (!isMapReady) return

      const geometry = getGeometryFromNeighborhoods()

      if (geometry && onGeometryChange) {
        console.log("📍 Updating geometry from neighborhoods:", {
          type: geometry.type,
          neighborhoodsCount: selectedNeighborhoods.length,
        })
        onGeometryChange(geometry)
      } else if (selectedNeighborhoods.length === 0 && onGeometryChange) {
        console.log("📍 Clearing geometry (no neighborhoods selected)")
        onGeometryChange(null)
      }
    }, [selectedNeighborhoods, getGeometryFromNeighborhoods, onGeometryChange, isMapReady])

    // Crear capa GeoJSON con estilos
    const createChoroplethLayer = useCallback(() => {
      if (!L || !mapRef.current) return null

      console.log("🎨 Creating choropleth layer with selections:", selectedNeighborhoods)

      return L.geoJSON(barranquillaGeoJSON as any, {
        // Filtrar barrios sin nombre
        filter: (feature: any) => {
          const nombre = feature.properties?.nombre
          if (!nombre || nombre.trim() === "") {
            console.warn("⚠️ Skipping neighborhood without name:", feature.properties)
            return false
          }
          return true
        },
        style: (feature: any) => {
          const barrio = feature.properties?.nombre
          const isSelected = selectedNeighborhoods.includes(barrio)

          console.log(`🎨 Styling ${barrio}:`, isSelected ? "SELECTED" : "not selected")

          return {
            fillColor: isSelected ? zoneColor : "#ccc",
            fillOpacity: isSelected ? 0.7 : 0.3,
            color: isSelected ? zoneColor : "#555",
            weight: isSelected ? 2 : 1,
            opacity: 1,
            interactive: true,  // Asegurar que sea clickeable
            bubblingMouseEvents: true,
          }
        },
        onEachFeature: (feature: any, layer: any) => {
          const barrioNombre = feature.properties?.nombre

          // Validación adicional
          if (!barrioNombre || barrioNombre.trim() === "") {
            console.warn("⚠️ Feature without valid name:", feature.properties)
            return
          }

          const isSelected = selectedNeighborhoods.includes(barrioNombre)

          // Popup con información
          layer.bindPopup(`
            <div class="p-2">
              <h3 class="font-semibold text-lg">${barrioNombre}</h3>
              <p class="text-sm">Localidad: ${feature.properties.localidad || "N/A"}</p>
              <p class="text-xs mt-1 ${isSelected ? 'text-green-600 font-medium' : 'text-gray-500'}">
                ${isSelected ? "✓ Seleccionado" : "Click para seleccionar"}
              </p>
            </div>
          `)

          // Tooltip al pasar el mouse
          layer.bindTooltip(barrioNombre, {
            sticky: true,
            className: isSelected ? 'leaflet-tooltip-selected' : ''
          })

          // Click handler para seleccionar/deseleccionar
          layer.on("click", (e: L.LeafletMouseEvent) => {
            // CRÍTICO: Detener propagación del evento
            L.DomEvent.stopPropagation(e)

            console.log("🖱️ Click on neighborhood:", barrioNombre)
            console.log("📋 Current selection:", selectedNeighborhoods)

            const alreadySelected = selectedNeighborhoods.includes(barrioNombre)
            let updated: string[]

            if (alreadySelected) {
              updated = selectedNeighborhoods.filter((b) => b !== barrioNombre)
              console.log("➖ Neighborhood deselected:", barrioNombre)
            } else {
              updated = [...selectedNeighborhoods, barrioNombre]
              console.log("➕ Neighborhood selected:", barrioNombre)
            }

            console.log("📋 New selection:", updated)
            onNeighborhoodSelect(updated)
          })

          // Hover effect
          layer.on("mouseover", () => {
            if (!isSelected) {
              layer.setStyle({
                fillOpacity: 0.5,
                weight: 2,
              })
            }
          })

          layer.on("mouseout", () => {
            if (!isSelected) {
              layer.setStyle({
                fillOpacity: 0.3,
                weight: 1,
              })
            }
          })
        },
      })
    }, [selectedNeighborhoods, zoneColor, onNeighborhoodSelect])

    // Inicializar mapa
    useEffect(() => {
      if (isInitializedRef.current || mapRef.current) return

      const container = document.getElementById(containerIdRef.current)
      if (!container) {
        console.error("❌ Map container not found:", containerIdRef.current)
        return
      }

      try {
        console.log("🗺️ Initializing choropleth map...")

        const map = L.map(containerIdRef.current, {
          center: [10.9639, -74.7964],
          zoom: 12,
          scrollWheelZoom: true,
          dragging: true,
          doubleClickZoom: true,
        })

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map)

        // El buscador de barrios ahora está en el modal, no en el mapa

        mapRef.current = map
        isInitializedRef.current = true
        setIsMapReady(true)

        console.log("✅ Choropleth map initialized")
      } catch (error) {
        console.error("❌ Error initializing choropleth map:", error)
      }

      // Cleanup
      return () => {
        if (mapRef.current) {
          console.log("🗑️ Cleaning up choropleth map")
          mapRef.current.remove()
          mapRef.current = null
          isInitializedRef.current = false
          setIsMapReady(false)
        }
      }
    }, []) // Solo ejecutar una vez al montar

    // Actualizar capa cuando cambian barrios o color
    useEffect(() => {
      if (!mapRef.current || !isMapReady) {
        console.log("⏸️ Skipping layer update - map not ready")
        return
      }

      console.log("🔄 Updating choropleth layer...")
      console.log("📋 Selected neighborhoods:", selectedNeighborhoods)
      console.log("🎨 Zone color:", zoneColor)

      // Remover capa anterior
      if (layerRef.current) {
        console.log("🗑️ Removing old layer")
        mapRef.current.removeLayer(layerRef.current)
        layerRef.current = null
      }

      // Crear y añadir nueva capa
      const newLayer = createChoroplethLayer()
      if (newLayer) {
        console.log("✅ Adding new layer to map")
        newLayer.addTo(mapRef.current)
        layerRef.current = newLayer

        // Forzar re-render del mapa
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize()
            console.log("🔄 Map invalidated and re-rendered")
          }
        }, 100)

        // Hacer zoom a los barrios seleccionados
        if (selectedNeighborhoods.length > 0) {
          try {
            const selectedFeatures = barranquillaGeoJSON.features.filter((f: any) =>
              selectedNeighborhoods.includes(f.properties?.nombre)
            )

            if (selectedFeatures.length > 0) {
              const selectedLayer = L.geoJSON(selectedFeatures as any)
              const bounds = selectedLayer.getBounds()

              if (bounds.isValid()) {
                mapRef.current.fitBounds(bounds, {
                  padding: [50, 50],
                  maxZoom: 14
                })
              }
            }
          } catch (error) {
            console.error("Error fitting bounds:", error)
          }
        }
      }
    }, [createChoroplethLayer, selectedNeighborhoods, zoneColor, isMapReady])

    // Invalidar tamaño del mapa cuando sea necesario
    useEffect(() => {
      if (mapRef.current && isMapReady) {
        const timer = setTimeout(() => {
          mapRef.current?.invalidateSize()
        }, 100)
        return () => clearTimeout(timer)
      }
    }, [isMapReady])

    // Exponer métodos al componente padre
    useImperativeHandle(
      ref,
      () => ({
        getMap: () => mapRef.current,
        getGeometryFromNeighborhoods,
        invalidateMapSize: () => {
          if (mapRef.current) {
            mapRef.current.invalidateSize()
          }
        },
      }),
      [getGeometryFromNeighborhoods]
    )

    return (
      <div
        id={containerIdRef.current}
        className="h-full w-full rounded-lg"
        style={{ minHeight: "300px" }}
      />
    )
  }
)

MapWithChoropleth.displayName = "MapWithChoropleth"

export default MapWithChoropleth
