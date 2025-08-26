// Script para cargar la encuesta de prueba de lógica de salto
// Ejecutar en la consola del navegador en la página de preview

console.log("🚀 Cargando encuesta de prueba de lógica de salto...")

// Datos de la encuesta de prueba
const testSurveyData = {
  "title": "Test Skip Logic",
  "description": "Encuesta de prueba para verificar la lógica de salto",
  "sections": [
    {
      "id": "section-1",
      "title": "Sección 1 - Pregunta Simple",
      "order_num": 1,
      "questions": [
        {
          "id": "question-1",
          "type": "multiple_choice",
          "text": "¿Te gusta el café?",
          "options": ["Sí", "No"],
          "required": true,
          "config": {
            "skipLogic": {
              "enabled": true,
              "rules": [
                {
                  "questionId": "question-1",
                  "condition": "Sí",
                  "operator": "equals",
                  "value": "Sí",
                  "targetSectionId": "section-3",
                  "targetQuestionId": "question-3",
                  "targetQuestionText": "Pregunta 3 de la sección 3",
                  "enabled": true
                }
              ]
            }
          }
        }
      ]
    },
    {
      "id": "section-2",
      "title": "Sección 2 - Pregunta de Texto",
      "order_num": 2,
      "questions": [
        {
          "id": "question-2",
          "type": "text",
          "text": "¿Cuál es tu color favorito?",
          "options": [],
          "required": true,
          "config": {
            "skipLogic": {
              "enabled": true,
              "rules": [
                {
                  "questionId": "question-2",
                  "condition": "azul",
                  "operator": "contains",
                  "value": "azul",
                  "targetSectionId": "section-4",
                  "targetQuestionId": "question-4",
                  "targetQuestionText": "Pregunta 4 de la sección 4",
                  "enabled": true
                }
              ]
            }
          }
        }
      ]
    },
    {
      "id": "section-3",
      "title": "Sección 3 - Pregunta de Checkbox",
      "order_num": 3,
      "questions": [
        {
          "id": "question-3",
          "type": "checkbox",
          "text": "¿Qué frutas te gustan?",
          "options": ["Manzana", "Plátano", "Naranja"],
          "required": true,
          "config": {
            "skipLogic": {
              "enabled": true,
              "rules": [
                {
                  "questionId": "question-3",
                  "condition": "Manzana",
                  "operator": "contains",
                  "value": "Manzana",
                  "targetSectionId": "section-5",
                  "targetQuestionId": "question-5",
                  "targetQuestionText": "Pregunta 5 de la sección 5",
                  "enabled": true
                }
              ]
            }
          }
        }
      ]
    },
    {
      "id": "section-4",
      "title": "Sección 4 - Pregunta Numérica",
      "order_num": 4,
      "questions": [
        {
          "id": "question-4",
          "type": "number",
          "text": "¿Cuántos años tienes?",
          "options": [],
          "required": true,
          "config": {
            "skipLogic": {
              "enabled": true,
              "rules": [
                {
                  "questionId": "question-4",
                  "condition": "18",
                  "operator": "greater_than",
                  "value": "18",
                  "targetSectionId": "section-6",
                  "targetQuestionId": "question-6",
                  "targetQuestionText": "Pregunta 6 de la sección 6",
                  "enabled": true
                }
              ]
            }
          }
        }
      ]
    },
    {
      "id": "section-5",
      "title": "Sección 5 - Pregunta de Rating",
      "order_num": 5,
      "questions": [
        {
          "id": "question-5",
          "type": "rating",
          "text": "¿Qué tan satisfecho estás?",
          "options": [],
          "required": true,
          "config": {
            "skipLogic": {
              "enabled": true,
              "rules": [
                {
                  "questionId": "question-5",
                  "condition": "4",
                  "operator": "greater_than",
                  "value": "4",
                  "targetSectionId": "section-7",
                  "targetQuestionId": "question-7",
                  "targetQuestionText": "Pregunta 7 de la sección 7",
                  "enabled": true
                }
              ]
            }
          }
        }
      ]
    },
    {
      "id": "section-6",
      "title": "Sección 6 - Pregunta Final",
      "order_num": 6,
      "questions": [
        {
          "id": "question-6",
          "type": "text",
          "text": "¿Tienes alguna sugerencia?",
          "options": [],
          "required": false
        }
      ]
    },
    {
      "id": "section-7",
      "title": "Sección 7 - Pregunta de Satisfacción",
      "order_num": 7,
      "questions": [
        {
          "id": "question-7",
          "type": "textarea",
          "text": "Describe tu experiencia:",
          "options": [],
          "required": true
        }
      ]
    }
  ],
  "settings": {},
  "projectData": {}
}

// Guardar en localStorage
localStorage.setItem("surveyPreviewData", JSON.stringify(testSurveyData))

console.log("✅ Encuesta de prueba cargada exitosamente!")
console.log("📋 Datos guardados en localStorage como 'surveyPreviewData'")
console.log("🔄 Recarga la página para ver la encuesta de prueba")

// Función para limpiar los datos de prueba
window.clearTestData = function() {
  localStorage.removeItem("surveyPreviewData")
  console.log("🗑️ Datos de prueba eliminados")
  location.reload()
}

// Función para verificar el estado actual
window.checkTestData = function() {
  const data = localStorage.getItem("surveyPreviewData")
  if (data) {
    const parsed = JSON.parse(data)
    console.log("📊 Estado actual de surveyPreviewData:", parsed)
    return parsed
  } else {
    console.log("❌ No hay datos de encuesta en localStorage")
    return null
  }
}

console.log("💡 Comandos disponibles:")
console.log("  - checkTestData() - Verificar datos actuales")
console.log("  - clearTestData() - Limpiar datos de prueba")
