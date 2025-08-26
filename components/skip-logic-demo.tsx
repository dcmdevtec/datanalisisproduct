import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, ArrowDown, CheckCircle, Eye, Settings, ArrowUp } from 'lucide-react'

export function SkipLogicDemo() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Nueva Interfaz de Lógica de Salto
        </h1>
        <p className="text-xl text-muted-foreground">
          Diseño responsive y visualmente atractivo para configurar la lógica de salto en encuestas
        </p>
      </div>

      {/* Demo de la interfaz mejorada */}
      <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-6 w-6 text-green-600" />
              Lógica de Salto - Regla 1
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Activa
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Question Preview */}
          <div className="bg-gradient-to-r from-green-100 to-green-50 p-6 rounded-xl border-2 border-green-300 relative">
            <div className="absolute top-3 right-3">
              <div className="flex items-center gap-1 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                <CheckCircle className="h-4 w-4" />
                Condición cumplida
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-green-800 text-lg">¿Cuál es tu color favorito?</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full border-2 border-green-500 bg-green-500"></div>
                  <span className="text-green-700 font-medium">Azul</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                  <span className="text-green-700">Rojo</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                  <span className="text-green-700">Verde</span>
                </div>
              </div>
            </div>
          </div>

          {/* Flow Arrow */}
          <div className="flex items-center justify-center">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <ArrowDown className="h-6 w-6 text-white" />
            </div>
          </div>

          {/* Condition Builder */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-dashed border-blue-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-blue-800">Si la respuesta</span>
              </div>
              <div className="bg-white border-blue-300 rounded-md px-3 py-2 text-blue-800 font-medium">
                es igual a
              </div>
              <div className="bg-white border-blue-300 rounded-md px-3 py-2 text-blue-800 font-medium">
                Azul
              </div>
            </div>
          </div>

          {/* Flow Arrow */}
          <div className="flex items-center justify-center">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
              <ArrowDown className="h-6 w-6 text-white" />
            </div>
          </div>

          {/* Action Block */}
          <div className="bg-gradient-to-r from-purple-100 to-pink-50 p-6 rounded-xl border-2 border-purple-300">
            <div className="space-y-4">
              <h4 className="font-semibold text-purple-800 text-center text-lg">Entonces ir a:</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-purple-700">Sección:</label>
                  <div className="bg-white border-purple-300 rounded-md px-3 py-2 text-purple-800 font-medium">
                    Sección de Colores
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-purple-700">Pregunta específica:</label>
                  <div className="bg-white border-purple-300 rounded-md px-3 py-2 text-purple-800 font-medium">
                    ¿Qué tono de azul prefieres?
                  </div>
                </div>
              </div>

              {/* Visual Flow Preview */}
              <div className="mt-4 p-4 bg-white rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 text-sm text-purple-700">
                  <ArrowRight className="h-4 w-4" />
                  <span>Saltar a: <strong>Sección de Colores</strong></span>
                  <span>→</span>
                  <span><strong>¿Qué tono de azul prefieres?</strong></span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Características responsive */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              Responsive Design
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-800">
              La interfaz se adapta perfectamente a todos los tamaños de pantalla, desde móviles hasta escritorio.
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUp className="h-5 w-5 text-green-600" />
              Visual Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-800">
              Flujo visual claro con flechas y colores que guían al usuario a través de la configuración.
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-purple-600" />
              Configuración Intuitiva
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-purple-800">
              Interfaz intuitiva que permite configurar reglas complejas de manera simple y visual.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Instrucciones de uso */}
      <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800">
            📋 Cómo usar la nueva interfaz
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-orange-800">1. Configurar Condición</h4>
              <ul className="text-sm text-orange-700 space-y-1 list-disc list-inside">
                <li>Selecciona la pregunta que activará el salto</li>
                <li>Elige el operador de comparación</li>
                <li>Define el valor que debe cumplirse</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold text-orange-800">2. Definir Destino</h4>
              <ul className="text-sm text-orange-700 space-y-1 list-disc list-inside">
                <li>Selecciona la sección objetivo</li>
                <li>Opcionalmente, elige una pregunta específica</li>
                <li>Visualiza el flujo de salto</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 p-3 bg-orange-100 rounded-lg">
            <p className="text-sm text-orange-800 font-medium">
              💡 <strong>Consejo:</strong> La interfaz te muestra en tiempo real cómo se verá el flujo de salto, 
              facilitando la configuración de encuestas complejas.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
