# Estrategia de Guardado Automático para Preguntas y Secciones

## Contexto
- El guardado actual de preguntas depende del handler de guardado de secciones.
- El schema de la tabla `questions` requiere que cada pregunta tenga:
  - `id` (uuid)
  - `survey_id` (uuid)
  - `section_id` (uuid)
  - `type`, `text`, `options`, `required`, `order_num`, `settings`, etc.
  - `style` (jsonb) para el HTML enriquecido

## Problemas Detectados
- El guardado de preguntas solo ocurre al guardar la sección manualmente.
- No hay guardado automático al editar preguntas (texto, opciones, etc.).
- El campo `style` no se actualiza si el usuario edita el formato enriquecido.
- El usuario puede perder cambios si no guarda la sección.

## Propuesta de Solución

### 1. Guardado Automático de Preguntas
- Implementar un autosave para preguntas que se active al editar:
  - Texto de la pregunta
  - Opciones
  - Configuración avanzada
- El autosave debe:
  - Validar que la sección y encuesta tengan IDs reales
  - Guardar la pregunta en la tabla `questions` usando upsert
  - Actualizar el campo `text` (solo texto plano) y `style` (HTML enriquecido)
  - Actualizar el estado local para reflejar el guardado

### 2. Integración con Guardado de Sección
- El autosave de preguntas no debe interferir con el guardado manual de la sección.
- Al guardar la sección, se debe hacer upsert de todas las preguntas para asegurar consistencia.
- Si el usuario edita una pregunta y luego guarda la sección, se debe sobrescribir el registro en la BD.

### 3. Componentes que Requieren Autosave
- Pregunta (texto, opciones, configuración avanzada)
- Opciones de respuesta
- Matriz (filas/columnas)
- Configuración de escala, likert, rating, etc.

### 4. Consideraciones Técnicas
- Usar debounce para evitar múltiples llamadas al backend.
- Validar IDs antes de guardar.
- Manejar errores y mostrar feedback al usuario.
- Permitir desactivar el autosave en modo edición masiva o importación.

## Ejemplo de Hook Autosave
```ts
function useAutoSaveQuestion({ question, sectionId, surveyId }) {
  const [debouncedQuestion] = useDebounce(question, 1000);
  useEffect(() => {
    if (
      debouncedQuestion &&
      sectionId &&
      surveyId &&
      sectionId !== "temp-id" &&
      sectionId.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)
    ) {
      // Separar texto plano y HTML
      let htmlRegex = /<[^>]+>/;
      let hasHtml = htmlRegex.test(debouncedQuestion.text);
      let plainText = debouncedQuestion.text.replace(/<[^>]*>/g, "").trim();
      let questionToSave = {
        ...debouncedQuestion,
        text: plainText,
        style: hasHtml ? { html: debouncedQuestion.text } : {},
      };
      supabase.from('questions').upsert([questionToSave], { onConflict: 'id' });
    }
  }, [debouncedQuestion, sectionId, surveyId]);
}
```

## Recomendaciones
- Mantener el autosave solo para preguntas, no para secciones completas.
- El guardado manual de la sección debe ser el "commit" final.
- Documentar los triggers y validaciones en el backend.
- Probar el flujo con cambios rápidos y simultáneos.

---

**Siguiente paso:**
- Implementar el autosave en los componentes de pregunta y probar la integración con el guardado manual de secciones.
- Validar que el campo `style` se actualice correctamente en la BD.
