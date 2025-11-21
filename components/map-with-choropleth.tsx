"use client"

import type React from "react"
import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet-geosearch/dist/geosearch.css"
import { GeoSearchControl, OpenStreetMapProvider } from "leaflet-geosearch"
import * as turf from "@turf/turf"
import barranquillaGeoJSON from "@/lib/geo-barranquilla.json"

interface MapWithChoroplethProps {
  initialGeometry?: any
  onGeometryChange?: (geometry: any) => void
  zoneColor: string
  selectedNeighborhoods: string[]
  onNeighborhoodSelect: (neighborhoods: string[]) => void
}

const MapWithChoropleth = forwardRef<any, MapWithChoroplethProps>(({
  initialGeometry,
  onGeometryChange,
  zoneColor,
  selectedNeighborhoods,
  onNeighborhoodSelect,
}, ref) => {
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.GeoJSON | null>(null)

  // Crear capa GeoJSON
  const createChoroplethLayer = useCallback(() => {
    if (!L || !mapRef.current) return null

    return L.geoJSON(barranquillaGeoJSON as any, {
      style: (feature: any) => {
        const barrio = feature.properties?.nombre
        const isSelected = selectedNeighborhoods.includes(barrio)

        return {
          fillColor: isSelected ? zoneColor : "#ccc", // gris si no está seleccionado
          fillOpacity: isSelected ? 0.7 : 0.3,
          color: "#555",
          weight: 1,
          opacity: 1,
        }
      },
      onEachFeature: (feature: any, layer: any) => {
        const barrioNombre = feature.properties?.nombre

        // Popup con info
        layer.bindPopup(`
          <div class="p-2">
            <h3 class="font-semibold text-lg">${barrioNombre}</h3>
            <p class="text-sm">Localidad: ${feature.properties.localidad || "N/A"}</p>
          </div>
        `)

        // Tooltip al pasar
        layer.bindTooltip(barrioNombre, { sticky: true })

        // Click para seleccionar / deseleccionar
        layer.on("click", () => {
          const alreadySelected = selectedNeighborhoods.includes(barrioNombre)
          let updated: string[]

          if (alreadySelected) {
            updated = selectedNeighborhoods.filter(b => b !== barrioNombre)
          } else {
            updated = [...selectedNeighborhoods, barrioNombre]
          }

          onNeighborhoodSelect(updated)
        })
      },
    })
  }, [selectedNeighborhoods, zoneColor, onNeighborhoodSelect])

  // Inicializar mapa
  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map("map", {
        center: [10.9639, -74.7964],
        zoom: 12,
      })

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current)

      // GeoSearch
      const provider = new OpenStreetMapProvider()
      const searchControl = new GeoSearchControl({
        provider,
        style: "bar",
        showMarker: true,
        showPopup: false,
        marker: {
          // @ts-ignore
          icon: new L.Icon.Default(),
          draggable: false,
        },
        autoClose: true,
        keepResult: true,
      })

      mapRef.current.addControl(searchControl as any)

      // 📌 Capturar evento cuando se selecciona algo en el buscador
      mapRef.current.on("geosearch/showlocation", (e: any) => {
        const { x: lng, y: lat } = e.location
        const point = turf.point([lng, lat])

        // Buscar el barrio que contiene ese punto
        const barrioEncontrado = barranquillaGeoJSON.features.find((f: any) =>
          turf.booleanPointInPolygon(point, f as any)
        )

        if (barrioEncontrado) {
          const barrioNombre = barrioEncontrado.properties?.nombre
          console.log("Barrio encontrado:", barrioNombre)

          // Actualizar selección → dispara pintado
          onNeighborhoodSelect([barrioNombre])
        } else {
          console.log("No se encontró un barrio para esa ubicación")
        }
      })
    }
  }, [])

  // Actualizar capa cuando cambian barrios o color
  useEffect(() => {
    if (!mapRef.current) return

    if (layerRef.current) {
      mapRef.current.removeLayer(layerRef.current)
    }

    const newLayer = createChoroplethLayer()
    if (newLayer) {
      newLayer.addTo(mapRef.current)
      layerRef.current = newLayer

      // FitBounds si hay barrios seleccionados
      if (selectedNeighborhoods.length > 0) {
        mapRef.current.fitBounds(newLayer.getBounds())
      }
    }
  }, [createChoroplethLayer, selectedNeighborhoods, zoneColor])

  // Expose map instance to parent
  useImperativeHandle(ref, () => mapRef.current)

  return <div id="map" className="h-[500px] w-full rounded-lg shadow-md" />
})

export default MapWithChoropleth
