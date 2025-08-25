"use client"

import { EditControl } from "react-leaflet-draw"
import { useRef, useEffect } from "react"
import type { GeoJSON } from "geojson"
import L from "leaflet"
import type { FeatureGroup } from "leaflet"

// Configuración de iconos para Leaflet (necesario en el lado del cliente)
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

interface Props {
  featureGroupRef: React.RefObject<FeatureGroup>
  onGeometryChange: (geometry: GeoJSON | null) => void
}

export default function LeafletDrawControl({ featureGroupRef, onGeometryChange }: Props) {
  
  const _onCreated = (e: L.DrawEvents.Created) => {
    const layer = e.layer
    const geoJson = layer.toGeoJSON()
    
    // Agregar la capa al FeatureGroup
    if (featureGroupRef.current) {
      featureGroupRef.current.addLayer(layer);
    }
    
    onGeometryChange(geoJson)
  }

  const _onEdited = (e: L.DrawEvents.Edited) => {
    const layers = e.layers
    const features: GeoJSON[] = []

    layers.eachLayer((layer: L.Layer) => {
      if ('toGeoJSON' in layer && typeof layer.toGeoJSON === 'function') {
        const geo = layer.toGeoJSON() as GeoJSON
        features.push(geo)
      }
    })

    // Si hay más de una capa editada, se devuelve un FeatureCollection
    if (features.length > 1) {
      onGeometryChange({
        type: "FeatureCollection",
        features: features as GeoJSON.Feature[]
      })
    } else if (features.length === 1) {
      onGeometryChange(features[0])
    } else {
      onGeometryChange(null)
    }
  }

  const _onDeleted = (e: L.DrawEvents.Deleted) => {
    // Verificar si quedan capas en el FeatureGroup
    if (featureGroupRef.current && featureGroupRef.current.getLayers().length === 0) {
      onGeometryChange(null)
    } else {
      // Si quedan capas, obtener todas las geometrías restantes
      const remainingFeatures: GeoJSON[] = []
      
      if (featureGroupRef.current) {
        featureGroupRef.current.eachLayer((layer: L.Layer) => {
          if ('toGeoJSON' in layer && typeof layer.toGeoJSON === 'function') {
            const geo = layer.toGeoJSON() as GeoJSON
            remainingFeatures.push(geo)
          }
        })
      }
      
      if (remainingFeatures.length > 1) {
        onGeometryChange({
          type: "FeatureCollection",
          features: remainingFeatures as GeoJSON.Feature[]
        })
      } else if (remainingFeatures.length === 1) {
        onGeometryChange(remainingFeatures[0])
      } else {
        onGeometryChange(null)
      }
    }
  }

  // Renderizar solo si el featureGroupRef está disponible
  if (!featureGroupRef.current) {
    return null;
  }

  return (
    <EditControl
      position="topright"
      onCreated={_onCreated}
      onEdited={_onEdited}
      onDeleted={_onDeleted}
      draw={{
        rectangle: true,
        polygon: true,
        polyline: true,
        circle: false,
        marker: false,
        circlemarker: false,
      }}
      edit={{
        featureGroup: featureGroupRef.current,
        remove: true,
      }}
    />
  )
}