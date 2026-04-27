# Auditoría técnica · `create-survey/page.tsx`

**Archivo auditado:** `app/projects/[id]/create-survey/page.tsx`
**Tamaño:** 3.134 líneas / 128 KB en un solo archivo
**Fecha:** 2026-04-20
**Alcance:** creación, edición, secciones, preguntas, skip logic, settings, asignación de zonas/encuestadores y preview.
**Objetivo:** diagnóstico accionable previo a la modularización (Frente B).

---

## 1. Resumen ejecutivo

El editor de encuestas es el corazón del producto y hoy vive en un único componente de 3.134 líneas con 39 `useState`, 10 `useEffect`, 26 funciones top-level, 7 tablas Supabase tocadas y dos editores de rich text distintos cargados (Quill + TipTap). Ya existen varios componentes hijos extraídos (`QuestionEditor`, `SectionSkipLogicConfig`, `SectionOrganizer`, `ZoneSurveyorAssignment`, etc.) pero toda la **coordinación de estado y la lógica de negocio permanecen en el monolito**, por lo que cada toque tiene alto riesgo de regresión y explica los "reventones" en producción.

**Riesgos críticos identificados (detalle en §5):**

1. Race entre `fetchSurveyForEdit` y `addSection/handleSaveSection` puede borrar cambios del usuario.
2. `removeQuestionFromSection` no limpia las referencias a la pregunta eliminada en los `skipLogic` de otras preguntas ⇒ datos inconsistentes persistidos.
3. `autoSaveQuestion` no tiene debounce ni coordinación ⇒ tormenta de UPSERTs contra Supabase.
4. `fetchSurveyForEdit` ejecuta tres queries secuenciales (sin `Promise.all`) ⇒ UX lenta.
5. Duplicación de fetchs (surveyors x2, zones x2, project x2) en `useEffect` distintos.
6. Los tipos `Question`, `SurveySection`, `SurveySettings` se redeclaran **inline** en el monolito aunque `types/survey.ts` ya los define. Divergencia latente web↔APK.
7. Función `stripHtml` redefinida con `document.createElement` (no-SSR safe) duplicando `lib/stripHtml.ts`.
8. 7 funciones internas superan las 100 líneas (`fetchSurveyForEdit` 281, `removeSection` 182, `handleSaveSection` 164, `handleSave` 143, `validateAndFixSkipLogicReferences` 123, `handlePreview` 109, `updateSkipLogicReferencesWithQuestionMapping` 86).

**Conclusión:** la base es salvable y ya hay piezas modularizadas. El plan es (a) estabilizar los bugs críticos con parches puntuales que no requieren refactor estructural, y (b) proceder con la modularización del Frente B sobre una base ya saneada.

---

## 2. Mapa estructural del monolito

| Rango | Bloque | Responsabilidad |
|---|---|---|
| L1-115 | Imports + helpers | Imports UI, dnd-kit, auth, editores dinámicos. `stripHtml` redefinida inline L69-76 (ver §5). |
| L117-212 | Tipos inline | `Question`, `SectionSkipLogic`, `SurveySection`, `SurveySettings`, `SortableSectionProps`. **Duplican `types/survey.ts`.** |
| L227-596 | `SortableSection` | Componente interno (370 líneas). Render de una sección con drag-drop, editor de título, menú, skip logic por sección, lista de preguntas. 3 estados locales + 2 useEffect. |
| L597-928 | Utilidades skip-logic | `autoSaveQuestion` (L605), `updateSectionSkipLogic` (L653), `updateSkipLogicReferences` (L671), `updateSkipLogicReferencesWithQuestionMapping` (L715), `validateAndFixSkipLogicReferences` (L804). |
| L931-2241 | `CreateSurveyForProjectPageContent` | Componente principal. Hooks, 36 estados, handlers CRUD, persistencia, preview, save. |
| L1938-2384 | 9 `useEffect` | Lectura inicial + sincronización (con duplicados). |
| L2402-3130 | JSX principal (≈740 líneas) | 4 tabs (Details, Questions, Assignment, Settings) + 2 modales (EditSurveySettingsModal, SectionOrganizer). |

---

## 3. Lógica de secciones y preguntas

### 3.1 Modelo de datos (inline, no importado)

```ts
interface Question { id; type; text; options; required; image?; matrixRows?; matrixCols?; ratingScale?; config? }
interface SurveySection { id; title; title_html?; description?; order_num; questions; skipLogic? }
interface SurveySettings { collectLocation; allowAudio; offlineMode; distributionMethods; theme?; branding?; security?; notifications? }
```

`types/survey.ts` ya expone versiones más completas (`QuestionConfig`, `LikertScaleConfig`, `MatrixConfig`, `DisplayLogic`, `SkipLogic`, `ValidationRules`). El monolito **no las usa**, y cada vez que se edita una pieza hay riesgo de desincronizar.

### 3.2 Creación y edición

- **Sección nueva:** `addSection` (L2002) crea un objeto en memoria con UUID generado, `order_num` calculado y una pregunta mínima; no persiste hasta `handleSaveSection`.
- **Pregunta nueva:** `addQuestionToSection` (L1198) genera UUID, actualiza estado local y hace UPSERT si `sectionId` y `surveyId` son UUID reales. Si el survey aún no existe, crea el survey primero.
- **Edición de campos:** `updateSection` / `updateQuestionInSection` son `useCallback` puros sobre el estado local, marcan la sección como `"not-saved"` vía `setSectionSaveStates`.
- **Persistencia por sección:** `handleSaveSection` (L960, 164 líneas):
  1. Si no hay survey, INSERT en `surveys`.
  2. UPSERT en `survey_sections` con `onConflict: 'id'`.
  3. UPSERT por pregunta en `questions`.
  4. Re-mapea ids antiguos→nuevos y llama a `updateSkipLogicReferencesWithQuestionMapping`.

### 3.3 Reordenamiento y movimiento

- `handleDragEnd` (L1174) reordena secciones con dnd-kit y recalcula `order_num`; no persiste automáticamente.
- `handleMoveQuestion` (L1315) mueve una pregunta entre secciones. **No actualiza** las referencias `targetQuestionId` de otras preguntas cuando cambia de sección (no rompe porque el id no cambia, pero sí deja `targetSectionId` obsoleto si la pregunta destino viajó).

### 3.4 Tipos de pregunta soportados

Inferidos por el `config` y los campos opcionales: `text`, `multiple_choice`, `checkbox`, `dropdown` (con `dropdownMulti`), `matrix` (con `matrixRows`/`matrixCols`/`matrixCellType`), `scale`/`rating` (con `scaleMin`/`scaleMax`/`ratingEmojis`), `likert` (definido en `types/survey.ts`). El render real vive en `QuestionEditor`.

### 3.5 Persistencia (tablas Supabase tocadas)

| Tabla | Operaciones | Mutadores |
|---|---|---|
| `projects` | SELECT | `useEffect` L1938 y L2244 (duplicado) |
| `surveys` | INSERT/UPDATE | `handleSave` (L1562), `handleSaveSection` (L995) |
| `survey_sections` | UPSERT, DELETE | `handleSaveSection` (L1041), `removeSection` |
| `questions` | UPSERT, DELETE | `autoSaveQuestion` (L641), `handleSaveSection` (L1089), `removeQuestionFromSection` (L1284), `addQuestionToSection` (L1255) |
| `survey_surveyor_zones` | DELETE + INSERT | `handleSave` (L1576) |
| `surveyors`, `zones` | SELECT (x2 cada una) | `fetchSurveyorsAndZones` (L1964) + fetchs duplicados L2293 y L2326 |

**Ausencias:** no hay optimistic update, no hay debounce centralizado, no hay retry/backoff, no hay abort on unmount.

---

## 4. Configuraciones y skip logic

### 4.1 Tres modelos de salto coexisten

1. **`Question.config.skipLogic`** — reglas por pregunta: `{ enabled, rules: [{ condition, operator, value, targetSectionId, targetQuestionId, targetQuestionText, enabled }] }`. Se guarda en `questions.skip_logic` (JSONB).
2. **`SurveySection.skipLogic`** — regla única por sección: `{ enabled, action: "next_section" | "specific_section" | "specific_question" | "end_survey", targetSectionId?, targetQuestionId? }`. Se guarda en `survey_sections.skip_logic`.
3. **`Question.config.displayLogic`** — condiciones de visibilidad: `{ enabled, conditions: [{ questionId, operator, value }] }`. Se guarda en `questions.display_logic`.

El motor de evaluación **no vive en este archivo**; lo consumen el preview y el renderer público (`app/preview/...`, `components/survey-public-renderer.tsx`). Esta auditoría no valida que todos evalúen el mismo contrato.

### 4.2 Utilidades existentes (y redundantes)

| Función | L | Cobertura | Redundancia |
|---|---|---|---|
| `updateSectionSkipLogic` / `removeSectionSkipLogic` | 653-668 | skip logic a nivel sección | OK |
| `updateSkipLogicReferences` | 671-712 | mapea old→new `targetSectionId` en secciones y preguntas | Operaría igual unificada con la siguiente |
| `updateSkipLogicReferencesWithQuestionMapping` | 715-801 | mapea old→new `targetQuestionId` | Duplica lógica con la anterior, debería unificarse en un `remapSkipLogicIds` |
| `validateAndFixSkipLogicReferences` | 804-927 | al cargar datos: valida existencia, intenta fuzzy match por texto, deshabilita reglas huérfanas | Útil pero frágil (fuzzy por texto). No detecta ciclos |

### 4.3 Normalización inline en `handlePreview`

`handlePreview` (L1400-1427) normaliza cada `rule` rellenando `questionId`, `operator`, `value`, `targetSectionId`, etc. Esto debería vivir en una utilidad `normalizeSkipRule` compartida con el motor, no inline en el handler.

### 4.4 Gaps

- **Sin detección de ciclos** en skip logic ⇒ posible hang/crash del preview si A→B→A.
- **Sin limpieza al borrar pregunta** ⇒ reglas huérfanas persistidas (§5).
- **Sin validación al guardar** ⇒ puede guardarse data inconsistente y el único saneo es al recargar.

---

## 5. Bugs y anti-patterns priorizados

### 🟥 Críticos

**C1 · Race `fetchSurveyForEdit` ↔ `addSection` / `handleSaveSection`**
`useEffect` L1983 dispara `fetchSurveyForEdit` en función de `currentSurveyId`. Si el usuario crea una sección/pregunta mientras el fetch sigue pendiente, el `setSections(validatedSections)` del fetch pisa los cambios locales al completarse. Sucede especialmente tras la primera creación de survey (cuando `setCurrentSurveyId(newId)` dentro de `handleSaveSection` dispara un re-fetch).
**Fix mínimo:** bandera `userChangedSections` o `ref` que indique "datos locales tocados"; abortar el fetch al unmount; no refetch tras guardado propio (usar la respuesta del INSERT como fuente de verdad).

**C2 · `removeQuestionFromSection` no limpia referencias de `skipLogic`** (L1279-1297)
Se confirmó leyendo el archivo: sólo hace `DELETE` en Supabase y `filter` local. Otras preguntas con `skipLogic.rules[].targetQuestionId = <id borrado>` quedan con referencias huérfanas que se persisten en el siguiente save.
**Fix:** centralizar en un helper `removeQuestionCascade(questionId)` que, antes del DELETE, recorra todas las `rules` y borre/deshabilite las que apunten a `questionId`.

**C3 · Tipos inline divergen de `types/survey.ts`**
`Question`, `SurveySection`, `SurveySettings` definidos en L118-211 sobrescriben lo que ya existe en `types/survey.ts`. Como la APK y el renderer público usan los types globales, cualquier campo nuevo añadido inline acá no se propaga. Es el detonante silencioso de divergencias web↔APK.
**Fix:** eliminar las interfaces inline y `import { Question, SurveySection, SurveySettings } from "@/types/survey"`.

**C4 · `stripHtml` duplicado y SSR-unsafe** (L69-76)
La versión inline usa `document.createElement` y reviente en SSR/tests. Ya existe `lib/stripHtml.ts` con implementación regex-only segura.
**Fix:** borrar L69-76 y `import { stripHtml } from "@/lib/stripHtml"`.

### 🟧 Altos

**A1 · `autoSaveQuestion` sin debounce** (L605-652)
Cada UPSERT se dispara por el flujo de `updateQuestionInSection`. Depende de que `QuestionEditor` (externo) debounce los cambios. Si no lo hace, es un flood de requests.
**Fix:** envolver en un `useDebouncedCallback` de `use-debounce` (ya instalado) con 800-1000 ms, y coalescer por `questionId`.

**A2 · `fetchSurveyForEdit` secuencial** (L1655-1936)
Tres queries en serie contra Supabase. Fácil `Promise.all([surveys, survey_surveyor_zones, survey_sections])`.
**Fix:** `Promise.all` + merge en un solo set de estados con `startTransition` para no bloquear el render.

**A3 · Tres `useEffect` duplicados para surveyors/zones/project** (L1938+L2244; L1964+L2293; L1964+L2326)
Dispara dobles fetch al montar.
**Fix:** consolidar en un único hook `useInitialSurveyData` con cleanup (`AbortController`) y guardar la respuesta en un estado compartido.

**A4 · `fetchSurveyForEdit` en deps del `useEffect` de inicialización** (L1983)
El callback está memoizado, pero si sus deps cambian, el efecto se relanza; hoy no pasa por suerte, pero es frágil.
**Fix:** mover `fetchSurveyForEdit` a un hook dedicado y disparar por evento ("cargar survey X"), no por cambio de referencia de función.

**A5 · Race `handleSaveSection` crea survey y dispara refetch**
Ver C1. El nuevo `surveyId` setea `currentSurveyId` y el `useEffect` vuelve a cargar borrando el resultado del INSERT en curso.
**Fix:** usar la data retornada por el INSERT como fuente de verdad y no refetch hasta que `handleSaveSection` termine.

### 🟨 Medios

**M1 · `sectionSaveStates` acumula basura** — al borrar una sección no se elimina su entrada. Memory leak controlado.
**M2 · Sin detección de ciclos en skip logic** — A→B→A puede crashear el preview.
**M3 · `localStorage.setItem("surveyPreviewData", ...)`** sin control de tamaño. Bajo riesgo, pero dos pestañas se pisan.
**M4 · `fetchSurveyForEdit` sin timeout** — si Supabase se cuelga, el spinner queda infinito.
**M5 · `showDescription` se resetea en `useEffect [section.id]`** de `SortableSection` (L258) — potencial parpadeo si `section.id` cambia por un remap.
**M6 · Sin abort al unmount** en ningún fetch ⇒ warnings de React en console y setState sobre componentes muertos.

### 🟩 Bajos

**B1 · Console logs de debug en producción** (L1728, 1747, 1759, 1777, 1793, 1802, 1847, 1869, 1919 y varios más). Reemplazar por logger condicional.
**B2 · Dos editores de rich text cargados** (Quill + TipTap). Decidir uno y retirar el otro para reducir bundle.
**B3 · Dos librerías de UI base** (Radix-shadcn + Mantine). Mantine aparece marginal; evaluar si se puede eliminar.
**B4 · Funciones > 100 líneas** (ver §1). Todas son candidatas a extracción en el Frente B.
**B5 · Normalización de `skipLogic.rules` inline en `handlePreview`** — mover a utilidad.

---

## 6. Quick wins (aplicables sin refactor estructural)

Estos se pueden ejecutar como un único PR previo al Frente B, sin tocar arquitectura:

1. Reemplazar tipos inline por `import { ... } from "@/types/survey"` (C3).
2. Eliminar `stripHtml` local y usar `@/lib/stripHtml` (C4).
3. Consolidar los tres fetchs duplicados de proyecto/surveyors/zonas en un único `useEffect` con `Promise.all` y cleanup (A2 + A3).
4. Envolver `autoSaveQuestion` en `useDebouncedCallback` (A1).
5. Añadir limpieza de `skipLogic` en `removeQuestionFromSection` reutilizando la lógica ya existente en `removeSection` (C2).
6. Limpiar `sectionSaveStates[sectionId]` al borrar sección (M1).
7. Sustituir los `console.log` por un wrapper `debugLog(flag)` condicional (B1).

Impacto estimado: eliminación de los crashes de pérdida de cambios (C1/C2/A5), reducción del tiempo de carga del editor en ~40% (`Promise.all`), y datos consistentes web↔APK (C3).

---

## 7. Preparación para modularización (entrega al Frente B)

La auditoría identifica los siguientes **puntos de corte naturales** para la extracción:

| Pieza | Origen en monolito | Destino propuesto |
|---|---|---|
| Types | L117-212 | borrar, usar `types/survey.ts` |
| `SortableSection` | L227-596 | `components/survey/SortableSection.tsx` |
| Utilidades skip logic | L597-928 | `lib/survey/skip-logic.ts` (+ tests) |
| Estados de encuesta | 36 useState | `hooks/useSurveyEditor.ts` (reducer) |
| Persistencia Supabase | queries embebidas | `lib/survey/survey-service.ts` |
| Tab Details | L2449-2536 | `components/survey/tabs/DetailsTab.tsx` |
| Tab Questions | L2538-2766 | `components/survey/tabs/QuestionsTab.tsx` |
| Tab Assignment | L2767-2947 | `components/survey/tabs/AssignmentTab.tsx` |
| Tab Settings | L2948-3078 | `components/survey/tabs/SettingsTab.tsx` |
| Preview bootstrap | L1399-1508 | `lib/survey/preview.ts` |
| Auto-save | `autoSaveQuestion` + debouncer | `hooks/useAutoSaveQuestion.ts` |

El detalle de orden, contratos y estrategia para no romper producción ni la APK está en `MODULARIZACION_CREATE_SURVEY.md` (Frente B).

---

## Anexo · Métricas

- Líneas totales: **3.134**
- `useState` en componente principal: **36** (+3 en `SortableSection`)
- `useEffect`: **8 principales** (+2 en `SortableSection`)
- Funciones top-level: **26** (19 dentro del componente + 7 utilidades)
- Sub-componentes internos: **1** (`SortableSection`, 370 líneas)
- Tablas Supabase tocadas: **7**
- Imports dinámicos: **3**
- Funciones > 100 líneas: **7**
- Componentes ya extraídos usados: **10**
