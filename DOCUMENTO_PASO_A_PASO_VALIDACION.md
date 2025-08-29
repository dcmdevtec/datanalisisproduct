# DOCUMENTO PASO A PASO - IMPLEMENTACIÓN DE VALIDACIÓN DE CAMPO DE PREGUNTA

## Objetivo
Implementar validación visual que haga que el campo de texto de la pregunta se ponga en rojo cuando esté vacío.

## Prerrequisitos
- Conocimiento básico de React y TypeScript
- Acceso al archivo `components/question-editor.tsx`
- Entendimiento de hooks de React (useState, useEffect)

## Paso 1: Identificar el Campo de Texto
**Ubicación:** `components/question-editor.tsx` líneas 197-198

**Código actual:**
```typescript
<Input
  value={localQuestionText}
  onChange={(e) => setLocalQuestionText(e.target.value)}
  placeholder="Escribe tu pregunta aquí..."
  className="text-lg"
/>
```

**Explicación:** Este es el campo Input donde el usuario escribe el texto de la pregunta.

## Paso 2: Agregar Estado de Validación
**Ubicación:** Después de la línea 50

**Código a agregar:**
```typescript
const [isQuestionTextValid, setIsQuestionTextValid] = useState<boolean>(true)
```

**Explicación:** Este estado controlará si el campo de texto es válido o no. Se inicializa como `true` por defecto.

## Paso 3: Implementar Lógica de Validación en useEffect
**Ubicación:** Líneas 55-66 (modificar el useEffect existente)

**Código a modificar:**
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

**Explicación:** 
- Se valida el texto cada vez que cambia `debouncedLocalQuestionText`
- Se verifica que el texto no esté vacío después de quitar espacios en blanco
- Se actualiza el estado de validación en tiempo real

## Paso 4: Actualizar Validación en useEffect de Sincronización
**Ubicación:** Líneas 68-72 (modificar el useEffect existente)

**Código a modificar:**
```typescript
useEffect(() => {
  const cleanText = question.text.replace(/<[^>]*>/g, "")
  setLocalQuestionText(cleanText)
  setIsQuestionTextValid(cleanText.trim().length > 0)
}, [question.text])
```

**Explicación:** 
- Se sincroniza el estado de validación cuando cambia el texto de la pregunta desde el componente padre
- Se asegura que la validación esté actualizada al cargar o duplicar preguntas

## Paso 5: Aplicar Estilos Condicionales
**Ubicación:** Líneas 197-205 (modificar el Input existente)

**Código a modificar:**
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

**Explicación:**
- Se envuelve el Input en un div con espaciado
- Se aplican clases CSS condicionales para el estado de error
- Se muestra un mensaje de error cuando el campo no es válido

## Paso 6: Estilos CSS Utilizados
**Clases de Tailwind CSS:**

- **Estado normal:** `text-lg` (tamaño de texto)
- **Estado de error:** 
  - `border-red-500` (borde rojo)
  - `focus:border-red-500` (borde rojo en focus)
  - `focus:ring-red-500` (anillo de focus rojo)
- **Mensaje de error:** `text-sm text-red-500` (texto pequeño y rojo)
- **Contenedor:** `space-y-2` (espaciado vertical entre elementos)

## Paso 7: Lógica de Validación
**Criterios de validación:**
1. El texto no puede estar completamente vacío
2. El texto no puede contener solo espacios en blanco
3. Se usa `trim()` para quitar espacios al inicio y final

**Función de validación:**
```typescript
const isValid = currentDebouncedText.trim().length > 0
```

## Paso 8: Comportamiento del Debounce
**Configuración actual:** 300ms
**Propósito:** Evitar validaciones excesivas mientras el usuario escribe
**Funcionamiento:** La validación se ejecuta solo después de que el usuario deje de escribir por 300ms

## Paso 9: Estados de la Interfaz
**Estado Válido:**
- Campo con borde normal
- Sin mensaje de error
- `isQuestionTextValid = true`

**Estado Inválido:**
- Campo con borde rojo
- Mensaje de error visible
- `isQuestionTextValid = false`

## Paso 10: Pruebas Recomendadas
1. **Campo vacío:** Debe mostrar borde rojo y mensaje de error
2. **Solo espacios:** Debe mostrar borde rojo y mensaje de error
3. **Texto válido:** Debe mostrar borde normal y sin mensaje
4. **Cambio de estado:** Debe cambiar visualmente al escribir/borrar texto
5. **Sincronización:** Debe mantener estado correcto al cargar/duplicar preguntas

## Consideraciones Técnicas
- **Rendimiento:** El debounce evita validaciones excesivas
- **Accesibilidad:** El mensaje de error es visible y claro
- **Consistencia:** Los estilos siguen el sistema de diseño existente
- **Mantenibilidad:** El código es claro y fácil de entender

## Posibles Mejoras Futuras
1. Agregar iconos de error/success
2. Implementar validación para otros campos críticos
3. Agregar animaciones de transición
4. Considerar validación en formato avanzado (editor rico)
5. Implementar validación en tiempo real sin debounce para casos específicos
