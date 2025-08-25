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
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Reportes y Análisis</h1>
            <p className="text-muted-foreground">Visualiza y analiza los datos recopilados</p>
          </div>
          <div className=" mt-10 flex flex-col sm:flex-row gap-2">
            <Select value={selectedSurvey} onValueChange={setSelectedSurvey}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Seleccionar encuesta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las encuestas</SelectItem>
                <SelectItem value="1">Encuesta de Satisfacción</SelectItem>
                <SelectItem value="2">Investigación de Mercado</SelectItem>
                <SelectItem value="3">Compromiso de Empleados</SelectItem>
                <SelectItem value="4">Evaluación Comunitaria</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Seleccionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Última semana</SelectItem>
                <SelectItem value="month">Último mes</SelectItem>
                <SelectItem value="quarter">Último trimestre</SelectItem>
                <SelectItem value="year">Último año</SelectItem>
                <SelectItem value="all">Todo el tiempo</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" /> Exportar
            </Button>
          </div>
        </div>

        <Tabs defaultValue="summary" className="space-y-6">
          <TabsList>
            <TabsTrigger value="summary">Resumen</TabsTrigger>
            <TabsTrigger value="responses">Respuestas</TabsTrigger>
            <TabsTrigger value="performance">Rendimiento</TabsTrigger>
            <TabsTrigger value="geographic">Geográfico</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-6">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Total de Respuestas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">1,234</div>
                      <p className="text-xs text-muted-foreground">+24% desde el período anterior</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Tasa de Finalización</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">78%</div>
                      <p className="text-xs text-muted-foreground">+5% desde el período anterior</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">4:32</div>
                      <p className="text-xs text-muted-foreground">-12% desde el período anterior</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">NPS</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">42</div>
                      <p className="text-xs text-muted-foreground">+8 puntos desde el período anterior</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Respuestas por Tiempo</CardTitle>
                      <CardDescription>Evolución de respuestas en el tiempo</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80 flex items-center justify-center">
                      <TrendingUp className="h-16 w-16 text-muted-foreground" />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Distribución de Respuestas</CardTitle>
                      <CardDescription>Distribución por tipo de respuesta</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80 flex items-center justify-center">
                      <PieChart className="h-16 w-16 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Principales Hallazgos</CardTitle>
                    <CardDescription>Insights clave de los datos recopilados</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-medium mb-2">Alta satisfacción en servicio al cliente</h3>
                      <p className="text-muted-foreground">
                        El 85% de los encuestados calificó el servicio al cliente como "Excelente" o "Bueno", lo que
                        representa un aumento del 10% respecto al período anterior.
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-medium mb-2">Área de mejora: Tiempos de respuesta</h3>
                      <p className="text-muted-foreground">
                        El 42% de los comentarios negativos mencionan los tiempos de respuesta como un área que necesita
                        mejora.
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-medium mb-2">Diferencias regionales significativas</h3>
                      <p className="text-muted-foreground">
                        Las respuestas de la Zona Norte muestran un NPS 15 puntos más alto que las de la Zona Sur.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="responses" className="space-y-6">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Análisis de Respuestas</CardTitle>
                  <CardDescription>Desglose detallado de las respuestas por pregunta</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">¿Cómo calificarías nuestro servicio?</h3>
                    <div className="h-64 bg-muted/50 rounded-lg flex items-center justify-center">
                      <BarChart3 className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                      <div className="p-2 border rounded-md">
                        <div className="text-lg font-bold">45%</div>
                        <div className="text-sm text-muted-foreground">Excelente</div>
                      </div>
                      <div className="p-2 border rounded-md">
                        <div className="text-lg font-bold">30%</div>
                        <div className="text-sm text-muted-foreground">Bueno</div>
                      </div>
                      <div className="p-2 border rounded-md">
                        <div className="text-lg font-bold">15%</div>
                        <div className="text-sm text-muted-foreground">Regular</div>
                      </div>
                      <div className="p-2 border rounded-md">
                        <div className="text-lg font-bold">7%</div>
                        <div className="text-sm text-muted-foreground">Malo</div>
                      </div>
                      <div className="p-2 border rounded-md">
                        <div className="text-lg font-bold">3%</div>
                        <div className="text-sm text-muted-foreground">Muy Malo</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">¿Qué tan probable es que recomiendes nuestro producto?</h3>
                    <div className="h-64 bg-muted/50 rounded-lg flex items-center justify-center">
                      <BarChart3 className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-2 border rounded-md">
                        <div className="text-lg font-bold">52%</div>
                        <div className="text-sm text-muted-foreground">Promotores (9-10)</div>
                      </div>
                      <div className="p-2 border rounded-md">
                        <div className="text-lg font-bold">38%</div>
                        <div className="text-sm text-muted-foreground">Pasivos (7-8)</div>
                      </div>
                      <div className="p-2 border rounded-md">
                        <div className="text-lg font-bold">10%</div>
                        <div className="text-sm text-muted-foreground">Detractores (0-6)</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Comentarios más frecuentes</h3>
                    <div className="space-y-2">
                      <div className="p-3 border rounded-md">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium">Excelente servicio al cliente</span>
                          <span className="text-sm text-muted-foreground">32 menciones</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          "El personal fue muy amable y resolvió mi problema rápidamente."
                        </p>
                      </div>
                      <div className="p-3 border rounded-md">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium">Tiempos de espera largos</span>
                          <span className="text-sm text-muted-foreground">24 menciones</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          "Tuve que esperar demasiado tiempo para recibir atención."
                        </p>
                      </div>
                      <div className="p-3 border rounded-md">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium">Buena relación calidad-precio</span>
                          <span className="text-sm text-muted-foreground">18 menciones</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          "El producto ofrece un excelente valor por el precio pagado."
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Rendimiento de Encuestadores</CardTitle>
                    <CardDescription>Métricas de productividad por encuestador</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="rounded-md border">
                        <div className="grid grid-cols-5 p-3 font-medium border-b">
                          <div>Encuestador</div>
                          <div className="text-center">Encuestas</div>
                          <div className="text-center">Tiempo Promedio</div>
                          <div className="text-center">Tasa de Finalización</div>
                          <div className="text-center">Calidad</div>
                        </div>
                        <div className="divide-y">
                          <div className="grid grid-cols-5 p-3 items-center">
                            <div>Juan Díaz</div>
                            <div className="text-center">87</div>
                            <div className="text-center">4:12</div>
                            <div className="text-center">92%</div>
                            <div className="text-center">4.8/5</div>
                          </div>
                          <div className="grid grid-cols-5 p-3 items-center">
                            <div>María López</div>
                            <div className="text-center">64</div>
                            <div className="text-center">5:05</div>
                            <div className="text-center">88%</div>
                            <div className="text-center">4.7/5</div>
                          </div>
                          <div className="grid grid-cols-5 p-3 items-center">
                            <div>Carlos Rodríguez</div>
                            <div className="text-center">52</div>
                            <div className="text-center">4:45</div>
                            <div className="text-center">85%</div>
                            <div className="text-center">4.5/5</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Encuestas por Día</CardTitle>
                      <CardDescription>Número de encuestas completadas por día</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80 flex items-center justify-center">
                      <BarChart3 className="h-16 w-16 text-muted-foreground" />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Tiempo Promedio por Encuesta</CardTitle>
                      <CardDescription>Evolución del tiempo promedio de encuesta</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80 flex items-center justify-center">
                      <TrendingUp className="h-16 w-16 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="geographic" className="space-y-6">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Distribución Geográfica</CardTitle>
                    <CardDescription>Visualización de respuestas por ubicación</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-96 bg-muted/50 rounded-lg flex items-center justify-center mb-4">
                      <p className="text-muted-foreground">Mapa de distribución de respuestas</p>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Respuestas por Zona</CardTitle>
                      <CardDescription>Distribución de respuestas por zona geográfica</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span>Zona Norte</span>
                            <span className="font-medium">452 respuestas</span>
                          </div>
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: "45%" }} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span>Zona Centro</span>
                            <span className="font-medium">324 respuestas</span>
                          </div>
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: "32%" }} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span>Zona Sur</span>
                            <span className="font-medium">235 respuestas</span>
                          </div>
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: "23%" }} />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Comparativa por Zona</CardTitle>
                      <CardDescription>Comparación de métricas clave por zona</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border">
                        <div className="grid grid-cols-4 p-3 font-medium border-b">
                          <div>Zona</div>
                          <div className="text-center">NPS</div>
                          <div className="text-center">Satisfacción</div>
                          <div className="text-center">Tiempo Promedio</div>
                        </div>
                        <div className="divide-y">
                          <div className="grid grid-cols-4 p-3 items-center">
                            <div>Zona Norte</div>
                            <div className="text-center">48</div>
                            <div className="text-center">4.2/5</div>
                            <div className="text-center">4:05</div>
                          </div>
                          <div className="grid grid-cols-4 p-3 items-center">
                            <div>Zona Centro</div>
                            <div className="text-center">42</div>
                            <div className="text-center">4.0/5</div>
                            <div className="text-center">4:32</div>
                          </div>
                          <div className="grid grid-cols-4 p-3 items-center">
                            <div>Zona Sur</div>
                            <div className="text-center">33</div>
                            <div className="text-center">3.7/5</div>
                            <div className="text-center">5:10</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
