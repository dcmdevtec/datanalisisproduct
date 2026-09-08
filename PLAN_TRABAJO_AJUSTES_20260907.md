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
| 5 | **Lógica**: no realiza el salto de secciones configurado (skip logic a nivel de sección). | `app/projects/[id]/create-survey/page.tsx`. **Causa raíz encontrada (08/09/2026), confirmada por el cliente: "funciona perfecto en el preview pero donde el encuestador resuelve la encuesta no".** Los handlers de guardar/quitar la lógica de salto DE SECCIÓN llamaban a `setSections` directo, sin pasar por `onUpdateSection` (=`updateSection`) — que es el ÚNICO camino que además marca esa sección como "no guardada" para que el autoguardado la detecte. Sin esa marca, el cambio de lógica de salto nunca llegaba a guardarse en la base de datos (salvo que la sección tuviera además otro cambio que sí la marcara pendiente) — el "Preview" lo mostraba bien porque lee el estado en memoria del builder, no la base de datos; el encuestador sí carga desde la base de datos, así que nunca recibía el salto. Corregido para que use el mismo camino que ya usaba correctamente la lógica de salto POR PREGUNTA. | **Alta** (afecta flujo de recolección) | M/L | ✅ Corregido — pendiente que el cliente confirme guardando un salto de sección y probándolo con un encuestador real |
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
| 10 | Los enunciados aparecen en negrilla; deben salir con el **mismo formato con el que se creó** (rich text). | **Encontrado:** `app/print/survey/[id]/page.tsx` (Puppeteer renderiza esta página y la imprime a PDF — ver `app/api/surveys/[id]/pdf/route.ts`). **Causa raíz confirmada:** el contenedor del enunciado forzaba `font-semibold` (negrilla) vía clase CSS sin importar el HTML enriquecido real (`text_html`) — todo salía en negrilla completa aunque el usuario no lo hubiera puesto así. Corregido: se quita el peso forzado y se agrega la clase `rich-html-content` (ya usada en otras partes de la app) para que el propio HTML decida su formato. | **Alta** | M | ✅ Corregido |
| 11 | El PDF debe reflejar **todas** las configuraciones creadas (salto de secciones, visualizaciones, máximo de respuestas, salto de preguntas). | `app/print/survey/[id]/page.tsx`. **Confirmado:** no mostraba nada de esto. Se agregan: nota de salto de sección (cuando no es "continuar a la siguiente"), nota de salto condicional por pregunta (con la regla y el destino), nota de lógica de visualización condicional, y mínimo/máximo de opciones a seleccionar. De paso se corrigió que el componente leía un campo `question_config` que no existe en la tabla `questions` (la columna real es `settings`) — afectaba también la nota de "Escala de X a Y" para preguntas tipo `scale`. | Alta | M/L | ✅ Corregido |
| 12 | Los títulos de sección quedan con demasiado espacio en el PDF. | `app/print/survey/[id]/page.tsx`. Revisado el markup del encabezado de sección — no encontré un valor de espaciado obviamente excesivo (`mb-4`/`py-2`, valores normales). No se pudo confirmar el problema por lectura de código sin ver el PDF real. | Baja | S | ⏳ Sin cambios — necesita el PDF real (o una captura) para comparar el espaciado |

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
| 34 | Solo existe la opción de descargar **todos** los audios juntos; en estudios de +1000 audios esto es inviable (tiempo de descarga). | `components/reports/audios-tab.tsx` + `app/api/surveys/[id]/audios/zip/route.ts`. **Confirmado:** solo había un botón "descargar todo (ZIP)" y un conteo — pero el endpoint de detalle (`/api/surveys/[id]/recordings`) YA traía cada grabación con URL firmada individual, solo no se usaba. Se agregó: lista de grabaciones agrupadas por encuestador con reproducción/descarga individual, y filtros de fecha/encuestador que ahora sí acotan el ZIP (antes siempre bajaba todo, sin parámetros). | **Alta** | L | ✅ Corregido |
| 35 | Se propone estructura de carpetas: `Encuesta > Día > Encuestador > Audio`. | `app/api/surveys/[id]/audios/zip/route.ts`. **Ya estaba implementado** (construido en la reunión 27/08): organiza en `Proyecto/Encuesta/Fecha/Encuestador/archivo` — mismo concepto pedido, con una carpeta extra de Proyecto. | Media | L | ✅ Ya estaba implementado |
| 36 | Evaluar exportar en otro formato distinto a **webm** (p. ej. mp3/wav). | `lib/audio-merge.ts` + `app/api/surveys/[id]/audios/zip/route.ts`. ffmpeg ya está disponible en el servidor (se usa para fusionar segmentos de audio). Se agrega conversión opcional a MP3 (`?format=mp3` en el ZIP, selector "WebM/MP3" en la pestaña Audios) — si la conversión de un archivo puntual falla, ese archivo queda en su formato original en vez de perderse, el resto de la descarga no se ve afectada. | Media | L | ✅ Corregido |

### 1.11 Base de Datos

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 37 | Definir cómo se descarga la "base de datos definitiva" (export completo de respuestas). | **Ya estaba implementado por completo:** `app/api/projects/[id]/export-database/route.ts` (CSV pivotado, una fila por respuesta, una columna por pregunta de todo el proyecto, con nombre de encuestador/encuestado/fecha/duración) + botón "Descargar base de datos" en `app/projects/[id]/page.tsx` (construido en la reunión 27/08). No se tocó nada. | **Alta** | M | ✅ Ya estaba implementado |

### 1.12 Asignación

| # | Ajuste | Módulo/Componente probable | Prioridad | Complejidad | Estado |
|---|---|---|---|---|---|
| 38 | El cliente debe poder **crear y configurar grupos** por proyecto. | `components/survey-hierarchy-assignment.tsx` (usado en `app/projects/[id]/create-survey/page.tsx`, pestaña Asignación). La base ya estaba construida (reunión 27/08): asignación en cascada Coordinador→Supervisor→Encuestadores, guardada **por encuesta** (`survey_surveyor_zones.coordinator_id/supervisor_id`), no global. **Pedido explícito de ajuste (08/09/2026), ya corregido:** la cascada FILTRABA los supervisores/encuestadores mostrados usando el organigrama global fijado al crear/editar cada usuario — si alguien no se había asociado a otro al crearse, o se quería una combinación distinta para esta encuesta, nunca aparecía como opción. Ahora Coordinador y Supervisor son selects independientes con TODAS las opciones siempre (solo quedan como etiqueta de referencia), y la lista de encuestadores ya no depende de elegir supervisor primero — se ve completa siempre. Sigue sin existir un concepto de "grupo" reutilizable/con nombre (ej. guardar "Equipo Barranquilla Norte" para otro proyecto) — si eso es lo que además se quiere, es una funcionalidad nueva, no construida. | **Alta** | M/L | ✅ Corregido — pendiente que el cliente lo pruebe; confirmar si además quiere grupos con nombre reutilizables |
| 39 | Un mismo supervisor (ej. "Pepe") debe poder tener **conjuntos distintos de encuestadores por proyecto** (3 en Proyecto ABC, 4 diferentes en Proyecto DEF). | `components/survey-hierarchy-assignment.tsx`. Mismo fix que #38: la asignación ya era por encuesta (no global), pero el filtro por jerarquía impedía en la práctica asignar un encuestador a un supervisor distinto del que tenía "de fábrica". Con el filtro quitado, cualquier encuestador se puede asignar bajo cualquier supervisor para cada encuesta/proyecto en particular. | **Alta** (posible cambio de modelo de datos) | L | ✅ Corregido — pendiente que el cliente lo confirme probándolo |

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
✅ Ejecutada. #38/#39 ya estaban resueltos (asignación en cascada por encuesta). #40 corregido (mismo bug de id que #14). #42 corregido (selector de fecha para el recorrido). #41 posiblemente ligado a #40. #43/#44 sin cambios (necesitan captura / son feature nueva).

### Fase 4 — Exportables: PDF, Audios y Base de Datos
✅ Ejecutada. #10/#11 corregidos (formato real + todas las configuraciones en el PDF de encuesta). #16, #20, #33 corregidos (Reportes, Fase 1). #34/#36 corregidos (descarga individual/filtrada + MP3 opcional). #35/#37 ya estaban implementados. #12/#32 sin cambios (necesitan ver el PDF/mapa real).

### Fase 5 — Pulido de UI / detalles menores
Pendiente — la mayoría de estos ítems ya se resolvieron de paso en las fases anteriores (#18, #23, #24, #25-27 quedaron ✅ en la sección 1, ver detalle ahí). Lo que queda genuinamente pendiente:
- #7 Visibilidad de encuestas en borrador en la web (es una decisión de producto, no un bug — confirmar qué comportamiento se espera)
- #8-9 Íconos de fecha y botón de actualizar (necesita captura — no se identificó con certeza la pantalla)
- #30-31 (#31 ya corregido; #30 revisado, parece ya resuelto en el código actual)
- #38 "grupos" reutilizables con nombre, si eso es lo que realmente se pide más allá de la cascada por encuesta (que ya funciona)
- #45 Alineación del link de la encuesta (no se pudo confirmar en qué pantalla exacta ocurre — hay 2 lugares candidatos: el modal "Compartir Encuesta" y el código QR, ninguno muestra el nombre/código de la encuesta junto al link hoy)

---

## 4. Estado al 08/09/2026 (tras la primera ronda completa de trabajo)

De los 45 ítems del acta:

- **✅ Corregidos o construidos en esta ronda (código nuevo, sin probar en navegador):** #1, #2, #3, #4, #6, #10, #11, #14, #15, #16, #18, #19, #20, #22, #23, #24 (parcial), #27, #28, #29 (aclarado), #31, #33, #34, #36, #40, #42.
- **✅ Ya estaban implementados** (de rondas anteriores, 27/08 y 31/08 — solo se confirmó que cubren el pedido): #13, #17, #35, #37, #38, #39, #41 (a confirmar tras el fix de #40).
- **🟡 Diagnosticado con causa raíz clara, pero es una decisión de producto o feature nueva, no un bug puntual:** #7 (visibilidad de borradores — decisión), #38 (si además quieren "grupos" con nombre reutilizables), #44 (no existe exportar a PDF en esa pantalla todavía).
- **⏳ Sin cambios — necesita una captura/video puntual para reproducir el síntoma exacto:** #5, #8, #9, #12, #25 (matriz: hecho para radio/checkbox, no para number/text/dropdown/rating), #26 (hecho para multiple_choice/dropdown/checkbox), #30, #32, #43, #45.

**Cómo seguir desde acá:**
1. Actualiza tu ambiente (`git pull origin dev-testing-main`) y prueba todo lo marcado ✅ — es la prioridad, porque son cambios reales de código que nadie ha visto correr todavía (este entorno no tiene navegador ni Supabase real para probar).
2. Para los ítems `⏳`, una captura/video del síntoma exacto (o del PDF/mapa real) es lo que hace falta para poder actuar — no se pudieron diagnosticar más a fondo por lectura de código sola.
3. Para #7 y #38 (grupos con nombre), son preguntas de qué comportamiento esperas, no bugs — dime y lo ajustamos.
