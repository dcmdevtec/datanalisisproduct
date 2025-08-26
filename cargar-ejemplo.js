// Script para cargar el ejemplo de lógica de salto en el preview
// Ejecuta este script en la consola del navegador en la página de preview

function cargarEjemploLogicaSalto() {
  // Datos de ejemplo de la encuesta con lógica de salto
  const ejemploEncuesta = {
    "title": "Encuesta de Ejemplo con Lógica de Salto",
    "description": "Esta encuesta demuestra cómo funciona la lógica de salto entre secciones y preguntas",
    "startDate": "2024-01-01",
    "deadline": "2024-12-31",
    "sections": [
      {
        "id": "seccion-1",
        "title": "Información Básica",
        "description": "Datos personales del encuestado",
        "order_num": 1,
        "questions": [
          {
            "id": "pregunta-1",
            "type": "multiple_choice",
            "text": "¿Cuál es tu edad?",
            "options": ["Menos de 18 años", "18-25 años", "26-35 años", "Más de 35 años"],
            "required": true,
            "config": {
              "skipLogic": {
                "enabled": true,
                "rules": [
                  {
                    "value": "Menos de 18 años",
                    "enabled": true,
                    "operator": "equals",
                    "targetSectionId": "seccion-menores",
                    "targetQuestionId": "pregunta-permiso",
                    "targetQuestionText": "¿Tienes permiso de tus padres para participar?"
                  }
                ]
              }
            }
          },
          {
            "id": "pregunta-2",
            "type": "multiple_choice",
            "text": "¿Cuál es tu género?",
            "options": ["Masculino", "Femenino", "No binario", "Prefiero no decir"],
            "required": true,
            "config": {
              "skipLogic": {
                "enabled": true,
                "rules": [
                  {
                    "value": "Femenino",
                    "enabled": true,
                    "operator": "equals",
                    "targetSectionId": "seccion-genero",
                    "targetQuestionId": "pregunta-maternidad",
                    "targetQuestionText": "¿Tienes hijos?"
                  }
                ]
              }
            }
          }
        ]
      },
      {
        "id": "seccion-menores",
        "title": "Sección para Menores de Edad",
        "description": "Preguntas específicas para participantes menores de 18 años",
        "order_num": 2,
        "questions": [
          {
            "id": "pregunta-permiso",
            "type": "multiple_choice",
            "text": "¿Tienes permiso de tus padres para participar en esta encuesta?",
            "options": ["Sí", "No"],
            "required": true,
            "config": {
              "skipLogic": {
                "enabled": true,
                "rules": [
                  {
                    "value": "No",
                    "enabled": true,
                    "operator": "equals",
                    "targetSectionId": "seccion-final",
                    "targetQuestionId": "pregunta-despedida",
                    "targetQuestionText": "Gracias por tu interés. No podemos continuar sin permiso parental."
                  }
                ]
              }
            }
          },
          {
            "id": "pregunta-escuela",
            "type": "text",
            "text": "¿En qué escuela estudias?",
            "options": [],
            "required": false
          }
        ]
      },
      {
        "id": "seccion-genero",
        "title": "Sección Específica de Género",
        "description": "Preguntas relacionadas con el género del participante",
        "order_num": 3,
        "questions": [
          {
            "id": "pregunta-maternidad",
            "type": "multiple_choice",
            "text": "¿Tienes hijos?",
            "options": ["Sí", "No"],
            "required": true,
            "config": {
              "skipLogic": {
                "enabled": true,
                "rules": [
                  {
                    "value": "Sí",
                    "enabled": true,
                    "operator": "equals",
                    "targetSectionId": "seccion-padres",
                    "targetQuestionId": "pregunta-numero-hijos",
                    "targetQuestionText": "¿Cuántos hijos tienes?"
                  }
                ]
              }
            }
          }
        ]
      },
      {
        "id": "seccion-padres",
        "title": "Sección para Padres",
        "description": "Preguntas específicas para participantes que son padres",
        "order_num": 4,
        "questions": [
          {
            "id": "pregunta-numero-hijos",
            "type": "multiple_choice",
            "text": "¿Cuántos hijos tienes?",
            "options": ["1", "2", "3", "4 o más"],
            "required": true
          },
          {
            "id": "pregunta-edad-hijos",
            "type": "checkbox",
            "text": "¿Qué edades tienen tus hijos?",
            "options": ["0-2 años", "3-5 años", "6-12 años", "13-17 años", "18+ años"],
            "required": true,
            "config": {
              "skipLogic": {
                "enabled": true,
                "rules": [
                  {
                    "value": "0-2 años",
                    "enabled": true,
                    "operator": "contains",
                    "targetSectionId": "seccion-bebes",
                    "targetQuestionId": "pregunta-cuidado-bebe",
                    "targetQuestionText": "¿Qué tipo de cuidado necesitan tus bebés?"
                  }
                ]
              }
            }
          }
        ]
      },
      {
        "id": "seccion-bebes",
        "title": "Sección para Padres de Bebés",
        "description": "Preguntas específicas para padres con bebés de 0-2 años",
        "order_num": 5,
        "questions": [
          {
            "id": "pregunta-cuidado-bebe",
            "type": "checkbox",
            "text": "¿Qué tipo de cuidado necesitan tus bebés?",
            "options": ["Alimentación especial", "Cuidado médico", "Desarrollo temprano", "Otros"],
            "required": true
          }
        ]
      },
      {
        "id": "seccion-final",
        "title": "Finalización",
        "description": "Últimas preguntas antes de terminar",
        "order_num": 6,
        "questions": [
          {
            "id": "pregunta-despedida",
            "type": "textarea",
            "text": "¿Tienes algún comentario adicional?",
            "options": [],
            "required": false
          },
          {
            "id": "pregunta-contacto",
            "type": "multiple_choice",
            "text": "¿Te gustaría que te contactemos para más información?",
            "options": ["Sí", "No"],
            "required": true
          }
        ]
      }
    ],
    "settings": {
      "collectLocation": false,
      "allowAudio": false,
      "offlineMode": true,
      "distributionMethods": ["app"]
    },
    "projectData": {
      "id": "proyecto-ejemplo",
      "name": "Proyecto de Ejemplo",
      "companies": null
    }
  };

  // Guardar en localStorage
  localStorage.setItem("surveyPreviewData", JSON.stringify(ejemploEncuesta));
  
  console.log("✅ Ejemplo de encuesta con lógica de salto cargado exitosamente");
  console.log("📋 Datos guardados:", ejemploEncuesta);
  console.log("🔄 Recarga la página para ver los cambios");
  
  // Mostrar información sobre la lógica de salto
  console.log("\n🔍 LÓGICA DE SALTO CONFIGURADA:");
  console.log("1. Si edad = 'Menos de 18 años' → Saltar a 'Sección para Menores de Edad'");
  console.log("2. Si género = 'Femenino' → Saltar a 'Sección Específica de Género'");
  console.log("3. Si permiso = 'No' → Saltar a 'Finalización'");
  console.log("4. Si hijos = 'Sí' → Saltar a 'Sección para Padres'");
  console.log("5. Si edad hijos contiene '0-2 años' → Saltar a 'Sección para Padres de Bebés'");
  
  return ejemploEncuesta;
}

// Función para limpiar el ejemplo
function limpiarEjemplo() {
  localStorage.removeItem("surveyPreviewData");
  console.log("🗑️ Ejemplo de encuesta eliminado del localStorage");
  console.log("🔄 Recarga la página para ver los cambios");
}

// Función para verificar el estado actual
function verificarEstado() {
  const datos = localStorage.getItem("surveyPreviewData");
  if (datos) {
    const encuesta = JSON.parse(datos);
    console.log("📋 Encuesta actual en localStorage:", encuesta.title);
    console.log("🔢 Número de secciones:", encuesta.sections.length);
    
    // Contar preguntas con lógica de salto
    let preguntasConLogica = 0;
    encuesta.sections.forEach(seccion => {
      seccion.questions.forEach(pregunta => {
        if (pregunta.config?.skipLogic?.enabled) {
          preguntasConLogica++;
        }
      });
    });
    
    console.log("🎯 Preguntas con lógica de salto:", preguntasConLogica);
  } else {
    console.log("❌ No hay encuesta cargada en localStorage");
  }
}

// Exportar funciones para uso en consola
window.cargarEjemploLogicaSalto = cargarEjemploLogicaSalto;
window.limpiarEjemplo = limpiarEjemplo;
window.verificarEstado = verificarEstado;

console.log("🚀 Script de ejemplo de lógica de salto cargado");
console.log("📝 Comandos disponibles:");
console.log("  - cargarEjemploLogicaSalto() - Carga el ejemplo de encuesta");
console.log("  - limpiarEjemplo() - Elimina el ejemplo del localStorage");
console.log("  - verificarEstado() - Verifica el estado actual");

// Cargar automáticamente si no hay datos
if (!localStorage.getItem("surveyPreviewData")) {
  console.log("🔄 No hay encuesta cargada. Ejecuta cargarEjemploLogicaSalto() para cargar el ejemplo");
}
