"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarChart3, Download, Loader2, PieChart, TrendingUp } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [selectedSurvey, setSelectedSurvey] = useState<string>("all")
  const [selectedPeriod, setSelectedPeriod] = useState<string>("month")

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    // Simular carga de datos
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [selectedSurvey, selectedPeriod])

  if (authLoading || !user) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen flex items-center justify-center p-4 md:p-8 bg-gradient-to-br from-slate-50 via-green-50 to-emerald-100">
        <Card className="max-w-2xl w-full shadow-2xl border-0 bg-white/90">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="h-6 w-6 text-green-600" />
              <CardTitle className="text-3xl font-bold text-gray-900">Control de Versiones del Sistema</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Versión 1.0.0 - Despliegue Inicial</h2>
                <p className="text-gray-700 mb-2">📅 Fecha de liberación: 29 de agosto del 2025</p>
                <h3 className="font-bold text-green-700 mb-1">🆕 Nuevas Funcionalidades:</h3>
                <ul className="list-disc ml-6 text-gray-700 mb-2">
                  <li>Módulos principales:</li>
                  <ul className="list-disc ml-8">
                    <li>Gestión de Empresas</li>
                    <li>Gestión de Proyectos</li>
                    <li>Gestión de Encuestas</li>
                    <li>Gestión de Zonas</li>
                  </ul>
                  <li>Configuración:</li>
                  <ul className="list-disc ml-8">
                    <li>Configuración de Encuestadores</li>
                    <li>Configuración General de Encuestas</li>
                  </ul>
                  <li>Interfaz de Usuario:</li>
                  <ul className="list-disc ml-8">
                    <li>Interfaz principal del sistema</li>
                    <li>Menú de opciones principal</li>
                  </ul>
                  <li>Tipos de Preguntas Habilitadas:</li>
                  <ul className="list-disc ml-8">
                    <li>[Listar los tipos marcados con *]</li>
                  </ul>
                </ul>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Versión 1.0.1 - Expansión de Tipos de Preguntas</h2>
                <p className="text-gray-700 mb-2">📅 Fecha de liberación: 09 de septiembre del 2025</p>
                <h3 className="font-bold text-green-700 mb-1">🆕 Nuevas Funcionalidades:</h3>
                <ul className="list-disc ml-6 text-gray-700 mb-2">
                  <li>Tipos de Preguntas:</li>
                  <ul className="list-disc ml-8">
                    <li>Escala Likert</li>
                    <li>Preguntas tipo Matriz</li>
                  </ul>
                </ul>
                <h3 className="font-bold text-green-700 mb-1">📋 Notas de la Versión:</h3>
                <ul className="list-disc ml-6 text-gray-700">
                  <li>Ampliación de opciones para creación de encuestas más complejas</li>
                  <li>Mejora en la versatilidad del sistema de encuestas</li>
                </ul>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Versión 1.0.2 - Mejoras y Correcciones</h2>
                <p className="text-gray-700 mb-2">📅 Fecha de liberación: 29 de septiembre del 2025</p>
                <h3 className="font-bold text-green-700 mb-1">🆕 Nuevas Funcionalidades y Correcciones:</h3>
                <ul className="list-disc ml-6 text-gray-700 mb-2">
                  <li> Corrección en la creación de zonas.</li>
                  <li> Agregado el estado “modo prueba” en las encuestas.</li>
                  <li> Implementado un guardado de encuestas más sencillo.</li>
                  <li> El enunciado ahora se muestra completamente.</li>
                  <li> Configuración del tipo de fuente para el enunciado.</li>
                  <li> Posibilidad de definir color u otros estilos visuales para el enunciado.</li>
                  <li> Ajustes en la interfaz para mejorar la usabilidad y la ubicación de los botones.</li>
                  <li> Corrección de preguntas mal configuradas, ahora funcionando correctamente.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
