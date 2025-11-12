# Verificación de Encuestas Respondidas para Encuestados Públicos

Este documento detalla el proceso para verificar si un encuestado público ya ha respondido una encuesta antes de permitirle iniciarla, utilizando las tablas `public_respondents` y `survey_respondent_tracking`.

## 1. Contexto

Cuando un usuario accede a una encuesta a través de un enlace público (ej. `/preview/survey/[surveyId]`), es necesario verificar si ya ha respondido a esa encuesta. La identificación se realizará mediante el tipo y número de documento, y opcionalmente el nombre completo.

## 2. Tablas Relevantes

*   **`public_respondents`**: Almacena la información de los encuestados públicos (no autenticados).
    *   `survey_id`: ID de la encuesta.
    *   `document_type`: Tipo de documento del encuestado.
    *   `document_number`: Número de documento del encuestado.
    *   `full_name`: Nombre completo del encuestado.
    *   `id`: ID único del encuestado público.
*   **`survey_respondent_tracking`**: Registra el estado de la participación de un encuestado en una encuesta.
    *   `survey_id`: ID de la encuesta.
    *   `respondent_id`: ID del encuestado (puede ser de `public_respondents.id` o `users.id`).
    *   `status`: Estado de la encuesta ('started', 'completed', 'abandoned').

## 3. Paso a Paso de la Implementación

### 3.1. Interceptación en la Página de Vista Previa (`/preview/survey/[surveyId]`)

1.  **Identificar el `surveyId`**: Al cargar la página de vista previa de la encuesta, se debe extraer el `surveyId` de la URL.
2.  **Mostrar Modal de Verificación**: Antes de renderizar el contenido de la encuesta, se mostrará un modal al usuario solicitando:
    *   Tipo de Documento (ej. Cédula, Pasaporte, etc.)
    *   Número de Documento
    *   Nombre Completo (opcional, para validación adicional o registro)
3.  **Manejo del Estado del Modal**: El modal debe tener un estado que controle su visibilidad y los datos ingresados por el usuario.

### 3.2. Lógica de Verificación (API Endpoint)

1.  **Crear un nuevo API Endpoint**: Se necesitará un nuevo endpoint (ej. `/api/surveys/[surveyId]/verify-respondent`) que reciba el `surveyId`, `document_type` y `document_number`.
2.  **Consulta a la Base de Datos**:
    *   El endpoint consultará la tabla `public_respondents` usando `survey_id`, `document_type` y `document_number`.
    *   Si se encuentra un registro en `public_respondents`, se obtendrá el `id` de ese encuestado público.
    *   Luego, se consultará la tabla `survey_respondent_tracking` usando el `survey_id` y el `respondent_id` obtenido de `public_respondents`.
3.  **Determinación del Estado de la Encuesta**:
    *   **No encontrado en `public_respondents`**: El usuario no ha iniciado la encuesta. Se creará un nuevo registro en `public_respondents` y `survey_respondent_tracking` con `status = 'started'`. Se permitirá al usuario iniciar la encuesta.
    *   **Encontrado en `public_respondents` y `survey_respondent_tracking`**:
        *   Si `status = 'completed'`: El usuario ya completó la encuesta. Se le informará y se le impedirá iniciarla nuevamente.
        *   Si `status = 'started'` o `status = 'abandoned'`: El usuario ya inició la encuesta pero no la completó. Se le preguntará si desea continuarla o iniciar una nueva (esto puede requerir lógica adicional para recuperar respuestas parciales). Por ahora, se le permitirá continuar.
4.  **Respuesta del API Endpoint**: El endpoint devolverá un objeto JSON indicando el estado (`allowed_to_proceed: boolean`, `status: 'started' | 'completed' | 'new'`, `respondent_public_id: uuid`).

### Ejemplo de implementación (actual)

Se agregó el endpoint Next.js en `app/api/surveys/[id]/verify-respondent/route.ts`.

Request (POST) JSON body:
- document_type: string
- document_number: string
- full_name: string (opcional)
- survey_id: string (opcional si ya está en la URL)

Response (200):
{
    "allowed_to_proceed": true | false,
    "status": "new" | "started" | "completed",
    "respondent_public_id": "uuid-string"
}

Si el endpoint se invoca sin `surveyId` (por ejemplo, en la vista previa local), la UI puede optar por continuar en modo preview local y almacenar un identificador local `respondent_public_id: 'preview'`.

### 3.3. Integración en el Frontend (Página de Vista Previa)

1.  **Envío de Datos del Modal**: Cuando el usuario envíe los datos en el modal, se realizará una llamada al nuevo API endpoint.
2.  **Manejo de la Respuesta del API**:
    *   Si `allowed_to_proceed` es `true`: Se cerrará el modal y se cargará la encuesta. Se deberá pasar el `respondent_public_id` a la encuesta para que las respuestas se asocien correctamente.
    *   Si `allowed_to_proceed` es `false` (y `status = 'completed'`): Se mostrará un mensaje al usuario indicando que ya completó la encuesta.
3.  **Manejo de Errores**: Implementar manejo de errores para problemas de red o del servidor.

### 3.4. Actualización del Estado de la Encuesta

1.  **Al iniciar la encuesta**: Si es un nuevo encuestado, se crea el registro en `public_respondents` y `survey_respondent_tracking` con `status = 'started'`.
2.  **Al completar la encuesta**: Cuando el usuario finalice y envíe la encuesta, se actualizará el `status` a `'completed'` y `completed_at` en `survey_respondent_tracking`. También se vinculará el `response_id` si aplica.
3.  **Guardado de progreso (opcional)**: Para encuestas largas, se podría implementar un guardado automático que actualice el `status` a `'started'` o `'abandoned'` y guarde las respuestas parciales.

## 4. Consideraciones Adicionales

*   **Seguridad**: Asegurar que el API endpoint esté protegido contra inyecciones SQL y otros ataques.
*   **Experiencia de Usuario**: El modal debe ser claro y fácil de usar. Los mensajes de error o de estado deben ser informativos.
*   **Recuperación de Encuestas Incompletas**: Si se permite continuar una encuesta iniciada, se necesitará lógica para cargar las respuestas parciales existentes.
*   **Validación de Entrada**: Validar el formato del tipo y número de documento en el frontend y backend.
