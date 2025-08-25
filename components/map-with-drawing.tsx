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
    const [isClient, setIsClient] = useState(false)
    const [isLibrariesLoaded, setIsLibrariesLoaded] = useState(false)
    const [isMapReady, setIsMapReady] = useState(false)

    useEffect(() => {
      setIsClient(true)
    }, [])

    useEffect(() => {
      if (!isClient) return

      const loadLibraries = async () => {
        try {
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

          setIsLibrariesLoaded(true)
        } catch (error) {
          console.error("Error loading map libraries:", error)
        }
      }

      loadLibraries()
    }, [isClient])

    const handleGeometryChange = useCallback(
      (geometry: GeoJSON | null) => {
        onGeometryChange(geometry)
      },
      [onGeometryChange],
    )

    useEffect(() => {
      if (!isLibrariesLoaded || !containerRef.current || !L) return

      let map: any = null
      let featureGroup: any = null

      try {
        // Create map
        map = L.map(containerRef.current, {
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
        }).addTo(map)

        // Create feature group
        featureGroup = L.featureGroup().addTo(map)
        featureGroupRef.current = featureGroup

        // Add drawing controls if not read-only
        if (!readOnly && L.Control && (L.Control as any).Draw) {
          const drawControl = new (L.Control as any).Draw({
            position: "topright",
            draw: {
              rectangle: true,
              polygon: true,
              polyline: true,
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
          })
          map.addControl(searchControl)

          // Handle search results
          map.on("geosearch/showlocation", (result: any) => {
            featureGroup.clearLayers()
            const {
              location: {
                raw: { boundingbox },
              },
            } = result
            if (boundingbox) {
              const bounds = new L.LatLngBounds([boundingbox[0], boundingbox[2]], [boundingbox[1], boundingbox[3]])
              const rectangle = L.rectangle(bounds, {
                color: "#3388ff",
                weight: 3,
                opacity: 0.8,
                fillOpacity: 0.2,
              })
              featureGroup.addLayer(rectangle)
              map.fitBounds(bounds)
              handleGeometryChange(rectangle.toGeoJSON())
            }
          })
        }

        // Add drawing event listeners
        if ((L as any).Draw) {
          map.on((L as any).Draw.Event.CREATED, (e: any) => {
            const layer = e.layer
            featureGroup.clearLayers()
            featureGroup.addLayer(layer)

            try {
              const geoJson = layer.toGeoJSON()
              handleGeometryChange(geoJson)
            } catch (error) {
              console.error("Error converting layer to GeoJSON:", error)
            }
          })

          map.on((L as any).Draw.Event.EDITED, (e: any) => {
            const layers = e.layers
            const features: GeoJSON[] = []

            layers.eachLayer((layer: any) => {
              if ("toGeoJSON" in layer && typeof layer.toGeoJSON === "function") {
                try {
                  const geo = layer.toGeoJSON() as GeoJSON
                  features.push(geo)
                } catch (error) {
                  console.error("Error converting edited layer to GeoJSON:", error)
                }
              }
            })

            if (features.length === 1) {
              handleGeometryChange(features[0])
            } else if (features.length > 1) {
              handleGeometryChange({
                type: "FeatureCollection",
                features: features as GeoJSON.Feature[],
              })
            } else {
              handleGeometryChange(null)
            }
          })

          map.on((L as any).Draw.Event.DELETED, () => {
            handleGeometryChange(null)
          })
        }

        mapRef.current = map
        setIsMapReady(true)
      } catch (error) {
        console.error("Error creating map:", error)
      }

      // Cleanup function
      return () => {
        if (map) {
          map.remove()
          mapRef.current = null
        }
        featureGroupRef.current = null
        setIsMapReady(false)
      }
    }, [isLibrariesLoaded, readOnly, handleGeometryChange])

    useEffect(() => {
      if (!isMapReady || !initialGeometry || !featureGroupRef.current || !mapRef.current || !L) return

      try {
        featureGroupRef.current.clearLayers()

        const geoJsonLayer = L.geoJSON(initialGeometry, {
          style: {
            color: "#3388ff",
            weight: 3,
            opacity: 0.8,
            fillOpacity: 0.2,
          },
        })

        featureGroupRef.current.addLayer(geoJsonLayer)

        const bounds = geoJsonLayer.getBounds()
        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, { padding: [20, 20] })
        }
      } catch (error) {
        console.error("Error loading initial geometry:", error)
      }
    }, [initialGeometry, isMapReady])

    React.useImperativeHandle(
      ref,
      () => ({
        getMap: () => mapRef.current,
        invalidateMapSize: () => {
          if (mapRef.current) {
            mapRef.current.invalidateSize()
          }
        },
      }),
      [],
    )

    if (!isClient || !isLibrariesLoaded) {
      return (
        <div className="flex items-center justify-center h-full bg-gray-100 rounded-md">
          <div className="text-sm text-gray-500">Cargando herramientas de dibujo...</div>
        </div>
      )
    }

    return <div ref={containerRef} className="h-full w-full" />
  },
)

MapWithDrawing.displayName = "MapWithDrawing"

export default MapWithDrawing
