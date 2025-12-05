"use client"

import React, { useRef, useEffect, useState, useCallback } from "react"
import "leaflet/dist/leaflet.css"
import "leaflet-draw/dist/leaflet.draw.css"
import "leaflet-geosearch/dist/geosearch.css"
import type { GeoJSON } from "geojson"

let L: any = null
let GeoSearchControl: any = null
let OpenStreetMapProvider: any = null

interface MapWithDrawingProps {
  initialGeometry?: GeoJSON | null
  onGeometryChange: (geometry: GeoJSON | null) => void
  readOnly?: boolean
}

const MapWithDrawing = React.forwardRef<any, MapWithDrawingProps>(
  ({ initialGeometry, onGeometryChange, readOnly = false }, ref) => {
    const mapRef = useRef<any>(null)
    const featureGroupRef = useRef<any>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const containerIdRef = useRef(`map-drawing-${Math.random().toString(36).substr(2, 9)}`)
    
    const [isClient, setIsClient] = useState(false)
    const [isLibrariesLoaded, setIsLibrariesLoaded] = useState(false)
    const [isMapReady, setIsMapReady] = useState(false)
    
    const isInitializedRef = useRef(false)
    const geometryLoadedRef = useRef(false)

    // Marcar como cliente
    useEffect(() => {
      setIsClient(true)
    }, [])

    // Cargar librerías
    useEffect(() => {
      if (!isClient || isLibrariesLoaded) return

      const loadLibraries = async () => {
        try {
          console.log("📚 Loading map libraries...")
          
          // Load Leaflet
          const leafletModule = await import("leaflet")
          L = leafletModule.default

          // Configure Leaflet icons
          delete (L.Icon.Default.prototype as any)._getIconUrl
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
            iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
            shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
          })

          // Load Leaflet Draw
          await import("leaflet-draw")

          // Load GeoSearch
          const geoSearchModule = await import("leaflet-geosearch")
          GeoSearchControl = geoSearchModule.GeoSearchControl
          OpenStreetMapProvider = geoSearchModule.OpenStreetMapProvider

          console.log("✅ Map libraries loaded")
          setIsLibrariesLoaded(true)
        } catch (error) {
          console.error("❌ Error loading map libraries:", error)
        }
      }

      loadLibraries()
    }, [isClient, isLibrariesLoaded])

    // Callback estable para cambios de geometría
    const handleGeometryChangeStable = useCallback(
      (geometry: GeoJSON | null) => {
        console.log("📍 Geometry changed:", geometry ? `${(geometry as any).type}` : "null")
        onGeometryChange(geometry)
      },
      [onGeometryChange]
    )

    // Inicializar mapa
    useEffect(() => {
      if (!isLibrariesLoaded || !containerRef.current || !L || isInitializedRef.current) return

      let map: any = null
      let featureGroup: any = null

      try {
        console.log("🗺️ Initializing drawing map...")

        // Asignar ID único al contenedor
        if (containerRef.current) {
          containerRef.current.id = containerIdRef.current
        }

        // Create map
        map = L.map(containerIdRef.current, {
          center: [10.9878, -74.7889],
          zoom: 12,
          scrollWheelZoom: true,
          dragging: true,
          doubleClickZoom: true,
          boxZoom: true,
        })

        // Add tile layer
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map)

        // Create feature group
        featureGroup = L.featureGroup().addTo(map)
        featureGroupRef.current = featureGroup

        // Add drawing controls if not read-only
        if (!readOnly && L.Control && (L.Control as any).Draw) {
          const drawControl = new (L.Control as any).Draw({
            position: "topright",
            draw: {
              rectangle: {
                shapeOptions: {
                  color: "#3388ff",
                  weight: 3,
                  opacity: 0.8,
                  fillOpacity: 0.2,
                },
              },
              polygon: {
                shapeOptions: {
                  color: "#3388ff",
                  weight: 3,
                  opacity: 0.8,
                  fillOpacity: 0.2,
                },
              },
              polyline: {
                shapeOptions: {
                  color: "#3388ff",
                  weight: 3,
                  opacity: 0.8,
                },
              },
              circle: false,
              marker: true,
              circlemarker: false,
            },
            edit: {
              featureGroup: featureGroup,
              remove: true,
              edit: true,
            },
          })
          map.addControl(drawControl)
        }

        // Add search control if available
        if (GeoSearchControl && OpenStreetMapProvider) {
          const provider = new OpenStreetMapProvider()
          const searchControl = new GeoSearchControl({
            provider: provider,
            style: "bar",
            showMarker: true,
            showPopup: false,
            autoClose: true,
            retainZoomLevel: false,
            animateZoom: true,
            keepResult: true,
            searchLabel: "Buscar dirección",
          })
          map.addControl(searchControl)

          // Handle search results - crear rectángulo del boundingbox
          map.on("geosearch/showlocation", (result: any) => {
            featureGroup.clearLayers()
            geometryLoadedRef.current = false

            const {
              location: {
                raw: { boundingbox },
              },
            } = result

            if (boundingbox) {
              const bounds = new L.LatLngBounds(
                [parseFloat(boundingbox[0]), parseFloat(boundingbox[2])],
                [parseFloat(boundingbox[1]), parseFloat(boundingbox[3])]
              )
              
              const rectangle = L.rectangle(bounds, {
                color: "#3388ff",
                weight: 3,
                opacity: 0.8,
                fillOpacity: 0.2,
              })
              
              featureGroup.addLayer(rectangle)
              map.fitBounds(bounds, { padding: [50, 50] })
              
              const geoJson = rectangle.toGeoJSON()
              handleGeometryChangeStable(geoJson)
              
              console.log("✅ Geometry created from search")
            }
          })
        }

        // Add drawing event listeners
        if ((L as any).Draw) {
          // Evento: nueva figura creada
          map.on((L as any).Draw.Event.CREATED, (e: any) => {
            const layer = e.layer
            featureGroup.clearLayers()
            featureGroup.addLayer(layer)
            geometryLoadedRef.current = false

            try {
              const geoJson = layer.toGeoJSON()
              handleGeometryChangeStable(geoJson)
              console.log("✅ New shape created:", geoJson.geometry.type)
            } catch (error) {
              console.error("❌ Error converting layer to GeoJSON:", error)
            }
          })

          // Evento: figura editada
          map.on((L as any).Draw.Event.EDITED, (e: any) => {
            const layers = e.layers
            const features: GeoJSON[] = []

            layers.eachLayer((layer: any) => {
              if ("toGeoJSON" in layer && typeof layer.toGeoJSON === "function") {
                try {
                  const geo = layer.toGeoJSON() as GeoJSON
                  features.push(geo)
                } catch (error) {
                  console.error("❌ Error converting edited layer to GeoJSON:", error)
                }
              }
            })

            if (features.length === 1) {
              handleGeometryChangeStable(features[0])
              console.log("✅ Shape edited")
            } else if (features.length > 1) {
              handleGeometryChangeStable({
                type: "FeatureCollection",
                features: features as GeoJSON.Feature[],
              })
              console.log("✅ Multiple shapes edited")
            } else {
              handleGeometryChangeStable(null)
            }
          })

          // Evento: figura eliminada
          map.on((L as any).Draw.Event.DELETED, () => {
            handleGeometryChangeStable(null)
            geometryLoadedRef.current = false
            console.log("🗑️ Shape deleted")
          })
        }

        mapRef.current = map
        isInitializedRef.current = true
        setIsMapReady(true)

        console.log("✅ Drawing map initialized")
      } catch (error) {
        console.error("❌ Error creating map:", error)
      }

      // Cleanup function
      return () => {
        if (map) {
          console.log("🗑️ Cleaning up drawing map")
          map.remove()
          mapRef.current = null
          isInitializedRef.current = false
          geometryLoadedRef.current = false
        }
        featureGroupRef.current = null
        setIsMapReady(false)
      }
    }, [isLibrariesLoaded, readOnly, handleGeometryChangeStable])

    // Cargar geometría inicial (solo una vez)
    useEffect(() => {
      if (
        !isMapReady ||
        !initialGeometry ||
        geometryLoadedRef.current ||
        !featureGroupRef.current ||
        !mapRef.current ||
        !L
      )
        return

      try {
        console.log("📍 Loading initial geometry:", (initialGeometry as any).type)
        
        featureGroupRef.current.clearLayers()

        const geoJsonLayer = L.geoJSON(initialGeometry, {
          style: {
            color: "#3388ff",
            weight: 3,
            opacity: 0.8,
            fillOpacity: 0.2,
          },
          pointToLayer: (feature: any, latlng: any) => {
            return L.marker(latlng)
          },
        })

        featureGroupRef.current.addLayer(geoJsonLayer)

        const bounds = geoJsonLayer.getBounds()
        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, { padding: [50, 50] })
        }

        geometryLoadedRef.current = true
        console.log("✅ Initial geometry loaded")
      } catch (error) {
        console.error("❌ Error loading initial geometry:", error)
      }
    }, [initialGeometry, isMapReady])

    // Invalidar tamaño del mapa cuando sea necesario
    useEffect(() => {
      if (mapRef.current && isMapReady) {
        const timer = setTimeout(() => {
          mapRef.current?.invalidateSize()
        }, 100)
        return () => clearTimeout(timer)
      }
    }, [isMapReady])

    // Exponer métodos al padre
    React.useImperativeHandle(
      ref,
      () => ({
        getMap: () => mapRef.current,
        invalidateMapSize: () => {
          if (mapRef.current) {
            mapRef.current.invalidateSize()
            console.log("🔄 Map size invalidated")
          }
        },
      }),
      []
    )

    if (!isClient || !isLibrariesLoaded) {
      return (
        <div className="flex items-center justify-center h-full bg-gray-100 rounded-md">
          <div className="text-sm text-gray-500">Cargando herramientas de dibujo...</div>
        </div>
      )
    }

    return (
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ minHeight: "300px" }}
      />
    )
  }
)

MapWithDrawing.displayName = "MapWithDrawing"

export default MapWithDrawing
