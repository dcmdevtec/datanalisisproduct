/**
 * Banco de preguntas predefinidas para sugerencias en el editor de encuestas.
 * Se puede ampliar con preguntas de otras encuestas desde la base de datos.
 */

export interface QuestionTemplate {
  id: string
  text: string
  type: string
  category: string
  tags: string[]
  options?: string[]
  config?: Record<string, unknown>
}

export const QUESTION_CATEGORIES = [
  "Demografía",
  "Satisfacción",
  "NPS",
  "Opinión",
  "Gestión pública",
  "Salud",
  "Educación",
  "Servicios",
  "Vivienda",
  "Seguridad",
  "Empleo",
  "Transporte",
  "Medio ambiente",
  "General",
] as const

export const questionTemplates: QuestionTemplate[] = [
  // ── Demografía ────────────────────────────────────────────────────────────
  { id: "d01", category: "Demografía", type: "multiple_choice", tags: ["género", "sexo"], text: "¿Cuál es su género?", options: ["Masculino", "Femenino", "No binario", "Prefiero no decirlo"] },
  { id: "d02", category: "Demografía", type: "multiple_choice", tags: ["edad", "rango etario"], text: "¿En qué rango de edad se encuentra?", options: ["Menos de 18 años", "18 a 25 años", "26 a 35 años", "36 a 45 años", "46 a 55 años", "56 a 65 años", "Más de 65 años"] },
  { id: "d03", category: "Demografía", type: "multiple_choice", tags: ["estrato", "nivel socioeconómico"], text: "¿En qué estrato socioeconómico vive?", options: ["Estrato 1", "Estrato 2", "Estrato 3", "Estrato 4", "Estrato 5", "Estrato 6", "No sabe / No responde"] },
  { id: "d04", category: "Demografía", type: "multiple_choice", tags: ["educación", "escolaridad"], text: "¿Cuál es su nivel educativo más alto alcanzado?", options: ["Sin estudios", "Primaria incompleta", "Primaria completa", "Secundaria incompleta", "Secundaria completa", "Técnico / Tecnólogo", "Universitario incompleto", "Universitario completo", "Posgrado"] },
  { id: "d05", category: "Demografía", type: "multiple_choice", tags: ["ocupación", "empleo", "trabajo"], text: "¿Cuál es su situación laboral actual?", options: ["Empleado", "Trabajador independiente", "Desempleado buscando trabajo", "Estudiante", "Ama de casa", "Pensionado / Jubilado", "Otro"] },
  { id: "d06", category: "Demografía", type: "text", tags: ["barrio", "ubicación", "localidad"], text: "¿En qué barrio o localidad reside actualmente?" },
  { id: "d07", category: "Demografía", type: "multiple_choice", tags: ["tiempo", "residencia"], text: "¿Cuánto tiempo lleva viviendo en este sector?", options: ["Menos de 1 año", "Entre 1 y 3 años", "Entre 3 y 5 años", "Entre 5 y 10 años", "Más de 10 años"] },
  { id: "d08", category: "Demografía", type: "multiple_choice", tags: ["ingresos", "salario"], text: "¿En qué rango se encuentran los ingresos mensuales de su hogar?", options: ["Menos de 1 SMMLV", "1 a 2 SMMLV", "2 a 3 SMMLV", "3 a 5 SMMLV", "Más de 5 SMMLV", "No sabe / No responde"] },
  { id: "d09", category: "Demografía", type: "number", tags: ["personas", "hogar", "núcleo familiar"], text: "¿Cuántas personas viven en su hogar incluyéndose usted?" },
  { id: "d10", category: "Demografía", type: "multiple_choice", tags: ["documento", "cédula"], text: "¿Cuál es su tipo de documento de identidad?", options: ["Cédula de ciudadanía", "Tarjeta de identidad", "Cédula de extranjería", "Pasaporte", "Permiso especial de permanencia (PEP)"] },

  // ── Satisfacción ─────────────────────────────────────────────────────────
  { id: "s01", category: "Satisfacción", type: "scale", tags: ["satisfacción", "servicio", "calidad"], text: "En general, ¿qué tan satisfecho/a está con el servicio recibido?", config: { scaleMin: 1, scaleMax: 5, scaleLabels: ["Muy insatisfecho", "", "", "", "Muy satisfecho"] } },
  { id: "s02", category: "Satisfacción", type: "scale", tags: ["satisfacción", "atención", "trato"], text: "¿Cómo califica el trato recibido por parte del personal?", config: { scaleMin: 1, scaleMax: 5, scaleLabels: ["Muy malo", "", "", "", "Excelente"] } },
  { id: "s03", category: "Satisfacción", type: "multiple_choice", tags: ["satisfacción", "expectativas"], text: "El servicio recibido ¿superó sus expectativas?", options: ["Sí, superó mis expectativas", "Cumplió exactamente lo esperado", "Estuvo por debajo de lo esperado", "No cumplió mis expectativas en absoluto"] },
  { id: "s04", category: "Satisfacción", type: "textarea", tags: ["mejoras", "sugerencias", "recomendaciones"], text: "¿Qué aspectos considera que deberían mejorar?" },
  { id: "s05", category: "Satisfacción", type: "multiple_choice", tags: ["volvería", "fidelización"], text: "¿Volvería a utilizar este servicio?", options: ["Definitivamente sí", "Probablemente sí", "No estoy seguro/a", "Probablemente no", "Definitivamente no"] },
  { id: "s06", category: "Satisfacción", type: "scale", tags: ["tiempo", "espera", "rapidez"], text: "¿Cómo califica el tiempo de respuesta o atención recibida?", config: { scaleMin: 1, scaleMax: 5 } },
  { id: "s07", category: "Satisfacción", type: "checkbox", tags: ["problemas", "dificultades"], text: "¿Tuvo alguna dificultad durante el proceso? (puede marcar varias)", options: ["Largas filas de espera", "Personal poco amable", "Información confusa o incompleta", "Trámites complicados", "Falta de medios digitales", "Ninguna"] },
  { id: "s08", category: "Satisfacción", type: "scale", tags: ["calidad", "instalaciones", "infraestructura"], text: "¿Cómo evalúa las instalaciones o el lugar donde fue atendido/a?", config: { scaleMin: 1, scaleMax: 5 } },

  // ── NPS ───────────────────────────────────────────────────────────────────
  { id: "n01", category: "NPS", type: "scale", tags: ["nps", "recomendación", "promotor"], text: "En una escala del 0 al 10, ¿qué tan probable es que recomiende este servicio a un familiar o amigo?", config: { scaleMin: 0, scaleMax: 10, scaleLabels: ["Nada probable", "", "", "", "", "", "", "", "", "", "Muy probable"] } },
  { id: "n02", category: "NPS", type: "textarea", tags: ["nps", "razón", "porqué"], text: "¿Cuál es la razón principal de su puntuación?" },
  { id: "n03", category: "NPS", type: "scale", tags: ["nps", "municipio", "ciudad"], text: "¿Qué tan probable es que recomiende vivir en este municipio/ciudad a otras personas?", config: { scaleMin: 0, scaleMax: 10 } },

  // ── Opinión ───────────────────────────────────────────────────────────────
  { id: "o01", category: "Opinión", type: "multiple_choice", tags: ["acuerdo", "desacuerdo", "likert"], text: "¿Está de acuerdo con que la administración actual está cumpliendo sus compromisos?", options: ["Totalmente de acuerdo", "De acuerdo", "Ni de acuerdo ni en desacuerdo", "En desacuerdo", "Totalmente en desacuerdo"] },
  { id: "o02", category: "Opinión", type: "multiple_choice", tags: ["confianza", "instituciones"], text: "¿Qué nivel de confianza tiene en las instituciones del gobierno local?", options: ["Mucha confianza", "Algo de confianza", "Poca confianza", "Ninguna confianza", "No sabe / No responde"] },
  { id: "o03", category: "Opinión", type: "textarea", tags: ["opinión libre", "comentarios"], text: "¿Tiene algún comentario adicional que desee compartir?" },
  { id: "o04", category: "Opinión", type: "checkbox", tags: ["prioridades", "problemas", "necesidades"], text: "¿Cuáles son los principales problemas de su comunidad? (marque hasta 3)", options: ["Inseguridad", "Desempleo", "Mala calidad de las vías", "Falta de agua potable", "Problemas de salud", "Falta de oportunidades educativas", "Corrupción", "Contaminación ambiental", "Deficiente alumbrado público", "Falta de espacios recreativos"] },
  { id: "o05", category: "Opinión", type: "multiple_choice", tags: ["aprobación", "gestión"], text: "¿Cómo califica la gestión de la actual administración?", options: ["Excelente", "Buena", "Regular", "Mala", "Muy mala", "No sabe / No responde"] },
  { id: "o06", category: "Opinión", type: "scale", tags: ["imagen", "alcalde", "gobernador"], text: "¿Cómo califica la imagen del alcalde / gobernador?", config: { scaleMin: 1, scaleMax: 10 } },

  // ── Gestión pública ───────────────────────────────────────────────────────
  { id: "g01", category: "Gestión pública", type: "multiple_choice", tags: ["obras", "conocimiento", "logros"], text: "¿Conoce alguna obra o logro realizado por la administración actual en su barrio o sector?", options: ["Sí, conozco varias", "Conozco una o dos", "He escuchado pero no las conozco bien", "No conozco ninguna"] },
  { id: "g02", category: "Gestión pública", type: "checkbox", tags: ["obras", "importante", "prioridad"], text: "¿Cuáles de las siguientes obras considera más importantes para su comunidad?", options: ["Construcción de vías y andenes", "Mejoramiento de acueducto y alcantarillado", "Parques y zonas verdes", "Centros de salud", "Instituciones educativas", "Alumbrado público", "Transporte público", "Proyectos productivos y empleo"] },
  { id: "g03", category: "Gestión pública", type: "multiple_choice", tags: ["inversión", "recurso", "presupuesto"], text: "¿Considera que los recursos públicos se están invirtiendo adecuadamente?", options: ["Sí", "No", "No sabe"] },
  { id: "g04", category: "Gestión pública", type: "multiple_choice", tags: ["participación", "voto", "elecciones"], text: "¿Participó en las últimas elecciones locales?", options: ["Sí, voté", "No voté", "No recuerdo"] },
  { id: "g05", category: "Gestión pública", type: "multiple_choice", tags: ["transparencia", "corrupción"], text: "¿Considera que existe transparencia en la gestión de los recursos públicos en su municipio?", options: ["Sí, hay mucha transparencia", "Hay algo de transparencia", "Hay poca transparencia", "No hay transparencia", "No sabe / No tiene información"] },

  // ── Servicios públicos ────────────────────────────────────────────────────
  { id: "sp01", category: "Servicios", type: "scale", tags: ["agua", "acueducto", "calidad"], text: "¿Cómo califica la calidad del servicio de agua potable en su hogar?", config: { scaleMin: 1, scaleMax: 5 } },
  { id: "sp02", category: "Servicios", type: "scale", tags: ["energía", "electricidad", "luz"], text: "¿Cómo califica el servicio de energía eléctrica en su sector?", config: { scaleMin: 1, scaleMax: 5 } },
  { id: "sp03", category: "Servicios", type: "multiple_choice", tags: ["internet", "conectividad", "acceso"], text: "¿Tiene acceso a internet en su hogar?", options: ["Sí, internet fijo", "Sí, solo datos móviles", "Tengo acceso compartido con vecinos", "No tengo acceso a internet"] },
  { id: "sp04", category: "Servicios", type: "multiple_choice", tags: ["recolección", "basura", "aseo"], text: "¿Con qué frecuencia se recoge la basura en su barrio?", options: ["Todos los días", "3 veces por semana", "2 veces por semana", "1 vez por semana", "Con menor frecuencia", "No hay servicio de recolección"] },
  { id: "sp05", category: "Servicios", type: "scale", tags: ["alumbrado", "iluminación", "noche"], text: "¿Cómo califica el alumbrado público de su barrio?", config: { scaleMin: 1, scaleMax: 5 } },

  // ── Salud ─────────────────────────────────────────────────────────────────
  { id: "h01", category: "Salud", type: "multiple_choice", tags: ["salud", "afiliación", "eps"], text: "¿Se encuentra afiliado a algún sistema de salud?", options: ["Sí, régimen contributivo (EPS)", "Sí, régimen subsidiado (SISBEN)", "No estoy afiliado", "No sabe"] },
  { id: "h02", category: "Salud", type: "multiple_choice", tags: ["salud", "acceso", "centro médico"], text: "¿Tiene acceso a un centro de salud o hospital cercano a su vivienda?", options: ["Sí, a menos de 15 minutos", "Sí, entre 15 y 30 minutos", "Sí, más de 30 minutos", "No tengo acceso cercano"] },
  { id: "h03", category: "Salud", type: "scale", tags: ["salud", "atención médica", "hospital"], text: "¿Cómo califica la atención médica que ha recibido en los últimos 6 meses?", config: { scaleMin: 1, scaleMax: 5 } },
  { id: "h04", category: "Salud", type: "multiple_choice", tags: ["salud mental", "bienestar"], text: "En general, ¿cómo describe su estado de salud?", options: ["Excelente", "Bueno", "Regular", "Malo"] },

  // ── Educación ─────────────────────────────────────────────────────────────
  { id: "e01", category: "Educación", type: "multiple_choice", tags: ["educación", "calidad", "colegio"], text: "¿Cómo califica la calidad de la educación pública en su municipio?", options: ["Excelente", "Buena", "Regular", "Mala", "Muy mala", "No tiene información"] },
  { id: "e02", category: "Educación", type: "multiple_choice", tags: ["educación", "hijos", "escuela"], text: "¿Tiene hijos o menores a su cargo en edad escolar?", options: ["Sí, y están estudiando", "Sí, pero no están estudiando", "No tengo hijos en edad escolar"] },
  { id: "e03", category: "Educación", type: "checkbox", tags: ["educación", "problemas", "barreras"], text: "¿Cuáles son las principales barreras para acceder a la educación en su comunidad?", options: ["Falta de colegios cercanos", "Altos costos", "Necesidad de trabajar", "Falta de transporte", "Inseguridad en el camino", "Baja calidad de enseñanza", "Ninguna barrera"] },

  // ── Vivienda ──────────────────────────────────────────────────────────────
  { id: "v01", category: "Vivienda", type: "multiple_choice", tags: ["vivienda", "tenencia", "propiedad"], text: "¿Cuál es la condición de la vivienda donde reside?", options: ["Propia pagada", "Propia financiada", "Arrendada", "Familiar o prestada", "Otra"] },
  { id: "v02", category: "Vivienda", type: "multiple_choice", tags: ["vivienda", "material", "construcción"], text: "¿En qué tipo de material está construida principalmente su vivienda?", options: ["Ladrillo o bloque", "Adobe o tapia", "Madera", "Material mixto", "Otro material"] },
  { id: "v03", category: "Vivienda", type: "multiple_choice", tags: ["vivienda", "subsidio", "interés social"], text: "¿Ha aplicado o recibido algún subsidio de vivienda?", options: ["Sí, y ya tengo mi vivienda", "Sí, estoy en proceso", "Nunca he aplicado", "Apliqué pero no fui beneficiado"] },

  // ── Seguridad ─────────────────────────────────────────────────────────────
  { id: "seg01", category: "Seguridad", type: "scale", tags: ["seguridad", "percepción", "tranquilidad"], text: "¿Qué tan seguro/a se siente en su barrio o sector?", config: { scaleMin: 1, scaleMax: 5, scaleLabels: ["Muy inseguro", "", "", "", "Muy seguro"] } },
  { id: "seg02", category: "Seguridad", type: "multiple_choice", tags: ["seguridad", "victima", "delito"], text: "¿Ha sido víctima de algún delito en los últimos 12 meses?", options: ["Sí", "No", "Prefiero no responder"] },
  { id: "seg03", category: "Seguridad", type: "checkbox", tags: ["seguridad", "problemas", "delincuencia"], text: "¿Cuáles son los principales problemas de seguridad en su barrio? (puede marcar varios)", options: ["Hurto a personas", "Hurto a vehículos", "Microtráfico", "Peleas y riñas callejeras", "Pandillas", "Extorsión", "Ninguno de los anteriores"] },

  // ── Empleo ────────────────────────────────────────────────────────────────
  { id: "emp01", category: "Empleo", type: "multiple_choice", tags: ["empleo", "formalidad"], text: "¿Su empleo actual es formal o informal?", options: ["Formal (con contrato y prestaciones)", "Informal (sin contrato ni prestaciones)", "Soy independiente formal", "No trabajo actualmente"] },
  { id: "emp02", category: "Empleo", type: "multiple_choice", tags: ["empleo", "satisfacción laboral"], text: "¿Está satisfecho/a con su situación laboral actual?", options: ["Muy satisfecho/a", "Satisfecho/a", "Poco satisfecho/a", "Insatisfecho/a", "No aplica"] },
  { id: "emp03", category: "Empleo", type: "multiple_choice", tags: ["empleo", "búsqueda", "desempleo"], text: "¿Ha buscado empleo en los últimos 3 meses?", options: ["Sí, activamente", "Sí, de vez en cuando", "No", "No aplica"] },

  // ── Transporte ────────────────────────────────────────────────────────────
  { id: "t01", category: "Transporte", type: "multiple_choice", tags: ["transporte", "medio", "movilidad"], text: "¿Cuál es el principal medio de transporte que utiliza a diario?", options: ["Transporte público (bus/metro/MIO)", "Moto propia", "Carro propio", "Bicicleta", "A pie", "Taxi / app de transporte", "Otro"] },
  { id: "t02", category: "Transporte", type: "scale", tags: ["transporte público", "calidad", "bus"], text: "¿Cómo califica el transporte público de su ciudad?", config: { scaleMin: 1, scaleMax: 5 } },
  { id: "t03", category: "Transporte", type: "multiple_choice", tags: ["vías", "estado", "carreteras"], text: "¿Cómo califica el estado de las vías en su barrio o sector?", options: ["Excelente", "Bueno", "Regular", "Malo", "Muy malo"] },

  // ── Medio ambiente ────────────────────────────────────────────────────────
  { id: "ma01", category: "Medio ambiente", type: "scale", tags: ["ambiente", "contaminación", "calidad del aire"], text: "¿Cómo percibe la calidad del aire en su sector?", config: { scaleMin: 1, scaleMax: 5, scaleLabels: ["Muy contaminado", "", "", "", "Muy limpio"] } },
  { id: "ma02", category: "Medio ambiente", type: "multiple_choice", tags: ["reciclaje", "residuos", "ambiente"], text: "¿En su hogar realizan alguna práctica de reciclaje o separación de residuos?", options: ["Sí, siempre", "A veces", "Casi nunca", "No, nunca"] },
  { id: "ma03", category: "Medio ambiente", type: "scale", tags: ["espacio verde", "parques", "naturaleza"], text: "¿Cómo califica el acceso a zonas verdes y parques en su sector?", config: { scaleMin: 1, scaleMax: 5 } },

  // ── General / Cierre ─────────────────────────────────────────────────────
  { id: "gen01", category: "General", type: "multiple_choice", tags: ["medio", "información", "noticias"], text: "¿Por qué medio se informa principalmente sobre los asuntos de su municipio?", options: ["Televisión", "Radio", "Redes sociales", "Periódico impreso", "Páginas web", "Vecinos y familia", "No me informo"] },
  { id: "gen02", category: "General", type: "multiple_choice", tags: ["participación ciudadana", "comunidad"], text: "¿Participa en alguna organización o grupo comunitario?", options: ["Sí, activamente", "De vez en cuando", "No, pero me gustaría", "No, y no tengo interés"] },
  { id: "gen03", category: "General", type: "scale", tags: ["bienestar", "calidad de vida"], text: "En general, ¿cómo califica su calidad de vida actualmente?", config: { scaleMin: 1, scaleMax: 10 } },
  { id: "gen04", category: "General", type: "multiple_choice", tags: ["futuro", "expectativas", "esperanza"], text: "¿Cree que la situación de su municipio mejorará en los próximos 2 años?", options: ["Sí, mejorará mucho", "Mejorará un poco", "Permanecerá igual", "Empeorará un poco", "Empeorará mucho", "No sabe"] },
  { id: "gen05", category: "General", type: "textarea", tags: ["sugerencia", "mensaje", "propuesta"], text: "Si pudiera darle un mensaje o propuesta a las autoridades locales, ¿cuál sería?" },
  { id: "gen06", category: "General", type: "multiple_choice", tags: ["encuesta", "frecuencia", "consulta"], text: "¿Le gustaría ser consultado/a con más frecuencia sobre temas de su comunidad?", options: ["Sí, definitivamente", "Sí, pero dependiendo del tema", "Me es indiferente", "No, prefiero no ser consultado"] },
]

/**
 * Filtra plantillas de preguntas según un texto de búsqueda.
 * Busca en: text, category, tags.
 */
export function searchQuestionTemplates(query: string, limit = 8): QuestionTemplate[] {
  if (!query || query.trim().length < 2) return []
  const q = query.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  return questionTemplates
    .filter((t) => {
      const haystack = [t.text, t.category, ...t.tags]
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
      return haystack.includes(q)
    })
    .slice(0, limit)
}
