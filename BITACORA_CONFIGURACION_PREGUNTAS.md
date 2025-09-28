# Configuración de Preguntas con Opciones Fuera del Editor Enriquecido

Este documento describe los tipos de preguntas en el editor de encuestas que actualmente muestran configuraciones (como límites de selección, opciones, etc.) fuera del editor enriquecido (el bloque que tiene el botón "Guardar"). Se identifican los problemas y se proponen soluciones para que toda la configuración relevante esté dentro del editor enriquecido, permitiendo guardar todo de una vez y evitando inconsistencias.

## Tipos de preguntas afectados

- **multiple_choice** (Opción múltiple)
- **checkbox** (Casillas de verificación)
- **dropdown** (Lista desplegable)
- **ranking**
- **matrix** (cuando el tipo de celda es select, rating, ranking)
- **likert**
- **star_rating**
- **scale**
- **slider**
- **demographic**
- **contact_info**
- **multiple_textboxes**

## Problemas detectados

- El bloque azul de "Límites de selección" y la lista de opciones aparecen fuera del editor enriquecido.
- Si el usuario edita límites u opciones y no abre el editor enriquecido y guarda, los cambios pueden perderse o no guardarse correctamente en Supabase.
- El usuario debe guardar la sección completa para persistir cambios, lo que es confuso y poco intuitivo.

## Solución propuesta

- **Mover toda la configuración relevante (opciones, límites, etc.) dentro del editor enriquecido** (el bloque que aparece al hacer click en el enunciado o en "Formato avanzado").
- El bloque enriquecido debe mostrar:
  - Editor de opciones (agregar, eliminar, editar opciones)
  - Configuración de límites de selección (mínimo/máximo)
  - Switches de "Permitir 'Otro'", "Aleatorizar", etc.
  - Cualquier configuración específica del tipo de pregunta
- El botón "Guardar" del editor enriquecido debe guardar todo (enunciado, opciones, límites, switches, etc.) en Supabase y en el estado local.
- Fuera del editor enriquecido solo debe mostrarse la "Vista previa" de la pregunta y sus opciones, nunca la configuración editable.

## Ejemplo de estructura dentro del editor enriquecido

```
[Editor enriquecido]
- Enunciado de la pregunta (rich text)
- Opciones (agregar, eliminar, editar)
- Límites de selección (mínimo/máximo)
- Switches (Permitir "Otro", Aleatorizar, etc.)
- Botón Guardar
```

## Tareas para refactor

1. Identificar todos los tipos de pregunta que muestran configuraciones fuera del editor enriquecido.
2. Mover la UI de configuración (opciones, límites, switches) dentro del editor enriquecido para cada tipo.
3. Asegurarse que el botón "Guardar" del editor enriquecido persista todos los cambios.
4. Dejar fuera solo la "Vista previa" (no editable).
5. Probar que los cambios se guardan correctamente y la experiencia es consistente.

---

Este cambio mejora la experiencia del usuario y evita errores de guardado.
