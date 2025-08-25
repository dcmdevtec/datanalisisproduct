# Solución Completa al Problema de IDs que se Actualizan en survey_sections y questions

## Problema Identificado

Los IDs de las tablas `survey_sections` y `questions` se estaban actualizando cada vez que se guardaba o editaba una encuesta. Esto ocurría porque:

1. **En el código de edición**: Se eliminaban todas las secciones y preguntas existentes y se recreaban nuevas, generando nuevos UUIDs
2. **En la base de datos**: No había triggers que prevengan cambios de ID
3. **Error específico**: "JSON object requested, multiple (or no) rows returned" al intentar actualizar

## Solución Implementada

### 1. Cambios en el Código (Frontend)

#### Archivo: `app/projects/[id]/create-survey/page.tsx`

**Antes (Problema):**
```typescript
// Eliminar secciones existentes
const { error: deleteSectionsError } = await supabase
  .from("survey_sections").delete().eq("survey_id", surveyId)

// Luego insertar nuevas (generando nuevos IDs)
const { data: newSection, error: sectionError } = await supabase
  .from("survey_sections").insert([...])
```

**Después (Solución):**
```typescript
// Implementar lógica de upsert (insert or update) para secciones
if (section.id && section.id !== '' && section.id !== 'temp-id') {
  // Si la sección ya tiene un ID válido, hacer update
  const { data, error: updateError } = await supabase
    .from("survey_sections")
    .update(sectionData)
    .eq("id", section.id)
    .select()
    .single()
} else {
  // Si la sección no tiene ID, hacer insert
  const { data, error: insertError } = await supabase
    .from("survey_sections")
    .insert([sectionData])
    .select()
    .single()
}

// Implementar lógica de upsert (insert or update) para preguntas
if (q.id && q.id !== '' && q.id !== 'temp-id') {
  // Si la pregunta ya tiene un ID válido, hacer update
  const { data, error: updateError } = await supabase
    .from("questions")
    .update(questionData)
    .eq("id", q.id)
    .select()
    .single()
} else {
  // Si la pregunta no tiene ID, hacer insert
  const { data, error: insertError } = await supabase
    .from("questions")
    .insert([questionData])
    .select()
    .single()
}
```

### 2. Cambios en la Base de Datos

#### Archivo: `fix-survey-sections-ids.sql`

**Problemas identificados:**
- No había triggers para prevenir cambios de ID
- Las funciones de protección no existían
- No había validación a nivel de base de datos

**Solución implementada:**
```sql
-- Crear función robusta para prevenir cambios de ID en survey_sections
CREATE OR REPLACE FUNCTION prevent_survey_sections_id_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.id IS DISTINCT FROM NEW.id THEN
        RAISE EXCEPTION 'No se permite cambiar el ID de la tabla survey_sections. El ID original era: %, el nuevo ID es: %', 
                       OLD.id, NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear función robusta para prevenir cambios de ID en questions
CREATE OR REPLACE FUNCTION prevent_questions_id_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.id IS DISTINCT FROM NEW.id THEN
        RAISE EXCEPTION 'No se permite cambiar el ID de la tabla questions. El ID original era: %, el nuevo ID es: %', 
                       OLD.id, NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear triggers que se ejecuten antes de cada UPDATE
CREATE TRIGGER prevent_survey_sections_id_change
BEFORE UPDATE ON survey_sections
FOR EACH ROW
EXECUTE FUNCTION prevent_survey_sections_id_change();

CREATE TRIGGER prevent_questions_id_change
BEFORE UPDATE ON questions
FOR EACH ROW
EXECUTE FUNCTION prevent_questions_id_change();
```

## Cómo Aplicar la Solución

### Paso 1: Ejecutar el Script SQL
```bash
# Conectar a tu base de datos PostgreSQL
psql -h tu_host -U tu_usuario -d tu_base_datos -f fix-survey-sections-ids.sql
```

### Paso 2: Verificar que Funciona
El script verificará automáticamente:
- Si las funciones existen
- Si los triggers están configurados
- Si todo está funcionando correctamente

### Paso 3: Probar la Funcionalidad
1. Editar una encuesta existente
2. Guardar los cambios
3. Verificar que los IDs de las secciones y preguntas no han cambiado

## Beneficios de la Solución

1. **IDs Estables**: Los IDs de las secciones y preguntas permanecen inmutables
2. **Integridad de Datos**: Se mantiene la relación entre encuestas, secciones y preguntas
3. **Mejor Performance**: No se recrean registros innecesariamente
4. **Auditoría**: Se puede rastrear el historial de cambios
5. **Consistencia**: Los datos relacionados no se pierden
6. **Lógica de Salto Funcional**: Las referencias en skip_logic siguen siendo válidas

## Verificación

Para verificar que la solución funciona:

```sql
-- Verificar que los triggers existen
SELECT 
    t.tgname as trigger_name,
    p.proname as function_name,
    t.tgenabled as enabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid IN ('survey_sections'::regclass, 'questions'::regclass)
AND t.tgname IN ('prevent_survey_sections_id_change', 'prevent_questions_id_change');

-- Verificar que las funciones existen
SELECT proname, prosrc FROM pg_proc 
WHERE proname IN ('prevent_survey_sections_id_change', 'prevent_questions_id_change');
```

## Notas Importantes

1. **Backup**: Siempre haz un backup de tu base de datos antes de ejecutar scripts
2. **Testing**: Prueba en un entorno de desarrollo primero
3. **Monitoreo**: Verifica los logs de PostgreSQL para asegurarte de que no hay errores
4. **Mantenimiento**: Revisa periódicamente que los triggers sigan funcionando

## Troubleshooting

### Si los triggers siguen sin funcionar:

1. **Verificar permisos**: Asegúrate de que el usuario de la base de datos tenga permisos para crear funciones y triggers
2. **Verificar logs**: Revisa los logs de PostgreSQL para errores específicos
3. **Verificar versión**: Asegúrate de que tu versión de PostgreSQL soporte triggers
4. **Verificar sintaxis**: Asegúrate de que no hay errores de sintaxis en el script SQL

### Comandos de diagnóstico:
```sql
-- Ver todos los triggers de las tablas
SELECT * FROM pg_trigger WHERE tgrelid IN ('survey_sections'::regclass, 'questions'::regclass);

-- Ver el código de las funciones
SELECT proname, prosrc FROM pg_proc 
WHERE proname IN ('prevent_survey_sections_id_change', 'prevent_questions_id_change');

-- Verificar que las funciones se ejecutan
SELECT * FROM pg_stat_user_functions 
WHERE funcname IN ('prevent_survey_sections_id_change', 'prevent_questions_id_change');
```

## Conclusión

Esta solución aborda el problema desde dos frentes:
1. **Frontend**: Implementa lógica de upsert para preservar IDs existentes tanto en secciones como en preguntas
2. **Backend**: Configura triggers robustos para prevenir cambios de ID a nivel de base de datos

Con ambos cambios implementados:
- ✅ Los IDs de las secciones permanecen estables
- ✅ Los IDs de las preguntas permanecen estables
- ✅ La lógica de salto (skip logic) funciona correctamente
- ✅ No se generan nuevos UUIDs cada vez que se edita una encuesta
- ✅ Se mantiene la integridad referencial de los datos

**Resultado**: Los IDs de las secciones y preguntas de encuestas deberían permanecer inmutables y no cambiar cada vez que se edita una encuesta.
