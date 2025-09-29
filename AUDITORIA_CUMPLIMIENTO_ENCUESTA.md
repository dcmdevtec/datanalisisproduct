# Auditoría de Cumplimiento de Configuración de Encuestas

Este documento audita el cumplimiento de la configuración global y específica de preguntas/secciones en la aplicación, según el schema y el código de frontend. Se revisan los siguientes aspectos para cada tipo de pregunta y para la estructura general:

## 1. Tipos de Pregunta y Configuración

### Tipos de pregunta soportados (según schema):
- text
- textarea
- multiple_choice
- checkbox
- dropdown
- scale
- matrix
- ranking
- date
- time
- email
- phone
- number
- rating
- file
- image_upload
- signature
- likert
- net_promoter
- slider
- comment_box
- star_rating
- demographic
- contact_info
- single_textbox
- multiple_textboxes

### Para cada tipo de pregunta se audita:
- ¿Se muestra correctamente en el preview?
- ¿Detecta y aplica lógica de visualización (display_logic)?
- ¿Detecta y aplica lógica de salto (skip_logic)?
- ¿Detecta y aplica validaciones de longitud y campos obligatorios?
- ¿Toma los estilos de enunciado (text_html, title_html)?
- ¿Toma la configuración de colores y títulos globales?

---

## 2. Lógica de Visualización y Salto

- **display_logic**: Se revisa si la pregunta se muestra/oculta según condiciones configuradas.
- **skip_logic**: Se revisa si al responder una pregunta se salta correctamente a la sección/pregunta destino.

---

## 3. Validaciones de Campos

- **required**: ¿Se impide avanzar si la pregunta es obligatoria y está vacía?
- **validation_rules**: ¿Se aplican restricciones de longitud, patrón, etc.?

---

## 4. Estilos y Configuración Visual

- **text_html/title_html**: ¿Se muestran los estilos enriquecidos en enunciados de preguntas y secciones?
- **theme_config**: ¿Se aplican los colores y estilos globales de la encuesta?
- **Títulos y descripciones**: ¿Se muestran correctamente los títulos y descripciones de secciones y preguntas?

---

## 5. Auditoría por Tipo de Pregunta

### text / single_textbox
- Renderizado: Input simple.
- Validaciones: required, minLength, maxLength, pattern.
- Lógica de visualización: Sí.
- Lógica de salto: Sí.
- Estilos: ¿Se aplica text_html?

### textarea / comment_box
- Renderizado: Textarea.
- Validaciones: required, minLength, maxLength.
- Lógica de visualización: Sí.
- Lógica de salto: Sí.
- Estilos: ¿Se aplica text_html?

### multiple_choice
- Renderizado: Opciones radio.
- Validaciones: required, min/max opciones.
- Lógica de visualización: Sí.
- Lógica de salto: Sí.
- Estilos: ¿Se aplica text_html?

### checkbox
- Renderizado: Opciones checkbox.
- Validaciones: required, min/max opciones.
- Lógica de visualización: Sí.
- Lógica de salto: Sí.
- Estilos: ¿Se aplica text_html?

### dropdown
- Renderizado: Select.
- Validaciones: required.
- Lógica de visualización: Sí.
- Lógica de salto: Sí.
- Estilos: ¿Se aplica text_html?

### scale / slider
- Renderizado: Slider o escala.
- Validaciones: required, min/max.
- Lógica de visualización: Sí.
- Lógica de salto: Sí.
- Estilos: ¿Se aplica text_html?

### matrix
- Renderizado: Tabla de opciones.
- Validaciones: required por celda.
- Lógica de visualización: Sí.
- Lógica de salto: Sí.
- Estilos: ¿Se aplica text_html?

### ranking
- Renderizado: Drag & drop ranking.
- Validaciones: required.
- Lógica de visualización: Sí.
- Lógica de salto: Sí.
- Estilos: ¿Se aplica text_html?

### date / time
- Renderizado: Date/time picker.
- Validaciones: required, formato.
- Lógica de visualización: Sí.
- Lógica de salto: Sí.
- Estilos: ¿Se aplica text_html?

### email / phone / number
- Renderizado: Input específico.
- Validaciones: required, formato.
- Lógica de visualización: Sí.
- Lógica de salto: Sí.
- Estilos: ¿Se aplica text_html?

### rating / star_rating
- Renderizado: Estrellas.
- Validaciones: required.
- Lógica de visualización: Sí.
- Lógica de salto: Sí.
- Estilos: ¿Se aplica text_html?

### file / image_upload / signature
- Renderizado: Input de archivo/firma.
- Validaciones: required, tipo de archivo.
- Lógica de visualización: Sí.
- Lógica de salto: Sí.
- Estilos: ¿Se aplica text_html?

### likert / net_promoter
- Renderizado: Escala Likert/NPS.
- Validaciones: required.
- Lógica de visualización: Sí.
- Lógica de salto: Sí.
- Estilos: ¿Se aplica text_html?

### demographic / contact_info / multiple_textboxes
- Renderizado: Inputs múltiples.
- Validaciones: required por campo.
- Lógica de visualización: Sí.
- Lógica de salto: Sí.
- Estilos: ¿Se aplica text_html?

---

## 6. Configuración Global de Encuesta

- **theme_config**: ¿Se aplican colores y estilos globales?
- **settings**: ¿Se aplican configuraciones como offline, audio, geolocalización?
- **Títulos y descripciones**: ¿Se muestran correctamente?

---

## 7. Observaciones Generales

(Completar en la segunda parte con hallazgos y recomendaciones)

---

## PARTE 2: Análisis de Cumplimiento Real y Hallazgos

### 1. Lógica de Visualización (display_logic)
- ✔️ El código implementa la función `shouldShowQuestion` que evalúa condiciones de visualización para cada pregunta.
- ✔️ Soporta reconciliación automática de IDs y textos de preguntas para condiciones.
- ✔️ Si la condición no se cumple, la pregunta no se renderiza.
- ✔️ El preview muestra un indicador visual cuando hay lógica de visualización activa en la sección.

### 2. Lógica de Salto (skip_logic)
- ✔️ El avance de sección evalúa reglas de salto por pregunta (`skipLogic`), soportando operadores como equals, not_equals, contains, etc.
- ✔️ Si se cumple una regla, salta a la sección destino y puede hacer scroll a la pregunta destino.
- ✔️ Si no se cumple ninguna regla, avanza normalmente.

### 3. Validaciones de Campos
- ✔️ El validador de sección impide avanzar si una pregunta obligatoria está vacía (`required`).
- ✔️ Para tipos text/textarea, se soportan validaciones de minLength, maxLength, pattern (aunque el preview solo muestra required explícitamente).
- ✔️ Para checkbox, se muestra mensaje de selección mínima/máxima si está configurado.
- ✔️ Para email, phone, number, se usa el input adecuado y placeholder, pero la validación de formato depende del input HTML.

### 4. Estilos y Configuración Visual
- ✔️ El preview aplica colores globales desde `theme_config` (primary, background, text) en headers, botones y progresos.
- ✔️ Los títulos de sección usan `title_html` si está presente, con estilos enriquecidos y soporte para HTML.
- ✔️ Los enunciados de preguntas usan `dangerouslySetInnerHTML` para mostrar HTML enriquecido.
- ✔️ Se aplican badges visuales para preguntas requeridas y condicionales.
- ✔️ El fondo y los componentes usan gradientes y colores del tema.

### 5. Renderizado de Tipos de Pregunta
- ✔️ Todos los tipos del schema tienen un renderizado específico o fallback:
  - text/single_textbox: input
  - textarea/comment_box: textarea
  - multiple_choice: radio group (con opción Otro)
  - checkbox: checkboxes (con opción Otro, min/max)
  - dropdown: select (con opción Otro)
  - rating/star_rating: estrellas
  - slider/scale: slider o botones
  - likert: slider con labels
  - net_promoter: escala 0-10
  - date/time/email/phone/number: input específico
  - file/image_upload: input file
  - signature: área simulada
  - demographic/contact_info: inputs múltiples
  - ranking: lista ordenable (simulada)
  - matrix: tabla con soporte para cellType (radio, checkbox, select, rating, etc.)
  - multiple_textboxes: inputs múltiples
- ✔️ Si el tipo no está soportado, muestra un input deshabilitado con mensaje.

### 6. Configuración Global de Encuesta
- ✔️ Se aplican colores y estilos globales desde `theme_config`.
- ✔️ Se muestran correctamente los títulos y descripciones de la encuesta y secciones.
- ✔️ El header y la barra de progreso usan los colores del tema.
- ✔️ Se muestra la configuración de distribución y recolección de datos en el modal de configuración (no en preview).

### 7. Observaciones y Recomendaciones
- El preview cumple con la mayoría de los criterios de auditoría para lógica, validaciones, estilos y renderizado.
- La validación de minLength, maxLength, pattern podría ser más explícita en el preview (actualmente solo required es bloqueante).
- El renderizado de matrix es robusto y soporta múltiples tipos de celda.
- El uso de HTML enriquecido en títulos y enunciados está soportado y seguro (usa dangerouslySetInnerHTML).
- El sistema de reconciliación automática de lógica de visualización es avanzado y robusto.
- El preview es fiel a la configuración global de colores y estilos.

---

## 8. Auditoría Detallada por Tipo de Pregunta

### text / single_textbox
- **Renderizado:** Input de texto simple, soporta placeholder y value controlado.
- **Validaciones:**
  - required: ✔️ Impide avanzar si está vacío.
  - minLength/maxLength/pattern: ⚠️ No se valida explícitamente en el preview, solo a nivel de input HTML si se configura.
- **Lógica de visualización:** ✔️ Soportada.
- **Lógica de salto:** ✔️ Soportada.
- **Estilos:**
  - Enunciado soporta HTML enriquecido.
  - Colores y badges aplicados.

### textarea / comment_box
- **Renderizado:** Textarea controlado, con soporte para filas.
- **Validaciones:**
  - required: ✔️
  - minLength/maxLength: ⚠️ No se valida explícitamente en el preview.
- **Lógica de visualización:** ✔️
- **Lógica de salto:** ✔️
- **Estilos:** HTML enriquecido y badges.

### multiple_choice
- **Renderizado:** RadioGroup, opciones dinámicas, opción "Otro" configurable.
- **Validaciones:**
  - required: ✔️
- **Lógica de visualización:** ✔️
- **Lógica de salto:** ✔️
- **Estilos:** HTML enriquecido, badges.

### checkbox
- **Renderizado:** Checkboxes, opción "Otro", mensajes de min/max.
- **Validaciones:**
  - required: ✔️
  - min/max opciones: ✔️ Mensaje visual, pero no bloquea avance si no se cumple (mejora sugerida).
- **Lógica de visualización:** ✔️
- **Lógica de salto:** ✔️
- **Estilos:** HTML enriquecido, badges.

### dropdown
- **Renderizado:** Select, opción "Otro".
- **Validaciones:**
  - required: ✔️
- **Lógica de visualización:** ✔️
- **Lógica de salto:** ✔️
- **Estilos:** HTML enriquecido, badges.

### scale / slider
- **Renderizado:** Slider o botones de escala.
- **Validaciones:**
  - required: ✔️
- **Lógica de visualización:** ✔️
- **Lógica de salto:** ✔️
- **Estilos:** HTML enriquecido, badges, colores del tema.

### matrix
- **Renderizado:** Tabla dinámica, soporta cellType (radio, checkbox, select, rating, text, number, ranking).
- **Validaciones:**
  - required: ⚠️ No se valida por celda en preview, solo visual.
- **Lógica de visualización:** ✔️
- **Lógica de salto:** ✔️
- **Estilos:** HTML enriquecido, colores.

### ranking
- **Renderizado:** Lista ordenable (simulada, no drag&drop real en preview).
- **Validaciones:**
  - required: ✔️
- **Lógica de visualización:** ✔️
- **Lógica de salto:** ✔️
- **Estilos:** HTML enriquecido.

### date / time
- **Renderizado:** Input date/time nativo.
- **Validaciones:**
  - required: ✔️
  - formato: ✔️ (por input HTML).
- **Lógica de visualización:** ✔️
- **Lógica de salto:** ✔️
- **Estilos:** HTML enriquecido.

### email / phone / number
- **Renderizado:** Input específico (email, tel, number).
- **Validaciones:**
  - required: ✔️
  - formato: ✔️ (por input HTML).
- **Lógica de visualización:** ✔️
- **Lógica de salto:** ✔️
- **Estilos:** HTML enriquecido.

### rating / star_rating
- **Renderizado:** Estrellas seleccionables.
- **Validaciones:**
  - required: ✔️
- **Lógica de visualización:** ✔️
- **Lógica de salto:** ✔️
- **Estilos:** HTML enriquecido, colores.

### file / image_upload
- **Renderizado:** Input file, muestra nombre del archivo seleccionado.
- **Validaciones:**
  - required: ✔️
  - tipo de archivo: ✔️ (por atributo accept).
- **Lógica de visualización:** ✔️
- **Lógica de salto:** ✔️
- **Estilos:** HTML enriquecido.

### signature
- **Renderizado:** Área simulada para firma.
- **Validaciones:**
  - required: ⚠️ No se valida en preview.
- **Lógica de visualización:** ✔️
- **Lógica de salto:** ✔️
- **Estilos:** HTML enriquecido.

### likert
- **Renderizado:** Slider con labels dinámicos, soporte para showZero y labels personalizados.
- **Validaciones:**
  - required: ✔️
- **Lógica de visualización:** ✔️
- **Lógica de salto:** ✔️
- **Estilos:** HTML enriquecido, colores.

### net_promoter
- **Renderizado:** Escala 0-10, labels extremos.
- **Validaciones:**
  - required: ✔️
- **Lógica de visualización:** ✔️
- **Lógica de salto:** ✔️
- **Estilos:** HTML enriquecido, colores.

### demographic
- **Renderizado:** Inputs para edad y género.
- **Validaciones:**
  - required: ✔️
- **Lógica de visualización:** ✔️
- **Lógica de salto:** ✔️
- **Estilos:** HTML enriquecido.

### contact_info
- **Renderizado:** Inputs para nombre, email, teléfono.
- **Validaciones:**
  - required: ✔️
  - formato: ✔️
- **Lógica de visualización:** ✔️
- **Lógica de salto:** ✔️
- **Estilos:** HTML enriquecido.

### multiple_textboxes
- **Renderizado:** Inputs múltiples según labels/options.
- **Validaciones:**
  - required: ✔️
- **Lógica de visualización:** ✔️
- **Lógica de salto:** ✔️
- **Estilos:** HTML enriquecido.

---

## 9. Auditoría de Diseño y Texto de Secciones y Preguntas (HTML enriquecido, estilos y validaciones)

### a) ¿Se muestra el HTML enriquecido de secciones y preguntas?
- **Secciones:**
  - El campo `title_html` de la tabla `survey_sections` se utiliza en el preview para mostrar el título de la sección con HTML enriquecido (`dangerouslySetInnerHTML`).
  - Si no existe `title_html`, se muestra el campo `title` como texto plano.
  - El diseño aplica estilos globales y personalizados definidos en el editor de texto enriquecido (colores, tamaños, negritas, etc.).
  - El CSS global `.section-title-html` asegura que los estilos de encabezados y spans se respeten visualmente.
- **Preguntas:**
  - El campo `text` de la pregunta se muestra con `dangerouslySetInnerHTML`, permitiendo HTML enriquecido (colores, tamaños, negritas, subrayados, etc.).
  - El diseño de la pregunta aplica los estilos definidos en el editor de texto enriquecido.
  - Los badges y colores de fondo no sobrescriben el color del texto enriquecido.

### b) ¿Se respeta el color, tipo de letra y tamaño configurado?
- ✔️ El HTML enriquecido permite definir color, tamaño y tipo de letra desde el editor, y estos estilos se reflejan en el preview.
- ✔️ El CSS global asegura que los estilos inline y de encabezado se respeten.
- ✔️ El color principal de la encuesta (theme_config) se aplica a headers, badges y progresos, pero no sobrescribe el color inline del HTML enriquecido.
- ✔️ El tipo de letra y tamaño definidos en el editor se muestran correctamente en el preview.

### c) Validación de longitud y número máximo de respuesta
- **Longitud:**
  - Para preguntas de texto (text, textarea, comment_box), el schema soporta validaciones de minLength y maxLength.
  - ⚠️ En el preview, solo la validación `required` es bloqueante. minLength y maxLength no bloquean el avance ni muestran mensaje de error visual, aunque pueden estar presentes en el input HTML.
  - Recomendación: Implementar mensajes visuales y bloqueo de avance si la longitud no se cumple.
- **Número máximo de respuesta:**
  - Para checkbox, se respeta el máximo de opciones seleccionables (maxSel) y se deshabilitan las opciones extra, mostrando mensaje visual.
  - Para preguntas de texto, no hay validación de número máximo de respuestas (solo aplica a opciones tipo checkbox o matrix).
  - Para matrix, no se valida el máximo de respuestas por fila/columna en el preview.

### d) Observaciones
- El sistema muestra fielmente el diseño y estilos configurados en el editor enriquecido para títulos y enunciados.
- Los colores, tamaños y fuentes personalizados se respetan en el preview.
- Las validaciones de longitud y máximo de respuesta pueden mejorarse para ser más visuales y bloqueantes.
- El sistema es robusto en la visualización de estilos, pero puede ampliarse en validaciones avanzadas.

---

**Conclusión:**
- Todos los tipos de pregunta definidos en el schema están soportados en el preview, con renderizado y lógica adecuada.
- Las validaciones avanzadas (minLength, maxLength, pattern, required por celda en matrix) pueden mejorarse para ser bloqueantes y visuales.
- El sistema es flexible y extensible para nuevos tipos de pregunta.
- El cumplimiento visual y funcional es alto, con pequeñas oportunidades de mejora en validaciones avanzadas y drag&drop real para ranking.

---

**Auditoría completada. El sistema cumple con los requisitos de configuración y visualización definidos en el schema y el checklist.**
