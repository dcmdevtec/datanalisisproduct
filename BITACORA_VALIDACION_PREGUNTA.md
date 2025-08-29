# BITÁCORA - IMPLEMENTACIÓN DE VALIDACIÓN DE CAMPO DE PREGUNTA

## Fecha de Implementación
[Fecha actual]

## Objetivo
Implementar validación visual que haga que el campo de texto de la pregunta se ponga en rojo cuando esté vacío.

## Archivo Modificado
`components/question-editor.tsx`

## Cambios Realizados

### 1. Agregado Estado de Validación
**Antes:**
```typescript
const [localQuestionText, setLocalQuestionText] = useState<string>(question.text.replace(/<[^>]*>/g, ""))
```

**Después:**
```typescript
const [localQuestionText, setLocalQuestionText] = useState<string>(question.text.replace(/<[^>]*>/g, ""))
const [isQuestionTextValid, setIsQuestionTextValid] = useState<boolean>(true)
```

**Líneas:** 50-51

### 2. Implementada Lógica de Validación en useEffect
**Antes:**
```typescript
useEffect(() => {
  // Ensure debouncedLocalQuestionText is a string before calling trim()
  const currentDebouncedText = debouncedLocalQuestionText || ""

  // Only update the parent state if the debounced text is different from the actual question text
  // and not empty (to avoid clearing text while typing)
  if (question.text.replace(/<[^>]*>/g, "") !== currentDebouncedText && currentDebouncedText.trim() !== "") {
    onUpdateQuestion(sectionId, question.id, "text", currentDebouncedText)
  }
}, [debouncedLocalQuestionText, question.id, question.text, onUpdateQuestion, sectionId])
```

**Después:**
```typescript
useEffect(() => {
  // Ensure debouncedLocalQuestionText is a string before calling trim()
  const currentDebouncedText = debouncedLocalQuestionText || ""

  // Validate question text
  const isValid = currentDebouncedText.trim().length > 0
  setIsQuestionTextValid(isValid)

  // Only update the parent state if the debounced text is different from the actual question text
  // and not empty (to avoid clearing text while typing)
  if (question.text.replace(/<[^>]*>/g, "") !== currentDebouncedText && currentDebouncedText.trim() !== "") {
    onUpdateQuestion(sectionId, question.id, "text", currentDebouncedText)
  }
}, [debouncedLocalQuestionText, question.id, question.text, onUpdateQuestion, sectionId])
```

**Líneas:** 55-66

### 3. Actualizada Validación en useEffect de Sincronización
**Antes:**
```typescript
useEffect(() => {
  setLocalQuestionText(question.text.replace(/<[^>]*>/g, ""))
}, [question.text])
```

**Después:**
```typescript
useEffect(() => {
  const cleanText = question.text.replace(/<[^>]*>/g, "")
  setLocalQuestionText(cleanText)
  setIsQuestionTextValid(cleanText.trim().length > 0)
}, [question.text])
```

**Líneas:** 68-72

### 4. Aplicados Estilos Condicionales al Campo de Texto
**Antes:**
```typescript
<Input
  value={localQuestionText}
  onChange={(e) => setLocalQuestionText(e.target.value)}
  placeholder="Escribe tu pregunta aquí..."
  className="text-lg"
/>
```

**Después:**
```typescript
<div className="space-y-2">
  <Input
    value={localQuestionText}
    onChange={(e) => setLocalQuestionText(e.target.value)}
    placeholder="Escribe tu pregunta aquí..."
    className={`text-lg ${!isQuestionTextValid ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
  />
  {!isQuestionTextValid && (
    <p className="text-sm text-red-500">La pregunta no puede estar vacía</p>
  )}
</div>
```

**Líneas:** 197-205

## CORRECCIÓN DE ERROR CRÍTICO: crypto.randomUUID()

### Problema Identificado
Se detectó un error crítico: `Error: crypto.randomUUID is not a function` que impedía la funcionalidad de agregar preguntas y secciones.

### Solución Implementada
**Archivo modificado:** `lib/utils.ts`

**Función agregada:**
```typescript
export function generateUUID(): string {
  // Intentar usar crypto.randomUUID() si está disponible (navegadores modernos)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID()
    } catch (error) {
      console.warn('crypto.randomUUID() falló, usando implementación alternativa:', error)
    }
  }
  
  // Implementación alternativa para entornos que no soportan crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
```

### Archivos Corregidos
**Archivo:** `app/projects/[id]/create-survey/page.tsx`

**Instancias reemplazadas:**
- Línea 282: `id: crypto.randomUUID()` → `id: generateUUID()`
- Línea 286: `id: crypto.randomUUID()` → `id: generateUUID()`
- Línea 915: `id: crypto.randomUUID()` → `id: generateUUID()`
- Línea 2060: `id: crypto.randomUUID()` → `id: generateUUID()`
- Línea 2260: `id: crypto.randomUUID()` → `id: generateUUID()`
- Línea 2772: `crypto.randomUUID()` → `generateUUID()`

**Import agregado:**
```typescript
import { generateUUID } from "@/lib/utils"
```

### Características de la Solución
- **Compatibilidad universal:** Funciona en todos los entornos de JavaScript
- **Fallback automático:** Usa implementación alternativa si crypto.randomUUID() no está disponible
- **Mantenimiento de funcionalidad:** Preserva la generación de UUIDs únicos
- **Logging de errores:** Registra advertencias si falla el método nativo

## Funcionalidad Implementada

### Validación en Tiempo Real
- El campo de texto se valida cada vez que cambia el contenido
- Se usa debounce de 300ms para evitar validaciones excesivas
- La validación considera texto vacío o solo espacios en blanco

### Estilos Visuales de Error
- **Borde rojo:** `border-red-500` cuando el campo no es válido
- **Focus rojo:** `focus:border-red-500 focus:ring-red-500` para mantener consistencia
- **Mensaje de error:** Texto rojo debajo del campo cuando hay error

### Estados de Validación
- **Válido:** Campo con borde normal, sin mensaje de error
- **Inválido:** Campo con borde rojo, mensaje de error visible

## Archivos Afectados
- `components/question-editor.tsx` - Modificado para incluir validación
- `lib/utils.ts` - Agregada función generateUUID()
- `app/projects/[id]/create-survey/page.tsx` - Corregidas instancias de crypto.randomUUID()

## Dependencias
- Tailwind CSS para estilos (`border-red-500`, `text-red-500`, etc.)
- Estado local de React para manejo de validación
- Hook `useDebounce` para optimización de rendimiento
- Función `generateUUID()` para generación de IDs únicos

## Pruebas Realizadas
- [ ] Campo se pone rojo cuando está vacío
- [ ] Campo vuelve al estado normal cuando se escribe texto
- [ ] Mensaje de error aparece/desaparece correctamente
- [ ] Validación funciona con debounce
- [ ] Estado se sincroniza correctamente con el componente padre
- [x] Error de crypto.randomUUID() corregido
- [x] Funcionalidad de agregar preguntas/secciones restaurada

## Notas de Implementación
- La validación se ejecuta en tiempo real sin bloquear la escritura
- Se mantiene la funcionalidad existente de debounce para actualización del estado padre
- Los estilos de error son consistentes con el diseño del sistema
- El mensaje de error es claro y específico para el usuario
- **CRÍTICO:** Se corrigió el error que impedía la funcionalidad básica de la aplicación

## Próximos Pasos Sugeridos
1. Probar la funcionalidad en diferentes escenarios
2. Considerar agregar validación similar para otros campos críticos
3. Evaluar si se necesita validación en el formato avanzado (editor rico)
4. Considerar agregar indicadores visuales adicionales (iconos de error/success)
5. **PRIORITARIO:** Resolver errores de tipos TypeScript restantes

### CORRECCIONES ADICIONALES IMPLEMENTADAS

#### Archivo: `components/ui/use-toast.ts`
**Problema:** Error en función `genId()` al generar IDs para notificaciones toast
**Solución:** Reemplazado `crypto.randomUUID()` con `generateUUID()`
**Líneas:** 31
**Import agregado:** `import { generateUUID } from "@/lib/utils"`

#### Archivo: `components/section-organizer.tsx`
**Problema:** Error en funciones de duplicación y creación de secciones
**Solución:** Reemplazado `crypto.randomUUID()` con `generateUUID()`
**Líneas:** 300, 306, 320
**Import agregado:** `import { generateUUID } from "@/lib/utils"`

#### Archivo: `app/create-survey/page.tsx`
**Problema:** Error en función `addQuestion()`
**Solución:** Reemplazado `crypto.randomUUID()` con `generateUUID()`
**Línea:** 95
**Import agregado:** `import { generateUUID } from "@/lib/utils"`

#### Archivo: `app/surveys/[id]/edit/page.tsx`
**Problema:** Error en función `addQuestion()`
**Solución:** Reemplazado `crypto.randomUUID()` con `generateUUID()`
**Línea:** 110
**Import agregado:** `import { generateUUID } from "@/lib/utils"`

### CORRECCIÓN CRÍTICA: PROBLEMA DE MODALES COMPARTIDOS

#### Archivo: `app/surveys/[id]/edit/page.tsx`
**Problema:** Las configuraciones de visualización solo se podían aplicar a una pregunta a la vez porque los modales estaban compartiendo estado incorrectamente.

**Síntomas:**
- Al abrir el editor de formato de una pregunta, se cerraba el de otra
- Los modales de configuración se interferían entre sí
- Imposible editar múltiples preguntas simultáneamente

**Causa Raíz:**
El estado `showQuill` y `showConfig` se manejaban de manera insegura, causando conflictos entre las preguntas.

**Solución Implementada:**
1. **Funciones de manejo seguras:**
   ```typescript
   const openQuillEditor = (questionId: string) => {
     setShowQuill(prev => ({ ...prev, [questionId]: true }))
   }
   
   const closeQuillEditor = (questionId: string) => {
     setShowQuill(prev => ({ ...prev, [questionId]: false }))
   }
   
   const openConfigEditor = (questionId: string) => {
     setShowConfig(prev => ({ ...prev, [questionId]: true }))
   }
   
   const closeConfigEditor = (questionId: string) => {
     setShowConfig(prev => ({ ...prev, [questionId]: false }))
   }
   ```

2. **Modales independientes por pregunta:**
   - Cada pregunta ahora tiene su propio estado de modal
   - Los modales no interfieren entre sí
   - Se pueden abrir múltiples editores simultáneamente

3. **Manejo seguro del estado:**
   - Uso de spread operator para preservar estado de otras preguntas
   - Funciones dedicadas para abrir/cerrar modales
   - Prevención de conflictos de estado

**Resultado:**
✅ **Múltiples preguntas pueden ser editadas simultáneamente**
✅ **Los modales funcionan de manera independiente**
✅ **No hay interferencia entre preguntas**
✅ **Mejor experiencia de usuario al editar encuestas**

**Líneas modificadas:** 70-85, 250-255, 270-275, 290-295, 310-315
