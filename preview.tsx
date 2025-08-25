"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, ArrowRight } from "lucide-react"

export default function Preview() {
  const [activeTab, setActiveTab] = useState("create-survey")

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Preview de la Aplicación</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-4">
          <TabsTrigger value="create-survey">Crear Encuesta</TabsTrigger>
          <TabsTrigger value="terms">Términos</TabsTrigger>
          <TabsTrigger value="contact">Contacto</TabsTrigger>
          <TabsTrigger value="debug">Depuración</TabsTrigger>
        </TabsList>

        <TabsContent value="create-survey">
          <Card>
            <CardHeader>
              <CardTitle>Crear Encuesta (Responsive)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <img
                  src="/placeholder.svg?height=600&width=800"
                  alt="Formulario de creación de encuesta"
                  className="w-full object-cover"
                />
                <div className="p-4 bg-gray-100">
                  <h3 className="font-medium mb-2">Características implementadas:</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Formulario responsive que se adapta a dispositivos móviles</li>
                    <li>Corrección de errores en la API para guardar encuestas</li>
                    <li>Mejor manejo de errores y logs detallados</li>
                    <li>Navegación mejorada entre pasos</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <h3 className="font-medium">Código de ejemplo para guardar encuestas:</h3>
                <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-x-auto">
                  {`// En app/api/surveys/route.ts
export async function POST(request: Request) {
  try {
    console.log("POST /api/surveys - Creando encuesta")
    const body = await request.json()
    
    // Obtener usuario actual
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    
    // Crear encuesta
    const { data: surveyData, error: surveyError } = await supabase
      .from("surveys")
      .insert({
        title: body.title,
        description: body.description,
        // ... otros campos
      })
      .select()
      .single()
      
    // ... resto del código
  } catch (error) {
    console.error("Error al crear encuesta:", error)
    return NextResponse.json({ error: "Error al crear la encuesta" }, { status: 500 })
  }
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terms">
          <Card>
            <CardHeader>
              <CardTitle>Página de Términos y Condiciones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <div className="p-6">
                  <h2 className="text-2xl font-bold mb-4">Términos y Condiciones</h2>
                  <p className="text-sm text-gray-500 mb-6">Última actualización: {new Date().toLocaleDateString()}</p>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium">1. Introducción</h3>
                      <p>
                        Bienvenido a SurveyPro. Estos términos y condiciones rigen el uso de nuestra plataforma de
                        encuestas y todos los servicios relacionados.
                      </p>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium">2. Uso del Servicio</h3>
                      <p>
                        Al utilizar nuestra plataforma, usted acepta cumplir con estos términos y condiciones. Si no
                        está de acuerdo con alguna parte de estos términos, no podrá acceder al servicio.
                      </p>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium">3. Privacidad de Datos</h3>
                      <p>
                        Nos comprometemos a proteger la privacidad de los datos recopilados a través de nuestra
                        plataforma. Para más información, consulte nuestra Política de Privacidad.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-green-50 rounded-md border border-green-200">
                <p className="text-green-800">✓ Esta página ahora existe y no causará errores 404</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact">
          <Card>
            <CardHeader>
              <CardTitle>Página de Contacto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <div className="p-6">
                  <h2 className="text-2xl font-bold mb-4">Contacto</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-medium mb-3">Información de Contacto</h3>
                      <div className="space-y-2">
                        <p>
                          <span className="font-medium">Dirección:</span> Av. Ejemplo 1234, Ciudad, País
                        </p>
                        <p>
                          <span className="font-medium">Teléfono:</span> +1 (555) 123-4567
                        </p>
                        <p>
                          <span className="font-medium">Email:</span> soporte@surveypro.com
                        </p>
                      </div>
                    </div>

                    <div className="border rounded-md p-4">
                      <h3 className="text-lg font-medium mb-3">Formulario de Contacto</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Nombre</label>
                          <div className="h-10 bg-gray-100 rounded-md"></div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Email</label>
                          <div className="h-10 bg-gray-100 rounded-md"></div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Mensaje</label>
                          <div className="h-24 bg-gray-100 rounded-md"></div>
                        </div>
                        <div className="h-10 bg-blue-600 rounded-md"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-green-50 rounded-md border border-green-200">
                <p className="text-green-800">✓ Esta página ahora existe y no causará errores 404</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debug">
          <Card>
            <CardHeader>
              <CardTitle>Herramientas de Depuración</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <div className="p-6">
                  <h2 className="text-2xl font-bold mb-4">Depuración de Supabase</h2>

                  <div className="space-y-6">
                    <div className="border rounded-md p-4">
                      <h3 className="text-lg font-medium mb-3">Verificación de Conexión</h3>
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
                          <span>
                            Conexión a Supabase: <span className="font-medium text-green-600">OK</span>
                          </span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
                          <span>
                            Autenticación: <span className="font-medium text-green-600">OK</span>
                          </span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
                          <span>
                            Permisos: <span className="font-medium text-green-600">OK</span>
                          </span>
                        </div>
                        <Button className="mt-2">Verificar Conexión</Button>
                      </div>
                    </div>

                    <div className="border rounded-md p-4">
                      <h3 className="text-lg font-medium mb-3">Verificación de Tablas</h3>
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 font-medium">
                          <div>Tabla</div>
                          <div>Estado</div>
                          <div>Registros</div>
                        </div>
                        <div className="grid grid-cols-3">
                          <div>surveys</div>
                          <div className="text-green-600">Existe</div>
                          <div>12</div>
                        </div>
                        <div className="grid grid-cols-3">
                          <div>questions</div>
                          <div className="text-green-600">Existe</div>
                          <div>45</div>
                        </div>
                        <div className="grid grid-cols-3">
                          <div>responses</div>
                          <div className="text-green-600">Existe</div>
                          <div>78</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-md border border-blue-200">
                <p className="text-blue-800">ℹ️ Esta página te ayudará a diagnosticar problemas con Supabase</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Pasos para implementar los cambios</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal pl-5 space-y-4">
              <li>
                <p className="font-medium">Agregar las páginas faltantes</p>
                <p className="text-sm text-gray-600">
                  Implementa las páginas de términos, contacto y recuperación de contraseña para evitar errores 404.
                </p>
              </li>
              <li>
                <p className="font-medium">Actualizar la API de encuestas</p>
                <p className="text-sm text-gray-600">
                  Reemplaza el archivo app/api/surveys/route.ts con la versión mejorada que incluye mejor manejo de
                  errores.
                </p>
              </li>
              <li>
                <p className="font-medium">Mejorar la responsividad</p>
                <p className="text-sm text-gray-600">
                  Actualiza el formulario de creación de encuestas para que sea responsive en dispositivos móviles.
                </p>
              </li>
              <li>
                <p className="font-medium">Agregar herramientas de depuración</p>
                <p className="text-sm text-gray-600">
                  Implementa los componentes de depuración para diagnosticar problemas con Supabase.
                </p>
              </li>
            </ol>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <Button variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
          <Button className="flex items-center gap-2">
            Implementar Cambios <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
