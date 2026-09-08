# Plan de Trabajo — Ajustes Reunión 07/09/2026

**Origen:** `AJUSTES_REUNION_20260907.docx` (acta de reunión de ajustes del producto).
**Fecha de elaboración del plan:** 08/09/2026.
**Estado del documento:** 🟡 Borrador vivo — se irá completando la columna *Módulo/Componente* a medida que se reciban capturas de pantalla que confirmen en qué pantalla ocurre cada punto.

## 0. Cómo se va a trabajar este plan

1. Este documento agrupa **todos** los puntos del acta por módulo funcional (no por orden cronológico del acta), para poder priorizar y ejecutar por bloques.
2. Para cada punto se registra:
   - **Ajuste**: qué pidió/reportó el cliente (paráfrasis fiel del acta).
   - **Módulo/Componente probable**: archivo(s) del repo donde probablemente vive el ajuste, según una primera exploración del código. Cuando no se pudo ubicar con certeza, queda marcado como `⏳ Por confirmar (foto)`.
   - **Prioridad**: Alta / Media / Baja (impacto en datos/confianza del cliente vs. pulido de UI).
   - **Complejidad estimada**: S (pequeña), M (mediana), L (grande/incierta).
   - **Estado**: `Pendiente` → `En análisis` → `En desarrollo` → `En validación` → `Hecho`.
3. Cuando envíes una foto, dime a qué número de ítem corresponde (o descríbela) y yo:
   - actualizo el **Módulo/Componente** con el archivo real,
   - ajusto prioridad/complejidad si cambia el diagnóstico,
   - y muevo el ítem en el **Plan de Ejecución** (sección 3) a la fase que corresponda.
4. Los archivos citados salen de una exploración inicial del repo (`app/`, `components/`, `lib/`). Algunos módulos del acta (Análisis de Resultados, Audios, Base de Datos, Geolocalización de encuestadores) **no se ubicaron como pantallas propias completamente implementadas** — ver nota en la sección 1.9. Esto hay que confirmarlo contigo/con las fotos antes de estimar esfuerzo real.

---

## 1. Inventario de ajustes por módulo

### 1.1 Constructor de Encuestas — Secciones y Preguntas

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 1 | La **descripción de la sección** aparece debajo del nombre de la encuesta y no debajo del nombre de la sección. | `components/section-organizer.tsx`, `app/create-survey/page.tsx` | Media | S | Pendiente |
| 2 | Al abandonar la encuesta (en edición), las preguntas quedan grabadas y aparecen en la siguiente encuesta que se crea/edita (contaminación de estado entre encuestas). | `components/question-editor.tsx`, `app/create-survey/page.tsx`, `app/surveys/[id]/edit/page.tsx` (posible estado en memoria/localStorage no limpiado al salir) | **Alta** (riesgo de corromper encuestas) | M | Pendiente |
| 3 | Falta forma **masiva** de cargar las opciones de la lista desplegable en pregunta tipo **Matriz – lista desplegable**. | `components/question-editor.tsx`, `components/advanced-question-config.tsx` | Media | S/M | Pendiente |
| 4 | En preguntas Matriz muy extensas, al hacer scroll el enunciado (encabezado) se pierde arriba. Pedido: encabezado fijo (*sticky*). | `components/question-editor.tsx` (render de matriz), `components/survey-preview-modal.tsx` | Media | S | Pendiente |
| 5 | **Lógica**: no realiza el salto de secciones configurado (skip logic a nivel de sección). | `components/section-organizer.tsx`, `components/skip-logic-demo.tsx`, `types/survey.ts` (`skip_logic`) | **Alta** (afecta flujo de recolección) | M/L | Pendiente |
| 6 | **Pregunta de calificación**: falta definir/mostrar las etiquetas de la escala. | `components/question-editor.tsx`, `components/advanced-question-config.tsx` | Media | S | Pendiente |

### 1.2 Visualización de Encuestas en la Web

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 7 | Cuando la encuesta está en **borrador** no se visualiza en la web (solo se ven las activas). Confirmar si es bug o comportamiento esperado. | `app/preview/survey/page.tsx`, `app/surveys/[id]/page.tsx` (filtro por `status`) | Media | S | ⏳ Por confirmar (foto) — aclarar si el cliente espera poder previsualizar borradores |

### 1.3 Filtros de fecha (Desde–Hasta) en la Web

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 8 | Ajustar los íconos de las fechas. | ⏳ Por confirmar (foto) — candidatos: filtros de `app/reports/page.tsx` o `app/surveys/page.tsx` | Baja | S | Pendiente |
| 9 | Ajustar el botón de actualizar. | ⏳ Por confirmar (foto) | Baja | S | Pendiente |

### 1.4 Descarga de Encuesta en PDF

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 10 | Los enunciados aparecen en negrilla; deben salir con el **mismo formato con el que se creó** (rich text). | Módulo de exportación a PDF — ⏳ **no se localizó una librería/endpoint de generación de PDF de encuesta en el repo actual** (solo hay uso de PDF en `components/create-edit-zone-modal.tsx`, que es de zonas). Hay que confirmar dónde vive esta función. | **Alta** | M | ⏳ Por confirmar (foto/flujo) |
| 11 | El PDF debe reflejar **todas** las configuraciones creadas (salto de secciones, visualizaciones, máximo de respuestas, salto de preguntas). | Idem #10 | Alta | M/L | ⏳ Por confirmar |
| 12 | Los títulos de sección quedan con demasiado espacio en el PDF. | Idem #10 | Baja | S | Pendiente |

### 1.5 Reportes — Resumen

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 13 | Todas las gráficas de reportes deben mostrar **número absoluto y porcentaje** (no solo uno). | `app/reports/page.tsx` (tab `summary`) | **Alta** | M | Pendiente |
| 14 | El **indicador de encuestador** no aparece; probado con 3 usuarios distintos y siempre da cero. | `app/reports/page.tsx` (tab `summary`/`performance`) — probablemente el cálculo no está conectado a datos reales; el archivo actual usa datos de ejemplo hardcodeados (`Encuesta de Satisfacción`, etc.) | **Alta** (bug de datos) | M/L | Pendiente |
| 15 | "Actividad por hora del día" no coincide con la hora real (encuestas hechas a las 3pm aparecen a las 8pm) → posible bug de **zona horaria**. | `app/reports/page.tsx` — revisar conversión UTC/local en agregación de timestamps | **Alta** (bug de datos) | S/M | Pendiente |
| 16 | Al descargar el PDF de reportes, no aparece el título de la encuesta y debería estar más centrado. | Exportación PDF de reportes — ⏳ por confirmar dónde se genera | Media | S | Pendiente |

### 1.6 Reportes — Análisis de Resultados

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 17 | Gráficas y tablas: los porcentajes deben ir con **un decimal**. | `app/reports/page.tsx` | Media | S | Pendiente |
| 18 | Solo permite personalizar (cambiar color) **parte** de la gráfica. | `app/reports/page.tsx` — componentes de gráfica | Baja | S/M | Pendiente |
| 19 | En barras horizontales/verticales deben aparecer números **y** porcentajes. | `app/reports/page.tsx` | Media | S | Pendiente |
| 20 | Al descargar el PDF en Análisis de Resultados, **no descarga las gráficas**. | Exportación PDF de reportes — ⏳ por confirmar | **Alta** | M | Pendiente |
| 21 | Al seleccionar "rendimiento por encuestador" no aparece ningún indicador. | `app/reports/page.tsx` (tab `performance`) | **Alta** (bug de datos) | M | Pendiente |

> ⚠️ Nota: en el código actual, `app/reports/page.tsx` solo tiene 4 pestañas (`Resumen`, `Respuestas`, `Rendimiento`, `Geográfico`). El acta menciona secciones adicionales como **Análisis de Resultados** como algo separado de "Resumen". Hay que confirmar con captura si es una pestaña/vista que falta construir o si es la misma pestaña `Resumen`/`Rendimiento` renombrada en la mente del cliente.

### 1.7 Reportes — Respuestas Individuales

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 22 | No toma el **nombre del encuestado** en la tabla. | `app/reports/page.tsx` (tab `responses`) | **Alta** | S/M | Pendiente |
| 23 | Cada encuesta realizada y registrada debe tener un **ID** visible. | `app/reports/page.tsx` (tab `responses`), `app/api/responses/route.ts` | Media | S | Pendiente |
| 24 | Al ingresar a una encuesta aparecen **varios audios** por respuesta sin explicación de a qué corresponde cada uno / por qué se divide. | ⏳ Por confirmar (foto) — relacionado con preguntas de tipo grabación de audio en `app/surveys/[id]/collect/page.tsx` | Media | M | ⏳ Por confirmar |
| 25 | Las **tablas matriz no se pueden editar** en la respuesta (no aparece la opción). | `app/reports/page.tsx` (tab `responses`) | Media | M | Pendiente |
| 26 | Al editar una pregunta de respuesta, debería limitarse **solo** a las opciones creadas para esa pregunta (evitar edición libre/inconsistente). | `app/reports/page.tsx` (tab `responses`) | Media | M | Pendiente |
| 27 | La tabla no permite ordenar de forma **ascendente/descendente**. | `app/reports/page.tsx` (tab `responses`) | Baja | S | Pendiente |

### 1.8 Reportes — Rendimientos

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 28 | No aparecen los indicadores de los encuestadores. | `app/reports/page.tsx` (tab `performance`) | **Alta** | M | Pendiente |
| 29 | "Rendimiento por encuesta" no cuadra: muestra tasa 100% cuando el resumen general da 37,5% → **descuadre de cálculo entre vistas**. | `app/reports/page.tsx` (tab `performance` vs `summary`) — revisar fórmula de tasa de respuesta | **Alta** (bug de datos, credibilidad del reporte) | M | Pendiente |

### 1.9 Reportes — Geográfico

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 30 | Solo grafica los estados **Efectiva** y **Descalificada** (faltan los demás estados de gestión). | `app/reports/page.tsx` (tab `geographic`), `components/map-with-choropleth.tsx` | Media | M | Pendiente |
| 31 | No toma la información del encuestador en el mapa. | Idem | Media | M | Pendiente |
| 32 | Al descargar el PDF del mapa, los puntos no coinciden con la ubicación real donde se hizo la encuesta. | Idem — export PDF ⏳ por confirmar | **Alta** (dato geográfico incorrecto) | M | Pendiente |
| 33 | Mejorar el tamaño de la descarga del PDF del mapa (debe salir más grande). | Idem | Baja | S | Pendiente |

### 1.10 Audios

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 34 | Solo existe la opción de descargar **todos** los audios juntos; en estudios de +1000 audios esto es inviable (tiempo de descarga). | ⏳ **No se ubicó una pantalla/endpoint dedicado de descarga masiva de audios** en el repo actual — probablemente vive dentro de "Respuestas Individuales" o está pendiente de construir. | **Alta** | L | ⏳ Por confirmar (foto) |
| 35 | Se propone estructura de carpetas: `Encuesta > Día > Encuestador > Audio`. | Idem — nueva funcionalidad de empaquetado (zip) por jerarquía | Media | L | Pendiente |
| 36 | Evaluar exportar en otro formato distinto a **webm** (p. ej. mp3/wav). | Idem — requiere transcodificación (backend) | Media | L | Pendiente |

### 1.11 Base de Datos

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 37 | Definir cómo se descarga la "base de datos definitiva" (export completo de respuestas). | ⏳ No se encontró endpoint de exportación en `app/api/*` actual. Candidato natural: nuevo endpoint en `app/api/responses/route.ts` + botón en `app/reports/page.tsx`. | **Alta** | M | ⏳ Por confirmar (foto/expectativa: Excel/CSV/SPSS?) |

### 1.12 Asignación

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 38 | El cliente debe poder **crear y configurar grupos** por proyecto. | `components/assign-surveyors-modal.tsx`, `components/zone-surveyor-assignment.tsx`, `app/surveyors/page.tsx` | **Alta** | M/L | Pendiente |
| 39 | Un mismo supervisor (ej. "Pepe") debe poder tener **conjuntos distintos de encuestadores por proyecto** (3 en Proyecto ABC, 4 diferentes en Proyecto DEF). | Idem — revisar modelo de datos: la asignación supervisor→encuestadores parece estar atada globalmente y no por proyecto | **Alta** (posible cambio de modelo de datos) | L | Pendiente |

### 1.13 Encuestadores — Geolocalización

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 40 | No aparecen los indicadores por encuestador (registros y efectivas). | ⏳ Por confirmar — candidatos: `components/map-with-drawing.tsx`, `app/zones/page.tsx`, `app/surveyors/page.tsx` | **Alta** | M | ⏳ Por confirmar (foto) |
| 41 | No aparece el **recorrido** (tracking de ruta) del encuestador. | `lib/hooks/use-route-optimization.ts`, `components/map-with-drawing.tsx` | **Alta** | M/L | Pendiente |
| 42 | Poder ver el recorrido de un encuestador de un **día anterior** (selector de fecha histórica). | Idem | Media | M | Pendiente |
| 43 | En pantalla completa del mapa, los filtros quedan superpuestos en la mitad del mapa (bug de layout). | `components/map-with-drawing.tsx` / `components/map.tsx` | Baja | S | Pendiente |
| 44 | Mejorar el tamaño de la descarga del PDF (mapa de encuestadores). | Idem — export PDF ⏳ por confirmar | Baja | S | Pendiente |

### 1.14 Link de la Encuesta

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 45 | El link de la encuesta (`https://datanalisis.dcmsystem.co/encuesta/...`) debe ir **alineado** junto al nombre/código de la encuesta, no suelto. | `app/surveys/page.tsx`, `app/surveys/[id]/page.tsx` | Baja | S | Pendiente |

---

## 2. Resumen de hallazgos importantes (antes de ejecutar)

1. **Reportes concentrados en un solo archivo con datos de ejemplo.** `app/reports/page.tsx` actualmente usa listas de encuestas y valores de ejemplo hardcodeados (no conectados 100% a datos reales de Supabase). Varios bugs del acta (indicadores en cero, descuadre de tasas, "actividad por hora") probablemente se deben a que ese cálculo aún no está bien conectado a la data real — esto puede ser una causa raíz común a los puntos #14, #15, #21, #28, #29.
2. **No se encontró generación de PDF para encuesta, reportes ni mapas** en el repo (solo hay uso de una librería de exportación en el modal de zonas). Todo lo relacionado a "descarga de PDF" (#10-12, #16, #20, #32-33, #44) depende de ubicar/crear ese módulo — hay que confirmar si ya existe en otro repo/servicio o si se debe construir.
3. **Descarga masiva de audios y "base de datos definitiva"** (#34-37) no tienen una pantalla o endpoint identificado todavía — son candidatas a ser funcionalidades nuevas, no simples arreglos.
4. **Asignación por proyecto** (#38-39) puede requerir cambio de modelo de datos (relación supervisor-encuestador actualmente parece global, no por proyecto) — conviene validar el esquema (`components/sql/schema.sql`) antes de estimar.

Estos 4 puntos son los que más se benefician de las fotos que vas a enviar: con una captura de cada pantalla puedo confirmar el archivo exacto y bajar el nivel de incertidumbre.

---

## 3. Plan de Ejecución (por fases)

El orden prioriza: (a) bugs que afectan la **confianza en los datos** que el cliente ya está usando, (b) bloqueos operativos del día a día (recolección/asignación), (c) exportables (PDF/audios/BD), (d) pulido de UI.

### Fase 0 — Confirmación de alcance (sin código)
- Recibir capturas de pantalla y mapear cada ítem `⏳ Por confirmar` a su módulo real.
- Confirmar con el cliente expectativas puntuales que el acta deja abiertas: formato de exportación de "base de datos definitiva", formato de audio deseado, si borradores deben o no verse en la web.
- Revisar `components/sql/schema.sql` para el punto de Asignación por proyecto (#38-39).

### Fase 1 — Integridad de datos en Reportes (prioridad más alta)
Corrige lo que hace que el cliente desconfíe de los números:
- #14 Indicador de encuestador en cero (Resumen)
- #15 Actividad por hora — bug de zona horaria
- #21 / #28 Indicadores de rendimiento por encuestador no aparecen
- #29 Descuadre entre tasa de respuesta general (37,5%) y por encuesta (100%)
- #22 Nombre del encuestado no aparece
- #13 / #17 / #19 Formato de gráficas (absoluto + %, un decimal)

### Fase 2 — Constructor de encuestas y lógica de recolección
Bloquean la creación/edición correcta de nuevas encuestas:
- #2 Preguntas que se arrastran entre encuestas (riesgo de corrupción de datos) — **tratar como bug crítico, no como mejora**
- #5 Salto de secciones no funciona
- #1 Descripción de sección mal ubicada
- #3 Carga masiva de opciones en Matriz – lista desplegable
- #4 Encabezado fijo en tablas matriz largas
- #6 Etiquetas de pregunta de calificación

### Fase 3 — Asignación y Geolocalización de encuestadores
Bloquean operación de campo:
- #38 / #39 Grupos y asignación de encuestadores por proyecto
- #40 / #41 Indicadores y recorrido del encuestador
- #42 Ver recorrido de días anteriores
- #43 Filtros superpuestos en pantalla completa

### Fase 4 — Exportables: PDF, Audios y Base de Datos
Requieren primero ubicar/diseñar el módulo (ver hallazgo #2 y #3 arriba):
- #10-12 PDF de encuesta (formato, configuraciones, espaciado)
- #16, #20, #32-33, #44 PDF de reportes/mapas (título, gráficas, precisión de puntos, tamaño)
- #34-36 Descarga de audios por lotes/carpetas/formato
- #37 Descarga de base de datos definitiva

### Fase 5 — Pulido de UI / detalles menores
- #7 Visibilidad de encuestas en borrador en la web (confirmar comportamiento esperado)
- #8-9 Íconos de fecha y botón de actualizar
- #18 Personalización de color completa en gráficas
- #23 ID visible de cada respuesta
- #24 Explicación/orden de audios múltiples por respuesta
- #25-27 Edición y orden de tablas en Respuestas Individuales
- #30-31 Estados adicionales y datos del encuestador en el mapa geográfico
- #45 Alineación del link de la encuesta

---

## 4. Próximos pasos inmediatos

1. Enviar fotos de las pantallas donde ocurre cada punto marcado `⏳ Por confirmar (foto)` (ítems #7, #8, #9, #10-12, #16, #20, #24, #32-33, #34-37, #40, #44) — con eso cierro la columna de módulo/componente.
2. Confirmar si el orden de fases (sección 3) refleja tu prioridad real de negocio, o si algo debe subir/bajar (p. ej. si Asignación por proyecto es más urgente que integridad de Reportes).
3. Una vez confirmado, convierto cada ítem de la Fase 1 en tareas de desarrollo concretas y arrancamos ejecución.
