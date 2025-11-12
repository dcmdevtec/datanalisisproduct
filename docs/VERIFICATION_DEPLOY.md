# Verificación pública: despliegue y pasos necesarios

Fecha: 2025-11-12

Este documento resume qué componentes ya están implementados para el flujo de verificación de encuestados públicos, qué falta para ponerlo totalmente en marcha, y los pasos concretos (con comandos PowerShell/psql) para ejecutar la migración recomendada, desplegar los cambios y validar que las respuestas se están guardando por encuestado.

---

## Resumen rápido
- Objetivo: verificar por tipo+número de documento que una persona no responda dos veces la misma encuesta. Guardar las respuestas con la referencia al encuestado público (documento) para auditoría.
- Decisión tomada: Dejamos de usar `survey_respondent_tracking` y comprobamos la existencia de una respuesta previa en la tabla `responses` (por `respondent_document_type` + `respondent_document_number`) antes de permitir iniciar la encuesta.
- Cambios principales aplicados en el repo:
  - Endpoint de verificación: `app/api/surveys/[id]/verify-respondent/route.ts` — busca/crea `public_respondents` y consulta `responses` por documento; bloquea si ya existe.
  - Preview client: `app/preview/survey/page.tsx` — modal de verificación que guarda `respondent_public_id` y muestra el mensaje del servidor cuando se bloquea.
  - Migration (opcional, recomendado): `db/migrations/2025-11-12_fix_survey_respondent_tracking_pk.sql` — convierte la tabla `survey_respondent_tracking` para permitir `respondent_id` NULL (no obligatorio para públicos). No es obligatorio para la nueva lógica, pero recomendable para limpiar esquema histórico.

---

## Qué ya está implementado (estado actual)
- Endpoint de verificación (server): busca/crea `public_respondents` y consulta la tabla `responses` por `survey_id` y `respondent_document_type`/`respondent_document_number`. Bloquea si encuentra una respuesta previa.
- Frontend (preview): modal que pide tipo + número de documento y guarda en localStorage `respondent_public_id_{surveyId}` y los campos documentales. Muestra el mensaje de bloqueo proveniente del backend.
- `responses` ya contiene columnas relevantes: `respondent_document_type`, `respondent_document_number`, `respondent_name`, además de `respondent_id` (para usuarios autenticados). Tu esquema `responses` coincide con lo esperado.

---

## Qué falta / recomendaciones (priorizadas)
1. (ALTA) Ejecutar backup y, si lo deseas, la migración que convierte `survey_respondent_tracking` a usar `id` surrogate: `db/migrations/2025-11-12_fix_survey_respondent_tracking_pk.sql`. Esto es opcional para el flujo actual (la verificación ya no usa tracking) pero recomendable para limpiar el esquema y evitar futuras inconsistencias.
2. (ALTA) Desplegar los cambios del backend y frontend a tu entorno de staging/producción (asegúrate de usar la *service role* de Supabase en el servidor y variables de entorno configuradas).
3. (ALTA) Validar que el endpoint de `POST /api/responses` está guardando los campos `respondent_document_type` y `respondent_document_number` junto con la respuesta (esto asegura la búsqueda futura por documento). Si no, ajustar ese endpoint.
4. (MED) Añadir logs/monitorización para intentos bloqueados (opcional pero útil para auditoría/soporte).
5. (BAJA) Limpieza opcional de la tabla `survey_respondent_tracking` si decides deshacerte de ella.

---

## Pasos concretos (PowerShell) — respaldo y migración recomendada
Importante: ejecuta siempre primero en staging y haz un backup completo antes de producción.

1) Crear un dump (backup) — ejemplo PowerShell:

```powershell
# Ajusta las variables a tu entorno
$PGHOST = "db-host.example.com"
$PGPORT = "5432"
$PGUSER = "postgres"
$PGDATABASE = "your_database"
$BACKUP = "C:\backups\responses_backup_$(Get-Date -Format yyyyMMddHHmmss).dump"
pg_dump --host $PGHOST --port $PGPORT --username $PGUSER --format=custom --file $BACKUP $PGDATABASE
```

2) (Opcional pero recomendado) Ejecutar la migración que modifica la PK de `survey_respondent_tracking`:

```powershell
# Si usas psql con URL de conexión
psql "postgresql://USER:PASS@HOST:PORT/DBNAME" -f .\db\migrations\2025-11-12_fix_survey_respondent_tracking_pk.sql

# O con supabase CLI
supabase db query --file .\db\migrations\2025-11-12_fix_survey_respondent_tracking_pk.sql
```

3) (Despliegue) Subir cambios a repo y desplegar (ejemplo genérico):

```powershell
git add .
git commit -m "feat: verificación por documento público; consulta responses"
git push origin main
# Luego usar tu flujo de deploy (Vercel, supabase, CI/CD, etc.)
```

---

## Validaciones después del despliegue
1. Flow completo (happy path):
   - En preview: ingresar tipo+número -> backend devuelve allowed_to_proceed: true -> completar encuesta -> confirmar que `responses` contiene la fila con `respondent_document_type` y `respondent_document_number`.
2. Flow de bloqueo:
   - En preview: ingresar el mismo tipo+número -> backend debe devolver allowed_to_proceed: false y mostrar mensaje.
3. Verificación manual en SQL:
   - Ver filas en `responses` para la encuesta:
     ```sql
     SELECT id, respondent_document_type, respondent_document_number, respondent_name, completed_at
     FROM public.responses
     WHERE survey_id = '<SURVEY_UUID>'
     ORDER BY completed_at DESC
     LIMIT 50;
     ```

---

## Qué revisar en el endpoint `POST /api/responses`
Debe incluir en el payload (y guardar en la tabla `responses`) los campos:
- `respondent_document_type` (text)
- `respondent_document_number` (text)
- `respondent_name` (text, opcional)
- `respondent_public_id` (si prefieres mantener la referencia al public_respondent en responses)

Si no los guarda, el endpoint debe actualizarse para persistir esas columnas. Revisa `app/api/responses/route.ts` y asegúrate de que incluya estos campos al insertar.

---

## Rollback (si algo sale mal)
- Restaura el dump generado con `pg_restore` o `psql` según el formato elegido.
- Si sólo hiciste el deploy de código y hay un bug, revierte el commit en tu repo y redepliega la versión anterior.

---

## Notas finales y decisiones tomadas
- A pedido, la verificación ya no usa `survey_respondent_tracking`. Se basa en la existencia de respuestas previas en `responses` (por documento). Esto es consistente con encuestados públicos sin login.
- La migración de `survey_respondent_tracking` es opcional para este flujo, pero recomendable para evitar inconsistencias históricas.

---

Si quieres, ahora:
- Puedo añadir un script SQL para crear filas de prueba en `responses` (para pruebas locales).
- Puedo revisar `app/api/responses/route.ts` y garantizar que guarde los campos documentales (y aplicarlo si falta).
- Puedo añadir un pequeño reporte (SQL) que liste por encuesta todas las cédulas que ya respondieron.

Dime qué prefieres que haga a continuación y lo aplico.
