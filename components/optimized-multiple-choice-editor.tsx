"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, Settings2, Image, Move, Upload, Edit3 } from "lucide-react"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface Option {
  id: string
  label: string
  image?: string
  hasImage?: boolean
}

interface OptimizedMultipleChoiceEditorProps {
  options: any[]
  questionType: "multiple_choice" | "checkbox" | "dropdown"
  onOptionsChange: (options: any[]) => void
  onAdvancedSettings?: () => void
  allowOther?: boolean
  otherText?: string
  onOtherTextChange?: (text: string) => void
  onAllowOtherChange?: (checked: boolean) => void
  randomizeOptions?: boolean
}

function SortableOption({ 
  option, 
  index, 
  questionType, 
  onUpdate, 
  onRemove, 
  onImageToggle,
  hasImage 
}: {
  option: Option
  index: number
  questionType: "multiple_choice" | "checkbox" | "dropdown"
  onUpdate: (index: number, label: string) => void
  onRemove: (index: number) => void
  onImageToggle: (index: number) => void
  hasImage: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: option.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const icon = questionType === "multiple_choice" ? "○" : questionType === "checkbox" ? "☐" : "▼"

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:border-primary/50 transition-colors group"
    >
      <div 
        {...attributes} 
        {...listeners} 
        className="cursor-move text-muted-foreground hover:text-primary"
      >
        <Move className="h-4 w-4" />
      </div>
      
      <div className="w-6 text-center text-muted-foreground">
        {icon}
      </div>
      
      <Input
        value={option.label}
        onChange={(e) => onUpdate(index, e.target.value)}
        placeholder={`Escribe una opción`}
        className="flex-1 border-none shadow-none focus:ring-0 bg-transparent"
      />
      
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onImageToggle(index)}
          className={hasImage ? "text-green-600" : "text-muted-foreground"}
          title={hasImage ? "Quitar imagen" : "Subir imagen"}
        >
          <Image className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          className="text-red-500 hover:text-red-600"
          title="Eliminar opción"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function OptimizedMultipleChoiceEditor({
  options: rawOptions = [],
  questionType,
  onOptionsChange,
  onAdvancedSettings,
  allowOther,
  otherText = "Otro (especificar)",
  onOtherTextChange,
  onAllowOtherChange,
  randomizeOptions
}: OptimizedMultipleChoiceEditorProps) {
  const [showBulkAdd, setShowBulkAdd] = useState(false)
  const [bulkText, setBulkText] = useState("")

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Convert raw options to normalized format
  const options: Option[] = rawOptions.map((opt, index) => {
    if (typeof opt === "string") {
      return {
        id: `option-${index}`,
        label: opt || '',
        hasImage: false
      }
    }
    return {
      id: `option-${index}`,
      label: opt.label || opt.value || '',
      image: opt.image || opt.url,
      hasImage: !!(opt.image || opt.url)
    }
  })

  const handleDragEnd = (event: any) => {
    const { active, over } = event
    
    if (active.id !== over?.id) {
      const oldIndex = options.findIndex(opt => opt.id === active.id)
      const newIndex = options.findIndex(opt => opt.id === over.id)
      
      const reorderedOptions = [...options]
      const [removed] = reorderedOptions.splice(oldIndex, 1)
      reorderedOptions.splice(newIndex, 0, removed)
      
      // Convert back to raw format
      const rawReordered = reorderedOptions.map(opt => 
        opt.hasImage ? { label: opt.label, image: opt.image } : opt.label
      )
      onOptionsChange(rawReordered)
    }
  }

  const handleOptionUpdate = (index: number, label: string) => {
    const updatedOptions = [...rawOptions]
    if (typeof updatedOptions[index] === "string") {
      updatedOptions[index] = label
    } else {
      updatedOptions[index] = { ...updatedOptions[index], label }
    }
    onOptionsChange(updatedOptions)
  }

  const handleOptionRemove = (index: number) => {
    if (rawOptions.length <= 2) return
    const updatedOptions = rawOptions.filter((_, i) => i !== index)
    onOptionsChange(updatedOptions)
  }

  const handleImageToggle = (index: number) => {
    const updatedOptions = [...rawOptions]
    const option = updatedOptions[index]
    
    if (typeof option === "string") {
      // Add image capability - trigger file input
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) {
          const reader = new FileReader()
          reader.onload = (e) => {
            const imageUrl = e.target?.result as string
            updatedOptions[index] = { label: option, image: imageUrl }
            onOptionsChange(updatedOptions)
          }
          reader.readAsDataURL(file)
        }
      }
      input.click()
    } else if (option.image || option.url) {
      // Remove image capability - convert back to string
      updatedOptions[index] = option.label || option.value || `Opción ${index + 1}`
      onOptionsChange(updatedOptions)
    } else {
      // Add image capability to object - trigger file input
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) {
          const reader = new FileReader()
          reader.onload = (e) => {
            const imageUrl = e.target?.result as string
            updatedOptions[index] = { ...option, image: imageUrl }
            onOptionsChange(updatedOptions)
          }
          reader.readAsDataURL(file)
        }
      }
      input.click()
    }
  }

  const addOption = () => {
    // Add an empty option so the user can type immediately without deleting placeholder text
    const newOption = `""`
    // Use an actual empty string value
    onOptionsChange([...rawOptions, ""])
  }

  const handleBulkAdd = () => {
    if (!bulkText.trim()) return
    
    const newOptions = bulkText
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
    
    if (newOptions.length > 0) {
      onOptionsChange([...rawOptions, ...newOptions])
      setBulkText("")
      setShowBulkAdd(false)
    }
  }

  const addTemplateOptions = (template: string) => {
    const templates = {
      yesno: ["Sí", "No"],
      agreement: ["Muy de acuerdo", "De acuerdo", "Neutral", "En desacuerdo", "Muy en desacuerdo"],
      satisfaction: ["Muy satisfecho", "Satisfecho", "Neutral", "Insatisfecho", "Muy insatisfecho"],
      frequency: ["Siempre", "A menudo", "A veces", "Raramente", "Nunca"],
      quality: ["Excelente", "Muy bueno", "Bueno", "Regular", "Malo"]
    }
    
    const templateOptions = templates[template as keyof typeof templates]
    if (templateOptions) {
      onOptionsChange([...rawOptions, ...templateOptions])
    }
  }

  const optionCount = options.length
  const hasImages = options.some((opt: Option) => opt.hasImage)

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            
            <div className="flex items-center gap-2 mt-1">
              
              {hasImages && <Badge variant="secondary" className="text-xs">Con imágenes</Badge>}
              {randomizeOptions && <Badge variant="secondary" className="text-xs">Aleatorio</Badge>}
              {allowOther && <Badge variant="secondary" className="text-xs">Permite "Otro"</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkAdd(!showBulkAdd)}
                className="gap-1"
              >
                <Edit3 className="h-4 w-4" />
                Múltiples
              </Button>

              {/* Only show 'Permitir Otro' for multiple_choice or checkbox (not dropdown) */}
              {(questionType === "multiple_choice" || questionType === "checkbox") && (
                <div className="flex items-center gap-2">
                  <label
                    className="flex items-center gap-2 cursor-pointer select-none"
                    onClick={() => {
                      // Toggle when label clicked
                      if (typeof onAllowOtherChange === 'function') onAllowOtherChange(!Boolean(allowOther))
                    }}
                  >
                    <Switch
                      checked={Boolean(allowOther)}
                      onCheckedChange={(checked) => {
                        if (typeof onAllowOtherChange === 'function') onAllowOtherChange(Boolean(checked))
                      }}
                      className="data-[state=checked]:bg-emerald-500"
                      aria-label="Permitir Otro"
                    />
                    <span className="text-sm text-gray-700">Permitir "Otro"</span>
                  </label>

                  {allowOther && onOtherTextChange && (
                    <Input
                      value={otherText}
                      onChange={(e) => onOtherTextChange(e.target.value)}
                      placeholder="Texto para 'Otro'"
                      className="w-[220px]"
                    />
                  )}
                </div>
              )}
            </div>
         
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Bulk add interface */}
        {showBulkAdd && (
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
            <Label>Agregar múltiples opciones (una por línea)</Label>
            <Textarea
              placeholder="Opción 1&#10;Opción 2&#10;Opción 3"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={handleBulkAdd} disabled={!bulkText.trim()}>
                Agregar opciones
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => addTemplateOptions("yesno")}
                className="text-xs"
              >
                Sí/No
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => addTemplateOptions("agreement")}
                className="text-xs"
              >
                Acuerdo
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => addTemplateOptions("satisfaction")}
                className="text-xs"
              >
                Satisfacción
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => addTemplateOptions("frequency")}
                className="text-xs"
              >
                Frecuencia
              </Button>
            </div>
          </div>
        )}

        {/* Options list */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={options.map(opt => opt.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {options.map((option, index) => (
                <SortableOption
                  key={option.id}
                  option={option}
                  index={index}
                  questionType={questionType}
                  onUpdate={handleOptionUpdate}
                  onRemove={handleOptionRemove}
                  onImageToggle={handleImageToggle}
                  hasImage={option.hasImage || false}
                />
              ))}

              {/* 'Otro' is represented as a real option in rawOptions; no visual-only preview here. */}
            </div>
          </SortableContext>
        </DndContext>

        {/* Add new option */}
        <Button
          variant="outline"
          onClick={addOption}
          className="w-full mt-4 gap-2 bg-transparent"
        >
          <Plus className="h-4 w-4" />
          Agregar opción
        </Button>

        {/* The 'Otro' option is editable inline among the options list when enabled. */}

        {/* Image preview for options with images - OPTIMIZED: complete but small images */}
        {hasImages && questionType !== "dropdown" && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Vista previa con imágenes</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {options.filter(opt => opt.hasImage).map((option, idx) => (
                <div key={`preview-${option.id}`} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                  {/* Fixed aspect ratio container to show complete images */}
                  <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-gray-400 text-xs relative overflow-hidden">
                    {option.image ? (
                      <img 
                        src={option.image} 
                        alt={option.label} 
                        className="w-full h-full object-contain"
                        style={{ 
                          objectFit: 'contain',
                          maxWidth: '100%',
                          maxHeight: '100%'
                        }}
                      />
                    ) : (
                      <div className="text-center p-2">
                        <Upload className="h-4 w-4 mx-auto mb-1" />
                        <div className="text-xs">Subir imagen</div>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="text-xs truncate" title={option.label}>
                      {option.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}