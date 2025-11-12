# Resumen del Esquema de la Base de Datos

Este documento resume la estructura de la base de datos, enfocándose en las tablas principales y sus relaciones. El objetivo es facilitar el entendimiento del modelo de datos para futuros desarrollos.

## Tablas Principales

El núcleo de la aplicación gira en torno a las siguientes tablas:

-   `surveys`: Almacena la información general de cada encuesta, como título, descripción, estado (`draft`, `active`, etc.) y configuración. Se vincula con el usuario que la creó a través de `created_by`.

-   `survey_sections`: Permite dividir una encuesta en múltiples secciones o páginas. Cada sección pertenece a una `survey`.

-   `questions`: Contiene todas las preguntas de las encuestas. Cada pregunta está asociada a una `survey` y opcionalmente a una `survey_section`. Esta tabla es fundamental, ya que define el tipo de pregunta (texto, opción múltiple, escala Likert, etc.) y su configuración (lógica de salto, validaciones, etc.).

-   `responses`: Guarda cada intento de respuesta a una encuesta. Contiene el `survey_id` para identificar la encuesta y el `respondent_id` para identificar al usuario que respondió.

-   `answers`: Almacena las respuestas específicas para cada pregunta dentro de un `response`. Se relaciona con `responses` y `questions`.

-   `users`: Gestiona los usuarios del sistema y sus roles (`admin`, `supervisor`, `surveyor`). El `id` de esta tabla se utiliza como `created_by` en `surveys` y como `respondent_id` en `responses`.

-   `surveyors`: Define a los encuestadores. Parece haber una relación con la tabla `users` que tienen el rol `surveyor`.

## Lógica para el Seguimiento de Encuestados

Para evitar que un encuestado responda la misma encuesta más de una vez, se puede implementar una verificación antes de mostrarle la encuesta.

### Enfoque Actual (usando la tabla `responses`)

El esquema actual ya permite este control. La tabla `responses` tiene una columna `survey_id` y `respondent_id`. Para saber si un usuario ya completó una encuesta, se puede realizar la siguiente consulta:

```sql
SELECT 1
FROM public.responses
WHERE survey_id = 'ID_DE_LA_ENCUESTA_A_VERIFICAR'
  AND respondent_id = 'ID_DEL_USUARIO_ACTUAL';
```

Si esta consulta devuelve algún resultado, significa que el usuario ya ha enviado una respuesta para esa encuesta.

### Propuesta: Nueva Tabla de Seguimiento (si se requiere mayor detalle)

Si se necesita un control más explícito o registrar intentos que no necesariamente fueron completados, se podría crear una tabla dedicada para el seguimiento, como sugeriste. Esto puede optimizar las consultas si la tabla `responses` crece mucho.

**Tabla sugerida: `survey_respondent_tracking`**

Esta tabla registraría cada interacción de un encuestado con una encuesta.

```sql
CREATE TABLE public.survey_respondent_tracking (
    survey_id uuid NOT NULL,
    respondent_id uuid NOT NULL,
    response_id uuid, -- Opcional, para vincular a la respuesta final
    status TEXT NOT NULL DEFAULT 'started', -- Ej: 'started', 'completed', 'abandoned'
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    PRIMARY KEY (survey_id, respondent_id),
    FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE,
    FOREIGN KEY (respondent_id) REFERENCES public.users(id) ON DELETE CASCADE,
    FOREIGN KEY (response_id) REFERENCES public.responses(id) ON DELETE SET NULL
);

COMMENT ON COLUMN public.survey_respondent_tracking.status IS 'Registra el estado de la encuesta para un encuestado: iniciada, completada, etc.';
```

**Ventajas de esta tabla:**

1.  **Claridad:** Centraliza la lógica de seguimiento en un solo lugar.
2.  **Rendimiento:** Las verificaciones son más rápidas, ya que la tabla es específica para este propósito.
3.  **Flexibilidad:** Permite registrar no solo las encuestas completadas, sino también los intentos iniciados o abandonados.

Con esta tabla, antes de que un usuario inicie una encuesta, solo necesitarías comprobar si ya existe un registro para `(survey_id, respondent_id)`.
