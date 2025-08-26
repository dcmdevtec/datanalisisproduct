# Lógica de Salto en Encuestas - Guía de Uso

## Descripción

La lógica de salto permite que las encuestas cambien dinámicamente su flujo basándose en las respuestas del usuario. Cuando se cumple una condición específica, la encuesta puede saltar a una sección o pregunta diferente.

## Estructura de Datos

### Campo `skip_logic` en la tabla `questions`

El campo `skip_logic` es un JSONB que contiene la configuración de la lógica de salto:

```json
{
  "enabled": true,
  "rules": [
    {
      "value": "Opción 1",
      "enabled": true,
      "operator": "equals",
      "condition": "",
      "questionId": "52ae980c-9308-4d60-97d8-943aa601ac01",
      "targetSectionId": "b4905e5a-903d-4904-a0a8-2e49efae14b7",
      "targetQuestionId": "502f320d-a8b6-47b4-8e78-e5fce1a804d1",
      "targetQuestionText": "pregunta 1 s3 aqui"
    }
  ]
}
```

### Campos de la Regla

- **`enabled`**: Si la regla está activa
- **`operator`**: Operador de comparación (`equals`, `not_equals`, `contains`, etc.)
- **`value`**: Valor a comparar con la respuesta
- **`targetSectionId`**: ID de la sección objetivo
- **`targetQuestionId`**: ID de la pregunta específica (opcional)
- **`targetQuestionText`**: Texto descriptivo de la pregunta objetivo

## Operadores Soportados

- **`equals`**: La respuesta es igual al valor
- **`not_equals`**: La respuesta no es igual al valor
- **`contains`**: La respuesta contiene el valor
- **`not_contains`**: La respuesta no contiene el valor
- **`greater_than`**: La respuesta es mayor que el valor
- **`less_than`**: La respuesta es menor que el valor
- **`is_empty`**: La respuesta está vacía
- **`is_not_empty`**: La respuesta no está vacía

## Cómo Funciona

1. **Configuración**: Se configura la lógica de salto en el editor de encuestas
2. **Evaluación**: Al responder una pregunta, se evalúan todas las reglas activas
3. **Aplicación**: Si se cumple una condición, se aplica el salto automáticamente
4. **Navegación**: El usuario es llevado a la sección o pregunta objetivo

## Configuración en el Editor

### 1. Habilitar Lógica de Salto

En el editor de encuestas, ve a la configuración avanzada de una pregunta y activa la pestaña "Lógica de Salto".

### 2. Crear Reglas

1. Haz clic en "Agregar Regla"
2. Selecciona el operador de comparación
3. Define el valor a comparar
4. Selecciona la sección objetivo
5. Opcionalmente, selecciona una pregunta específica

### 3. Configurar Destinos

- **Sección**: La sección a la que saltar
- **Pregunta específica**: Una pregunta particular dentro de esa sección

## Prueba en Preview

### Botón "Probar Lógica"

En el preview de la encuesta, hay un botón "Probar Lógica" que:

1. Verifica todas las preguntas con lógica de salto
2. Muestra las reglas configuradas
3. Indica las respuestas actuales
4. Proporciona información de depuración en la consola

### Historial de Lógica de Salto

El preview mantiene un historial de todos los saltos aplicados:

- Pregunta respondida
- Respuesta dada
- Sección objetivo
- Pregunta específica (si aplica)
- Timestamp del salto

## Ejemplos de Uso

### Ejemplo 1: Salto Simple

**Pregunta**: "¿Te gusta el café?"
**Opciones**: ["Sí", "No"]
**Lógica**: Si respuesta = "No", saltar a sección "Bebidas Alternativas"

### Ejemplo 2: Salto con Pregunta Específica

**Pregunta**: "¿Cuál es tu edad?"
**Tipo**: Número
**Lógica**: Si edad < 18, saltar a sección "Menores de Edad", pregunta "¿Tienes permiso de tus padres?"

### Ejemplo 3: Salto Condicional

**Pregunta**: "¿Qué productos compras?"
**Tipo**: Checkbox múltiple
**Lógica**: Si respuesta contiene "Electrónicos", saltar a sección "Especificaciones Técnicas"

## Solución de Problemas

### La Lógica de Salto No Funciona

1. **Verificar configuración**: Asegúrate de que `enabled: true` en la regla
2. **Revisar operadores**: Confirma que el operador sea correcto para el tipo de pregunta
3. **Validar IDs**: Verifica que los IDs de sección y pregunta sean válidos
4. **Consola del navegador**: Revisa los logs para información de depuración

### Debugging

1. Usa el botón "Probar Lógica" en el preview
2. Revisa la consola del navegador para logs detallados
3. Verifica que los datos se estén cargando correctamente
4. Confirma que las respuestas coincidan con los valores esperados

## Mejoras Implementadas

### Interfaz Visual

- **Badges indicadores**: Muestran qué preguntas tienen lógica de salto
- **Alertas informativas**: Explican el comportamiento de la lógica
- **Visualizador de flujo**: Muestra las reglas de manera clara
- **Historial flotante**: Mantiene registro de saltos aplicados

### Funcionalidad

- **Evaluación robusta**: Maneja diferentes tipos de datos y comparaciones
- **Notificaciones**: Informa cuando se aplica la lógica de salto
- **Scroll automático**: Lleva al usuario a la pregunta objetivo
- **Validación**: Verifica que las referencias sean válidas

### Experiencia de Usuario

- **Navegación fluida**: Los saltos son transparentes para el usuario
- **Feedback visual**: Indicadores claros de qué está pasando
- **Controles de prueba**: Herramientas para verificar la configuración
- **Historial accesible**: Fácil acceso al historial de saltos

## Consideraciones Técnicas

### Rendimiento

- Las reglas se evalúan solo cuando es necesario
- Se usa `useCallback` para optimizar las funciones
- El historial se limita a los últimos 5 saltos

### Compatibilidad

- Funciona con todos los tipos de pregunta soportados
- Compatible con diferentes navegadores
- Responsive para dispositivos móviles

### Mantenimiento

- Código modular y reutilizable
- Logs detallados para debugging
- Estructura de datos consistente
