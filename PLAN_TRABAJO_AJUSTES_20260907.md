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
| 1 | La **descripción de la sección** aparece debajo del nombre de la encuesta y no debajo del nombre de la sección. | `app/preview/survey/page.tsx` (reutilizado también por `/encuesta/[id]`, el link público). **Causa raíz confirmada:** la descripción de la sección se renderizaba en el header superior, justo después de `surveyData.title` (nombre de la ENCUESTA), mientras el título real de la sección aparecía más abajo, en una tarjeta separada — visualmente parecía pertenecer a la encuesta. Se movió el bloque de descripción a justo debajo del título de la sección, donde corresponde. | Media | S | ✅ Corregido |
| 2 | Al abandonar la encuesta (en edición), las preguntas quedan grabadas y aparecen en la siguiente encuesta que se crea/edita (contaminación de estado entre encuestas). | `app/projects/[id]/create-survey/page.tsx`. **Causa raíz confirmada — bug de arquitectura de Next.js App Router:** el componente con todo el estado del builder (`CreateSurveyForProjectPageContent`) se renderizaba sin `key`. Al navegar con `router.push()` entre "editar encuesta A" (`?surveyId=A`) y "crear encuesta nueva" (sin `surveyId`) —o entre dos encuestas distintas del mismo proyecto—, React **reutiliza la misma instancia** del componente en vez de desmontarla, así que `sections`/`surveyTitle`/`currentSurveyId` (todo `useState`) seguían con los datos de la encuesta anterior. Corregido forzando el remount con `key={surveyId ?? "new"}`. | **Alta** (riesgo de corromper encuestas) | M | ✅ Corregido |
| 3 | Falta forma **masiva** de cargar las opciones de la lista desplegable en pregunta tipo **Matriz – lista desplegable**. | `components/question-editor.tsx`. **Causa raíz confirmada:** filas y columnas de la matriz YA tenían botón "Múltiples" (pegar una por línea), pero las **opciones de cada columna** en matriz tipo "lista desplegable" (`matrixColOptions`, una lista independiente por columna) solo se podían agregar de a una con "Agregar opción" — exactamente lo que reporta el acta. Se agrega el mismo bulk-add ("Múltiples") para estas opciones por columna. | Media | S/M | ✅ Corregido |
| 4 | En preguntas Matriz muy extensas, al hacer scroll el enunciado (encabezado) se pierde arriba. Pedido: encabezado fijo (*sticky*). | `app/preview/survey/page.tsx` (render de matriz en la vista de toma de encuesta, desktop). A partir de 8 filas, la tabla ahora tiene alto acotado (`max-h-[65vh]`) con scroll interno propio y el encabezado de columnas queda fijo (`sticky`) — matrices cortas se ven igual que antes. No confirmé si también aplica a la vista móvil (usa tarjetas apiladas, no tabla) ni al portal-encuestador (`collect/page.tsx`, que no reutiliza este mismo renderer). | Media | S | ✅ Corregido (vista de escritorio) |
| 5 | **Lógica**: no realiza el salto de secciones configurado (skip logic a nivel de sección). | `components/survey/SectionSkipLogicConfig.tsx` (UI) → `app/api/surveys/[id]/sections/route.ts` (guardado) → `app/preview/survey/page.tsx` (`handleNextSection`). **Revisado a fondo:** tracé el flujo completo (UI → guardado en `survey_sections.skip_logic` → lectura en preview) para salto a nivel de sección y también para salto por pregunta (`question.config.skipLogic.rules`) — ambos están correctamente conectados y ya tienen varias correcciones de rondas anteriores (2026-08-12, 2026-08-16) documentadas en el propio código. No encontré un bug nuevo por lectura de código. | **Alta** (afecta flujo de recolección) | M/L | 🟡 Sin cambios — necesita reproducir el caso puntual (foto/video de la configuración exacta que no salta) para localizarlo, no se pudo confirmar ni corregir a ciegas |
| 6 | **Pregunta de calificación**: falta definir/mostrar las etiquetas de la escala. | `components/question-editor.tsx` (builder) + `app/preview/survey/page.tsx` (render). **Confirmado en código:** la configuración de "Valoración" solo permitía Min/Max y un emoji por valor — no existía ningún campo de texto (ej. "Muy insatisfecho"/"Excelente"). Se agrega `ratingLabels` (input de texto junto a cada emoji en el builder) y se muestra esa etiqueta debajo del emoji al tomar la encuesta, cuando está configurada (opcional, no rompe encuestas existentes sin etiquetas). No confirmé si el portal-encuestador (`collect/page.tsx`) reutiliza este mismo renderer — no encontré un case "rating" ahí. | Media | S | ✅ Corregido (preview/encuesta pública) |

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
| 13 | Todas las gráficas de reportes deben mostrar **número absoluto y porcentaje** (no solo uno). | `components/reports/question-chart.tsx` | **Alta** | M | ✅ Ya estaba implementado (tooltips y leyendas ya muestran count + %) |
| 14 | El **indicador de encuestador** no aparece; probado con 3 usuarios distintos y siempre da cero. | `app/api/reports/route.ts` + `components/reports/summary-content.tsx`. El "siempre en cero" del acta ya no ocurre (rehecho tras reunión 27/08). Bug real encontrado y corregido: un encuestador con respuestas por asignación Y por web autenticada directa se agrupaba con 2 ids distintos (`surveyors.id` vs `surveyors.user_id`) → aparecía **duplicado**, inflando el conteo y repartiendo mal sus indicadores (afecta #21/#28/#31). | **Alta** (bug de datos) | M/L | ✅ Corregido — pendiente validar en ambiente real |
| 15 | "Actividad por hora del día" no coincide con la hora real (3pm aparece como 8pm) → bug de **zona horaria**. | `app/api/reports/route.ts`. **Causa raíz confirmada:** `new Date(created_at).getHours()`/`.getDay()`/`.toISOString().slice(0,10)` usan la hora/día **del servidor** (UTC), no Bogotá (UTC-5) — 3pm Bogotá = 8pm UTC, calza exacto con el síntoma reportado. Corregido con helpers `bogotaHour`/`bogotaDayKey`/`bogotaDayOfWeekEs` (Intl con `timeZone: "America/Bogota"`), aplicados en: actividad por hora, evolución de respuestas por día, tendencia por pregunta, y distribución por día de semana (Rendimiento). | **Alta** (bug de datos) | S/M | ✅ Corregido |
| 16 | Al descargar el PDF de reportes, no aparece el título de la encuesta y debería estar más centrado. | `app/lib/export-report.ts` (`addHeader`) + `app/reports/page.tsx`. El encabezado del PDF nunca incluía qué encuesta estaba filtrada (solo "Resumen General"/etc. genérico) y el texto salía alineado a la izquierda. Corregido: título y encabezado centrados; se agrega el nombre de la encuesta filtrada (o "Todas las encuestas") como subtítulo, para las 4 exportaciones (Resumen/Análisis/Rendimiento/Geográfico). | Media | S | ✅ Corregido |

### 1.6 Reportes — Análisis de Resultados

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 17 | Gráficas y tablas: los porcentajes deben ir con **un decimal**. | `lib/format.ts` (`formatPercent`) | Media | S | ✅ Ya estaba implementado (con comentario explícito de por qué, de un ajuste anterior) |
| 18 | Solo permite personalizar (cambiar color) **parte** de la gráfica. | `components/reports/question-chart.tsx` (`buildPalette`). **Causa raíz confirmada:** al elegir un color solo se recoloreaba la primera barra/porción; el resto seguía con la paleta por defecto (azul, ámbar, rojo...) sin relación con lo elegido. Corregido: ahora se genera una escala de tonos del color elegido para **toda** la gráfica (la primera barra/porción sale exactamente en el color elegido, el resto en tonos relacionados más claros/oscuros). | Baja | S/M | ✅ Corregido |
| 19 | En barras horizontales/verticales deben aparecer números **y** porcentajes. | `components/reports/question-chart.tsx`. El porcentaje ya estaba, pero solo en el tooltip al pasar el mouse — la etiqueta fija sobre la barra solo mostraba el número. Corregido: la etiqueta sobre cada barra ahora muestra "N (P%)". | Media | S | ✅ Corregido |
| 20 | Al descargar el PDF en Análisis de Resultados, **no descarga las gráficas**. | `components/reports/question-card.tsx` + `app/lib/export-report.ts`. **Causa raíz confirmada:** las tarjetas de gráfica por pregunta nunca tenían el atributo `data-export-chart` que `captureCharts()` busca dentro de `#export-responses` — el PDF salía solo con la tabla, sin ninguna imagen. Corregido: se agrega `data-export-chart` a la tarjeta de cada pregunta, y se excluye la barra de botones (tipo de gráfico/color/toggles) de la captura con `data-html2canvas-ignore` para que la imagen quede limpia. | **Alta** | M | ✅ Corregido |
| 21 | Al seleccionar "rendimiento por encuestador" no aparece ningún indicador. | `app/api/reports/route.ts` (`surveyorPerformance`) | **Alta** (bug de datos) | M | ✅ Resuelto por el mismo fix de #14 (encuestador duplicado) |

### 1.7 Reportes — Respuestas Individuales

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 22 | No toma el **nombre del encuestado** en la tabla. | `app/api/reports/individual/route.ts` (lista) vs `app/api/reports/individual/[id]/route.ts` (detalle). **Causa raíz confirmada con captura:** el detalle SÍ mostraba el nombre (ej. "Ruben") porque tiene un fallback que busca el nombre en la respuesta a una pregunta tipo `contact_info` cuando `respondent_name` viene vacío (pasa cuando el encuestado da su nombre pero no documento). La LISTA no tenía ese fallback — mostraba "Sin asignar" para esos mismos casos. Se porta el mismo fallback (batched, mismo patrón que ya usa la lista para `location`) al endpoint de lista. | **Alta** | S/M | ✅ Corregido |
| 23 | Cada encuesta realizada y registrada debe tener un **ID** visible. | `components/reports/individual-responses-tab.tsx`. Antes el id de la respuesta solo aparecía como fallback en el modal de detalle cuando NO había nombre de encuestado — nunca en la tabla. Corregido: se agrega columna **ID** (`#xxxxxxxx`) a la tabla, siempre visible. | Media | S | ✅ Corregido |
| 24 | Al ingresar a una encuesta aparecen **varios audios** por respuesta sin explicación de a qué corresponde cada uno / por qué se divide. | `components/reports/individual-responses-tab.tsx`. Investigado: son 3 fuentes distintas y ya diferenciadas visualmente — (1) "Antes de iniciar la encuesta" (fondo del turno/incidencia), (2) grabación de la encuesta misma (antes decía solo "Grabación", ahora "Durante la encuesta" para que se note la diferencia con la de arriba), (3) audio de una pregunta puntual (bajo esa pregunta). | Media | M | 🟡 Mejorado (aclaración de etiqueta) — confirmar con foto si con esto ya se entiende, o si falta más contexto |
| 25 | Las **tablas matriz no se pueden editar** en la respuesta (no aparece la opción). | `components/reports/individual-responses-tab.tsx` + `app/api/reports/individual/[id]/route.ts`. Se agrega editor de matriz (tabla filas×columnas con radio/checkbox según `matrixCellType`) para los tipos de celda `radio` (una opción por fila) y `checkbox` (varias); los tipos `number`/`text`/`dropdown`/`rating` quedan de solo lectura (no tenían editor definido y no es seguro improvisar uno sin más contexto). El PATCH valida server-side que cada celda enviada sea una columna real de la matriz. | Media | M | ✅ Implementado (radio/checkbox) — pendiente probar en navegador; number/text/dropdown/rating quedan sin editor |
| 26 | Al editar una pregunta de respuesta, debería limitarse **solo** a las opciones creadas para esa pregunta (evitar edición libre/inconsistente). | `components/reports/individual-responses-tab.tsx` + `app/api/reports/individual/[id]/route.ts`. El API de detalle ahora manda `options` de cada pregunta; para `multiple_choice`/`dropdown` (una respuesta) y `checkbox` (varias) el editor pasa de `<Textarea>` libre a radio/checklist con esas opciones. El PATCH valida server-side que el valor enviado sea una opción real (protege aunque alguien arme el request a mano). El resto de tipos (texto, número, fecha, etc.) sigue con texto libre, como corresponde. | Media | M | ✅ Corregido — pendiente probar en navegador |
| 27 | La tabla no permite ordenar de forma **ascendente/descendente**. | `components/reports/individual-responses-tab.tsx`. No existía ningún control de orden (headers eran texto plano). Corregido: columnas ID/Encuestador/Encuestado/Fecha/Duración ahora son clicables con flecha de orden (mismo patrón que la tabla de Rendimiento). | Baja | S | ✅ Corregido |

### 1.8 Reportes — Rendimientos

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 28 | No aparecen los indicadores de los encuestadores. | `app/reports/page.tsx` (tarjetas + tabla "Rendimiento por Encuestador"). **Confirmado con captura:** los indicadores sí aparecen, pero la tarjeta "Encuestadores" decía **"con asignaciones"** cuando en realidad ya viene filtrada a encuestadores **con respuestas** — etiqueta engañosa, corregida a "con respuestas". | **Alta** | M | ✅ Corregido (etiqueta) — el conteo en sí ya funciona bien (mismo fix de #14) |
| 29 | "Rendimiento por encuesta" no cuadra: muestra tasa 100% cuando el resumen general da 37,5% → **descuadre de cálculo entre vistas**. | `app/reports/page.tsx` + `app/api/reports/route.ts`. **Causa raíz encontrada — NO es un bug de cálculo:** "Rendimiento por Encuesta" mide % de respuestas que llegaron a `status="completed"` (terminaron el formulario), mientras "Tasa Global"/Resumen mide % clasificado como **efectiva** (excluye incidencia/descalificada). Son métricas distintas, ambas correctas para lo que miden, pero ambas se llamaban genéricamente "Tasa" — de ahí la sensación de que "no cuadran". Corregido: se renombra a "Tasa Finaliz." con tooltip, y se explica la diferencia en la descripción de la tarjeta. | **Alta** (percepción de bug, no bug de datos) | M | ✅ Aclarado con etiqueta/descripción — confirmar con el cliente si esta distinción resuelve la confusión o si además quiere que se unifiquen ambos criterios |

### 1.9 Reportes — Geográfico

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 30 | Solo grafica los estados **Efectiva** y **Descalificada** (faltan los demás estados de gestión). | `components/reports-geo-map.tsx`. Revisado: el componente actual ya soporta los 4 outcomes (efectiva/abandonada/incidencia/descalificada) con color y filtro propios — no se encontró el bug descrito en el código actual. | Media | M | 🟡 Parece ya resuelto en el código — ⏳ confirmar con foto del mapa mostrando el problema (puede ser de una versión anterior ya reemplazada) |
| 31 | No toma la información del encuestador en el mapa. | `app/api/reports/route.ts` (`responsePointsFromResponses`). **Mismo bug de fondo que #14:** los puntos de encuestadores sin `assignment_id` (web autenticada directa) se etiquetaban con `respondent_id` (auth user_id) en vez del `id` real de `surveyors` — no calzaba con el resto del sistema (filtros, ruta GPS). Corregido igual que #14. | Media | M | ✅ Corregido |
| 32 | Al descargar el PDF del mapa, los puntos no coinciden con la ubicación real donde se hizo la encuesta. | `components/reports-geo-map.tsx` + mapa oculto de exportación en `app/reports/page.tsx`. Ya existe un mecanismo dedicado (mapa Leaflet oculto, con tiles `crossOrigin`, construido para esto en la reunión 27/08) — no se pudo verificar visualmente en este entorno (sin navegador) si el desfase de puntos persiste o en qué condición ocurre. | **Alta** (dato geográfico incorrecto) | M | ⏳ Sin cambios — necesita comparar una captura del mapa en pantalla vs. el PDF exportado para localizar el desfase exacto |
| 33 | Mejorar el tamaño de la descarga del PDF del mapa (debe salir más grande). | `app/lib/export-report.ts` (`exportGeographic`). Cambiado de A4 vertical a **horizontal** (el mapa es contenido ancho por naturaleza) — usa todo el ancho de página disponible en vez de quedar angosto en un PDF vertical. | Baja | S | ✅ Corregido |

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
| 38 | El cliente debe poder **crear y configurar grupos** por proyecto. | `components/survey-hierarchy-assignment.tsx` (usado en `app/projects/[id]/create-survey/page.tsx`, pestaña de asignación). **Encontrado ya construido:** el comentario del propio código cita casi textual el pedido de esta acta ("pueden haber coordinadores en otra encuesta con otros supervisores y otros encuestadores") — se implementó tras la reunión 27/08. La asignación va en cascada Coordinador→Supervisor→Encuestadores y se guarda **por encuesta** (`survey_surveyor_zones.coordinator_id/supervisor_id`), no global. Lo que NO existe es un concepto de "grupo" reutilizable/con nombre (ej. guardar "Equipo Barranquilla Norte" para reusarlo en otro proyecto) — cada encuesta arma su cascada de cero. Si el cliente literalmente quiere poder nombrar y reutilizar grupos, es una funcionalidad nueva (tabla de grupos + UI), no construida — no se armó a ciegas sin confirmar qué se entiende por "grupo". | **Alta** | M/L | 🟡 Necesidad base ya resuelta (cascada por encuesta) — confirmar con el cliente si además quiere grupos con nombre reutilizables |
| 39 | Un mismo supervisor (ej. "Pepe") debe poder tener **conjuntos distintos de encuestadores por proyecto** (3 en Proyecto ABC, 4 diferentes en Proyecto DEF). | `components/survey-hierarchy-assignment.tsx`. Mismo hallazgo que #38: esto es EXACTAMENTE lo que la cascada por encuesta ya resuelve (la asignación es por `survey_surveyor_zones`, no global) — la lista de encuestadores de un supervisor se filtra por su `supervisorId` real, pero a qué encuestadores tiene acceso CADA encuesta se decide al armar esa encuesta, así que Proyecto ABC y Proyecto DEF pueden tener selecciones distintas del mismo supervisor sin conflicto. | **Alta** (posible cambio de modelo de datos) | L | ✅ Ya resuelto (construido en ronda anterior, 27/08) — pendiente que el cliente lo confirme probándolo |

### 1.13 Encuestadores — Geolocalización

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 40 | No aparecen los indicadores por encuestador (registros y efectivas). | `app/api/tracking/route.ts` (usado por `app/surveyors/page.tsx`, la pantalla real de Geolocalización). **Causa raíz confirmada — mismo bug de fondo que #14/#31:** para respuestas sin `assignment_id` ni `metadata.surveyor_id`, se validaba `respondent_id` (auth user_id) directamente contra la lista de ids de encuestadores visibles, en vez de resolverlo primero a `surveyors.id` vía `user_id` — solo coincidía por casualidad en cuentas viejas (antes del backfill de esa columna). Corregido con la misma resolución vía `surveyors.user_id` ya usada en `/api/reports`. | **Alta** | M | ✅ Corregido |
| 41 | No aparece el **recorrido** (tracking de ruta) del encuestador. | `components/tracking-map.tsx` + `app/api/tracking/history/route.ts`. Revisado: el recorrido YA estaba implementado (construido en la reunión 27/08, con endpoint dedicado) — no encontré por qué no aparecería salvo que dependa del mismo problema de datos de #40 (si el encuestador nunca queda "seleccionado" con datos por el bug de arriba). Con #40 corregido, revisar si esto también se resuelve; si sigue sin aparecer, necesita una captura puntual (¿aparece el trazo pero vacío? ¿no aparece el botón?). | **Alta** | M/L | 🟡 Posiblemente ligado a #40 — confirmar tras esa corrección |
| 42 | Poder ver el recorrido de un encuestador de un **día anterior** (selector de fecha histórica). | `components/tracking-map.tsx` + `app/api/tracking/history/route.ts`. **Hallazgo:** el backend YA soportaba `?date=YYYY-MM-DD` desde que se construyó (comentario explícito: "se acepta para poder revisar un día anterior... aunque la UI actual solo pide hoy") — solo faltaba el selector en la pantalla. Se agrega un `<input type="date">` (máximo hoy) en la leyenda del mapa, junto al recorrido, que ahora sí se puede cambiar. | Media | M | ✅ Corregido |
| 43 | En pantalla completa del mapa, los filtros quedan superpuestos en la mitad del mapa (bug de layout). | `components/tracking-map.tsx` (`fixed inset-0 z-[2000]` al entrar en pantalla completa) + `app/surveyors/page.tsx`. Revisado el mecanismo de pantalla completa; tengo una hipótesis (un dropdown de filtro abierto justo al activar pantalla completa quedaría con z-index más alto y posición ya obsoleta, "flotando" sobre el mapa) pero no lo pude confirmar sin reproducirlo visualmente — no quise tocar el layout a ciegas por una corazonada. | Baja | S | ⏳ Sin cambios — necesita captura del glitch exacto para confirmar la causa |
| 44 | Mejorar el tamaño de la descarga del PDF (mapa de encuestadores). | No se encontró ninguna funcionalidad de exportar a PDF en esta pantalla (`app/surveyors/page.tsx` / `components/tracking-map.tsx`) — a diferencia del mapa de Reportes → Geográfico, que sí la tiene. Esto no es un ajuste de tamaño: es una funcionalidad que no existe todavía acá. Requiere construirla de cero (mismo patrón que `app/lib/export-report.ts`), fuera de alcance de un ajuste rápido. | Baja | S | ⏳ Diagnosticado — es funcionalidad nueva, no un bug; queda pendiente de decidir si se prioriza como feature |

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
