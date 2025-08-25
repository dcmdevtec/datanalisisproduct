"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"

export default function PreviewPage() {
  const [date, setDate] = useState<Date>()
  const [activeTab, setActiveTab] = useState("question-types")

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Módulo de Previsualización</h1>
      <p className="text-muted-foreground mb-8">
        Utiliza este módulo para previsualizar y probar diferentes componentes de la plataforma de encuestas.
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="question-types">Tipos de Preguntas</TabsTrigger>
          <TabsTrigger value="ui-components">Componentes UI</TabsTrigger>
          <TabsTrigger value="mobile-preview">Vista Móvil</TabsTrigger>
        </TabsList>

        <TabsContent value="question-types" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tipos de Preguntas</CardTitle>
              <CardDescription>Previsualiza los diferentes tipos de preguntas disponibles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Pregunta de texto */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium">Pregunta de Texto</h3>
                <div className="space-y-2">
                  <Label htmlFor="text-question">¿Cuál es tu opinión sobre nuestro servicio?</Label>
                  <Textarea id="text-question" placeholder="Escribe tu respuesta aquí..." />
                </div>
              </div>

              {/* Pregunta de opción múltiple */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium">Opción Múltiple</h3>
                <div className="space-y-2">
                  <Label>¿Cómo calificarías nuestro servicio?</Label>
                  <RadioGroup defaultValue="satisfecho">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="muy-satisfecho" id="muy-satisfecho" />
                      <Label htmlFor="muy-satisfecho">Muy satisfecho</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="satisfecho" id="satisfecho" />
                      <Label htmlFor="satisfecho">Satisfecho</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="neutral" id="neutral" />
                      <Label htmlFor="neutral">Neutral</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="insatisfecho" id="insatisfecho" />
                      <Label htmlFor="insatisfecho">Insatisfecho</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="muy-insatisfecho" id="muy-insatisfecho" />
                      <Label htmlFor="muy-insatisfecho">Muy insatisfecho</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {/* Pregunta de casillas de verificación */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium">Casillas de Verificación</h3>
                <div className="space-y-2">
                  <Label>¿Qué características te gustan de nuestro producto? (Selecciona todas las que apliquen)</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="feature1" />
                      <Label htmlFor="feature1">Facilidad de uso</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="feature2" />
                      <Label htmlFor="feature2">Diseño</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="feature3" />
                      <Label htmlFor="feature3">Funcionalidad</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="feature4" />
                      <Label htmlFor="feature4">Precio</Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pregunta de escala */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium">Escala</h3>
                <div className="space-y-4">
                  <Label>¿Qué tan probable es que recomiendes nuestro producto a un amigo? (1-10)</Label>
                  <Slider defaultValue={[5]} max={10} step={1} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                    <span>5</span>
                    <span>6</span>
                    <span>7</span>
                    <span>8</span>
                    <span>9</span>
                    <span>10</span>
                  </div>
                </div>
              </div>

              {/* Pregunta de fecha */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium">Fecha</h3>
                <div className="space-y-2">
                  <Label>¿Cuándo utilizaste nuestro servicio?</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Selecciona una fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Pregunta de selección */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium">Selección</h3>
                <div className="space-y-2">
                  <Label>¿En qué ciudad vives?</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una ciudad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cdmx">Ciudad de México</SelectItem>
                      <SelectItem value="guadalajara">Guadalajara</SelectItem>
                      <SelectItem value="monterrey">Monterrey</SelectItem>
                      <SelectItem value="puebla">Puebla</SelectItem>
                      <SelectItem value="tijuana">Tijuana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ui-components" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Componentes de UI</CardTitle>
              <CardDescription>Previsualiza los componentes de interfaz de usuario</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Botones</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button>Default</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="destructive">Destructive</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="link">Link</Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Inputs</h3>
                  <div className="space-y-2">
                    <Input placeholder="Texto normal" />
                    <Input placeholder="Deshabilitado" disabled />
                    <Input type="email" placeholder="Email" />
                    <Input type="password" placeholder="Contraseña" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Cards</h3>
                  <Card>
                    <CardHeader>
                      <CardTitle>Título de Card</CardTitle>
                      <CardDescription>Descripción de la card</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p>Contenido de la card</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Selects</h3>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una opción" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="option1">Opción 1</SelectItem>
                      <SelectItem value="option2">Opción 2</SelectItem>
                      <SelectItem value="option3">Opción 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mobile-preview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Vista Móvil</CardTitle>
              <CardDescription>Previsualiza cómo se verán los componentes en dispositivos móviles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mx-auto max-w-[375px] border-8 border-gray-800 rounded-3xl p-2 bg-gray-800">
                <div className="rounded-2xl overflow-hidden h-[600px] bg-background">
                  <div className="p-4 space-y-4">
                    <h3 className="text-lg font-medium">Encuesta de Satisfacción</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>¿Cómo calificarías tu experiencia?</Label>
                        <RadioGroup defaultValue="buena">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="excelente" id="mobile-excelente" />
                            <Label htmlFor="mobile-excelente">Excelente</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="buena" id="mobile-buena" />
                            <Label htmlFor="mobile-buena">Buena</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="regular" id="mobile-regular" />
                            <Label htmlFor="mobile-regular">Regular</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="mala" id="mobile-mala" />
                            <Label htmlFor="mobile-mala">Mala</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="mobile-comentario">Comentarios adicionales</Label>
                        <Textarea id="mobile-comentario" placeholder="Escribe tus comentarios..." />
                      </div>

                      <Button className="w-full">Enviar Respuesta</Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
