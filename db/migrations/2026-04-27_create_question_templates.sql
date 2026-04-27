-- ============================================================
-- Migration: 2026-04-27_create_question_templates
-- ============================================================

-- Habilitar extensión de búsqueda por similitud
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Crear tabla
CREATE TABLE IF NOT EXISTS public.question_templates (
  id            TEXT PRIMARY KEY,
  text          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'text',
  category      TEXT NOT NULL DEFAULT 'General',
  tags          TEXT[] DEFAULT ARRAY[]::TEXT[],
  options       JSONB DEFAULT '[]'::jsonb,
  config        JSONB DEFAULT '{}'::jsonb,
  source        TEXT NOT NULL DEFAULT 'system',
  survey_id     UUID REFERENCES public.surveys(id) ON DELETE SET NULL,
  use_count     INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_qt_text_trgm   ON public.question_templates USING gin (text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_qt_category    ON public.question_templates (category);
CREATE INDEX IF NOT EXISTS idx_qt_is_active   ON public.question_templates (is_active);
CREATE INDEX IF NOT EXISTS idx_qt_use_count   ON public.question_templates (use_count DESC);

-- 3. RLS
ALTER TABLE public.question_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qt_read_active"        ON public.question_templates;
DROP POLICY IF EXISTS "qt_service_write"      ON public.question_templates;
DROP POLICY IF EXISTS "qt_user_insert_survey" ON public.question_templates;

CREATE POLICY "qt_read_active"
  ON public.question_templates FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "qt_service_write"
  ON public.question_templates FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "qt_user_insert_survey"
  ON public.question_templates FOR INSERT TO authenticated
  WITH CHECK (source = 'survey');

-- 4. Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS tg_qt_updated_at ON public.question_templates;
CREATE TRIGGER tg_qt_updated_at
  BEFORE UPDATE ON public.question_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. RPC para incremento atómico de use_count
CREATE OR REPLACE FUNCTION public.increment_question_template_use_count(template_id TEXT)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE public.question_templates
  SET use_count  = use_count + 1,
      updated_at = NOW()
  WHERE id = template_id;
$$;

-- 6. Seed con ON CONFLICT para re-ejecutar sin duplicados
INSERT INTO public.question_templates (id, text, type, category, tags, options, source)
VALUES
  ('d01', '¿Cuál es su género?', 'multiple_choice', 'Demografía', ARRAY['género','sexo']::text[], '["Masculino", "Femenino", "No binario", "Prefiero no decirlo"]'::jsonb, 'system'),
  ('d02', '¿En qué rango de edad se encuentra?', 'multiple_choice', 'Demografía', ARRAY['edad','rango etario']::text[], '["Menos de 18 años", "18 a 25 años", "26 a 35 años", "36 a 45 años", "46 a 55 años", "56 a 65 años", "Más de 65 años"]'::jsonb, 'system'),
  ('d03', '¿En qué estrato socioeconómico vive?', 'multiple_choice', 'Demografía', ARRAY['estrato','nivel socioeconómico']::text[], '["Estrato 1", "Estrato 2", "Estrato 3", "Estrato 4", "Estrato 5", "Estrato 6", "No sabe / No responde"]'::jsonb, 'system'),
  ('d04', '¿Cuál es su nivel educativo más alto alcanzado?', 'multiple_choice', 'Demografía', ARRAY['educación','escolaridad']::text[], '["Sin estudios", "Primaria incompleta", "Primaria completa", "Secundaria incompleta", "Secundaria completa", "Técnico / Tecnólogo", "Universitario incompleto", "Universitario completo", "Posgrado"]'::jsonb, 'system'),
  ('d05', '¿Cuál es su situación laboral actual?', 'multiple_choice', 'Demografía', ARRAY['ocupación','empleo','trabajo']::text[], '["Empleado", "Trabajador independiente", "Desempleado buscando trabajo", "Estudiante", "Ama de casa", "Pensionado / Jubilado", "Otro"]'::jsonb, 'system'),
  ('d06', '¿En qué barrio o localidad reside actualmente?', 'text', 'Demografía', ARRAY['barrio','ubicación','localidad']::text[], '[]'::jsonb, 'system'),
  ('d07', '¿Cuánto tiempo lleva viviendo en este sector?', 'multiple_choice', 'Demografía', ARRAY['tiempo','residencia']::text[], '["Menos de 1 año", "Entre 1 y 3 años", "Entre 3 y 5 años", "Entre 5 y 10 años", "Más de 10 años"]'::jsonb, 'system'),
  ('d08', '¿En qué rango se encuentran los ingresos mensuales de su hogar?', 'multiple_choice', 'Demografía', ARRAY['ingresos','salario']::text[], '["Menos de 1 SMMLV", "1 a 2 SMMLV", "2 a 3 SMMLV", "3 a 5 SMMLV", "Más de 5 SMMLV", "No sabe / No responde"]'::jsonb, 'system'),
  ('d09', '¿Cuántas personas viven en su hogar incluyéndose usted?', 'number', 'Demografía', ARRAY['personas','hogar','núcleo familiar']::text[], '[]'::jsonb, 'system'),
  ('d10', '¿Cuál es su tipo de documento de identidad?', 'multiple_choice', 'Demografía', ARRAY['documento','cédula']::text[], '["Cédula de ciudadanía", "Tarjeta de identidad", "Cédula de extranjería", "Pasaporte", "Permiso especial de permanencia (PEP)"]'::jsonb, 'system'),
  ('s01', 'En general, ¿qué tan satisfecho/a está con el servicio recibido?', 'scale', 'Satisfacción', ARRAY['satisfacción','servicio','calidad']::text[], '[]'::jsonb, 'system'),
  ('s02', '¿Cómo califica el trato recibido por parte del personal?', 'scale', 'Satisfacción', ARRAY['satisfacción','atención','trato']::text[], '[]'::jsonb, 'system'),
  ('s03', 'El servicio recibido ¿superó sus expectativas?', 'multiple_choice', 'Satisfacción', ARRAY['satisfacción','expectativas']::text[], '["Sí, superó mis expectativas", "Cumplió exactamente lo esperado", "Estuvo por debajo de lo esperado", "No cumplió mis expectativas en absoluto"]'::jsonb, 'system'),
  ('s04', '¿Qué aspectos considera que deberían mejorar?', 'textarea', 'Satisfacción', ARRAY['mejoras','sugerencias','recomendaciones']::text[], '[]'::jsonb, 'system'),
  ('s05', '¿Volvería a utilizar este servicio?', 'multiple_choice', 'Satisfacción', ARRAY['volvería','fidelización']::text[], '["Definitivamente sí", "Probablemente sí", "No estoy seguro/a", "Probablemente no", "Definitivamente no"]'::jsonb, 'system'),
  ('s06', '¿Cómo califica el tiempo de respuesta o atención recibida?', 'scale', 'Satisfacción', ARRAY['tiempo','espera','rapidez']::text[], '[]'::jsonb, 'system'),
  ('s07', '¿Tuvo alguna dificultad durante el proceso? (puede marcar varias)', 'checkbox', 'Satisfacción', ARRAY['problemas','dificultades']::text[], '["Largas filas de espera", "Personal poco amable", "Información confusa o incompleta", "Trámites complicados", "Falta de medios digitales", "Ninguna"]'::jsonb, 'system'),
  ('s08', '¿Cómo evalúa las instalaciones o el lugar donde fue atendido/a?', 'scale', 'Satisfacción', ARRAY['calidad','instalaciones','infraestructura']::text[], '[]'::jsonb, 'system'),
  ('n01', 'En una escala del 0 al 10, ¿qué tan probable es que recomiende este servicio a un familiar o amigo?', 'scale', 'NPS', ARRAY['nps','recomendación','promotor']::text[], '[]'::jsonb, 'system'),
  ('n02', '¿Cuál es la razón principal de su puntuación?', 'textarea', 'NPS', ARRAY['nps','razón','porqué']::text[], '[]'::jsonb, 'system'),
  ('n03', '¿Qué tan probable es que recomiende vivir en este municipio/ciudad a otras personas?', 'scale', 'NPS', ARRAY['nps','municipio','ciudad']::text[], '[]'::jsonb, 'system'),
  ('o01', '¿Está de acuerdo con que la administración actual está cumpliendo sus compromisos?', 'multiple_choice', 'Opinión', ARRAY['acuerdo','desacuerdo','likert']::text[], '["Totalmente de acuerdo", "De acuerdo", "Ni de acuerdo ni en desacuerdo", "En desacuerdo", "Totalmente en desacuerdo"]'::jsonb, 'system'),
  ('o02', '¿Qué nivel de confianza tiene en las instituciones del gobierno local?', 'multiple_choice', 'Opinión', ARRAY['confianza','instituciones']::text[], '["Mucha confianza", "Algo de confianza", "Poca confianza", "Ninguna confianza", "No sabe / No responde"]'::jsonb, 'system'),
  ('o03', '¿Tiene algún comentario adicional que desee compartir?', 'textarea', 'Opinión', ARRAY['opinión libre','comentarios']::text[], '[]'::jsonb, 'system'),
  ('o04', '¿Cuáles son los principales problemas de su comunidad? (marque hasta 3)', 'checkbox', 'Opinión', ARRAY['prioridades','problemas','necesidades']::text[], '["Inseguridad", "Desempleo", "Mala calidad de las vías", "Falta de agua potable", "Problemas de salud", "Falta de oportunidades educativas", "Corrupción", "Contaminación ambiental", "Deficiente alumbrado público", "Falta de espacios recreativos"]'::jsonb, 'system'),
  ('o05', '¿Cómo califica la gestión de la actual administración?', 'multiple_choice', 'Opinión', ARRAY['aprobación','gestión']::text[], '["Excelente", "Buena", "Regular", "Mala", "Muy mala", "No sabe / No responde"]'::jsonb, 'system'),
  ('o06', '¿Cómo califica la imagen del alcalde / gobernador?', 'scale', 'Opinión', ARRAY['imagen','alcalde','gobernador']::text[], '[]'::jsonb, 'system'),
  ('g01', '¿Conoce alguna obra o logro realizado por la administración actual en su barrio o sector?', 'multiple_choice', 'Gestión pública', ARRAY['obras','conocimiento','logros']::text[], '["Sí, conozco varias", "Conozco una o dos", "He escuchado pero no las conozco bien", "No conozco ninguna"]'::jsonb, 'system'),
  ('g02', '¿Cuáles de las siguientes obras considera más importantes para su comunidad?', 'checkbox', 'Gestión pública', ARRAY['obras','importante','prioridad']::text[], '["Construcción de vías y andenes", "Mejoramiento de acueducto y alcantarillado", "Parques y zonas verdes", "Centros de salud", "Instituciones educativas", "Alumbrado público", "Transporte público", "Proyectos productivos y empleo"]'::jsonb, 'system'),
  ('g03', '¿Considera que los recursos públicos se están invirtiendo adecuadamente?', 'multiple_choice', 'Gestión pública', ARRAY['inversión','recurso','presupuesto']::text[], '["Sí", "No", "No sabe"]'::jsonb, 'system'),
  ('g04', '¿Participó en las últimas elecciones locales?', 'multiple_choice', 'Gestión pública', ARRAY['participación','voto','elecciones']::text[], '["Sí, voté", "No voté", "No recuerdo"]'::jsonb, 'system'),
  ('g05', '¿Considera que existe transparencia en la gestión de los recursos públicos en su municipio?', 'multiple_choice', 'Gestión pública', ARRAY['transparencia','corrupción']::text[], '["Sí, hay mucha transparencia", "Hay algo de transparencia", "Hay poca transparencia", "No hay transparencia", "No sabe / No tiene información"]'::jsonb, 'system'),
  ('sp01', '¿Cómo califica la calidad del servicio de agua potable en su hogar?', 'scale', 'Servicios', ARRAY['agua','acueducto','calidad']::text[], '[]'::jsonb, 'system'),
  ('sp02', '¿Cómo califica el servicio de energía eléctrica en su sector?', 'scale', 'Servicios', ARRAY['energía','electricidad','luz']::text[], '[]'::jsonb, 'system'),
  ('sp03', '¿Tiene acceso a internet en su hogar?', 'multiple_choice', 'Servicios', ARRAY['internet','conectividad','acceso']::text[], '["Sí, internet fijo", "Sí, solo datos móviles", "Tengo acceso compartido con vecinos", "No tengo acceso a internet"]'::jsonb, 'system'),
  ('sp04', '¿Con qué frecuencia se recoge la basura en su barrio?', 'multiple_choice', 'Servicios', ARRAY['recolección','basura','aseo']::text[], '["Todos los días", "3 veces por semana", "2 veces por semana", "1 vez por semana", "Con menor frecuencia", "No hay servicio de recolección"]'::jsonb, 'system'),
  ('sp05', '¿Cómo califica el alumbrado público de su barrio?', 'scale', 'Servicios', ARRAY['alumbrado','iluminación','noche']::text[], '[]'::jsonb, 'system'),
  ('h01', '¿Se encuentra afiliado a algún sistema de salud?', 'multiple_choice', 'Salud', ARRAY['salud','afiliación','eps']::text[], '["Sí, régimen contributivo (EPS)", "Sí, régimen subsidiado (SISBEN)", "No estoy afiliado", "No sabe"]'::jsonb, 'system'),
  ('h02', '¿Tiene acceso a un centro de salud o hospital cercano a su vivienda?', 'multiple_choice', 'Salud', ARRAY['salud','acceso','centro médico']::text[], '["Sí, a menos de 15 minutos", "Sí, entre 15 y 30 minutos", "Sí, más de 30 minutos", "No tengo acceso cercano"]'::jsonb, 'system'),
  ('h03', '¿Cómo califica la atención médica que ha recibido en los últimos 6 meses?', 'scale', 'Salud', ARRAY['salud','atención médica','hospital']::text[], '[]'::jsonb, 'system'),
  ('h04', 'En general, ¿cómo describe su estado de salud?', 'multiple_choice', 'Salud', ARRAY['salud mental','bienestar']::text[], '["Excelente", "Bueno", "Regular", "Malo"]'::jsonb, 'system'),
  ('e01', '¿Cómo califica la calidad de la educación pública en su municipio?', 'multiple_choice', 'Educación', ARRAY['educación','calidad','colegio']::text[], '["Excelente", "Buena", "Regular", "Mala", "Muy mala", "No tiene información"]'::jsonb, 'system'),
  ('e02', '¿Tiene hijos o menores a su cargo en edad escolar?', 'multiple_choice', 'Educación', ARRAY['educación','hijos','escuela']::text[], '["Sí, y están estudiando", "Sí, pero no están estudiando", "No tengo hijos en edad escolar"]'::jsonb, 'system'),
  ('e03', '¿Cuáles son las principales barreras para acceder a la educación en su comunidad?', 'checkbox', 'Educación', ARRAY['educación','problemas','barreras']::text[], '["Falta de colegios cercanos", "Altos costos", "Necesidad de trabajar", "Falta de transporte", "Inseguridad en el camino", "Baja calidad de enseñanza", "Ninguna barrera"]'::jsonb, 'system'),
  ('v01', '¿Cuál es la condición de la vivienda donde reside?', 'multiple_choice', 'Vivienda', ARRAY['vivienda','tenencia','propiedad']::text[], '["Propia pagada", "Propia financiada", "Arrendada", "Familiar o prestada", "Otra"]'::jsonb, 'system'),
  ('v02', '¿En qué tipo de material está construida principalmente su vivienda?', 'multiple_choice', 'Vivienda', ARRAY['vivienda','material','construcción']::text[], '["Ladrillo o bloque", "Adobe o tapia", "Madera", "Material mixto", "Otro material"]'::jsonb, 'system'),
  ('v03', '¿Ha aplicado o recibido algún subsidio de vivienda?', 'multiple_choice', 'Vivienda', ARRAY['vivienda','subsidio','interés social']::text[], '["Sí, y ya tengo mi vivienda", "Sí, estoy en proceso", "Nunca he aplicado", "Apliqué pero no fui beneficiado"]'::jsonb, 'system'),
  ('seg01', '¿Qué tan seguro/a se siente en su barrio o sector?', 'scale', 'Seguridad', ARRAY['seguridad','percepción','tranquilidad']::text[], '[]'::jsonb, 'system'),
  ('seg02', '¿Ha sido víctima de algún delito en los últimos 12 meses?', 'multiple_choice', 'Seguridad', ARRAY['seguridad','victima','delito']::text[], '["Sí", "No", "Prefiero no responder"]'::jsonb, 'system'),
  ('seg03', '¿Cuáles son los principales problemas de seguridad en su barrio? (puede marcar varios)', 'checkbox', 'Seguridad', ARRAY['seguridad','problemas','delincuencia']::text[], '["Hurto a personas", "Hurto a vehículos", "Microtráfico", "Peleas y riñas callejeras", "Pandillas", "Extorsión", "Ninguno de los anteriores"]'::jsonb, 'system'),
  ('emp01', '¿Su empleo actual es formal o informal?', 'multiple_choice', 'Empleo', ARRAY['empleo','formalidad']::text[], '["Formal (con contrato y prestaciones)", "Informal (sin contrato ni prestaciones)", "Soy independiente formal", "No trabajo actualmente"]'::jsonb, 'system'),
  ('emp02', '¿Está satisfecho/a con su situación laboral actual?', 'multiple_choice', 'Empleo', ARRAY['empleo','satisfacción laboral']::text[], '["Muy satisfecho/a", "Satisfecho/a", "Poco satisfecho/a", "Insatisfecho/a", "No aplica"]'::jsonb, 'system'),
  ('emp03', '¿Ha buscado empleo en los últimos 3 meses?', 'multiple_choice', 'Empleo', ARRAY['empleo','búsqueda','desempleo']::text[], '["Sí, activamente", "Sí, de vez en cuando", "No", "No aplica"]'::jsonb, 'system'),
  ('t01', '¿Cuál es el principal medio de transporte que utiliza a diario?', 'multiple_choice', 'Transporte', ARRAY['transporte','medio','movilidad']::text[], '["Transporte público (bus/metro/MIO)", "Moto propia", "Carro propio", "Bicicleta", "A pie", "Taxi / app de transporte", "Otro"]'::jsonb, 'system'),
  ('t02', '¿Cómo califica el transporte público de su ciudad?', 'scale', 'Transporte', ARRAY['transporte público','calidad','bus']::text[], '[]'::jsonb, 'system'),
  ('t03', '¿Cómo califica el estado de las vías en su barrio o sector?', 'multiple_choice', 'Transporte', ARRAY['vías','estado','carreteras']::text[], '["Excelente", "Bueno", "Regular", "Malo", "Muy malo"]'::jsonb, 'system'),
  ('ma01', '¿Cómo percibe la calidad del aire en su sector?', 'scale', 'Medio ambiente', ARRAY['ambiente','contaminación','calidad del aire']::text[], '[]'::jsonb, 'system'),
  ('ma02', '¿En su hogar realizan alguna práctica de reciclaje o separación de residuos?', 'multiple_choice', 'Medio ambiente', ARRAY['reciclaje','residuos','ambiente']::text[], '["Sí, siempre", "A veces", "Casi nunca", "No, nunca"]'::jsonb, 'system'),
  ('ma03', '¿Cómo califica el acceso a zonas verdes y parques en su sector?', 'scale', 'Medio ambiente', ARRAY['espacio verde','parques','naturaleza']::text[], '[]'::jsonb, 'system'),
  ('gen01', '¿Por qué medio se informa principalmente sobre los asuntos de su municipio?', 'multiple_choice', 'General', ARRAY['medio','información','noticias']::text[], '["Televisión", "Radio", "Redes sociales", "Periódico impreso", "Páginas web", "Vecinos y familia", "No me informo"]'::jsonb, 'system'),
  ('gen02', '¿Participa en alguna organización o grupo comunitario?', 'multiple_choice', 'General', ARRAY['participación ciudadana','comunidad']::text[], '["Sí, activamente", "De vez en cuando", "No, pero me gustaría", "No, y no tengo interés"]'::jsonb, 'system'),
  ('gen03', 'En general, ¿cómo califica su calidad de vida actualmente?', 'scale', 'General', ARRAY['bienestar','calidad de vida']::text[], '[]'::jsonb, 'system'),
  ('gen04', '¿Cree que la situación de su municipio mejorará en los próximos 2 años?', 'multiple_choice', 'General', ARRAY['futuro','expectativas','esperanza']::text[], '["Sí, mejorará mucho", "Mejorará un poco", "Permanecerá igual", "Empeorará un poco", "Empeorará mucho", "No sabe"]'::jsonb, 'system'),
  ('gen05', 'Si pudiera darle un mensaje o propuesta a las autoridades locales, ¿cuál sería?', 'textarea', 'General', ARRAY['sugerencia','mensaje','propuesta']::text[], '[]'::jsonb, 'system'),
  ('gen06', '¿Le gustaría ser consultado/a con más frecuencia sobre temas de su comunidad?', 'multiple_choice', 'General', ARRAY['encuesta','frecuencia','consulta']::text[], '["Sí, definitivamente", "Sí, pero dependiendo del tema", "Me es indiferente", "No, prefiero no ser consultado"]'::jsonb, 'system')
ON CONFLICT (id) DO UPDATE SET
  text       = EXCLUDED.text,
  type       = EXCLUDED.type,
  category   = EXCLUDED.category,
  tags       = EXCLUDED.tags,
  options    = EXCLUDED.options,
  is_active  = TRUE,
  updated_at = NOW();

-- Fin de migración
