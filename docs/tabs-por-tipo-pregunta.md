# Tipos de preguntas y visibilidad de tabs de configuración avanzada

A continuación se listan los tipos de preguntas encontrados en el código y la visibilidad recomendada para cada tab de configuración avanzada:

## Tipos de preguntas detectados
- text (Texto simple)
- textarea (Texto largo)
- multiple_choice (Opción múltiple)
- checkbox (Casillas de verificación)
- dropdown (Lista desplegable)
- scale (Escala de calificación)
- matrix (Matriz/Tabla)
- ranking (Clasificación)
- date (Fecha)
- time (Hora)
- email (Email)
- phone (Teléfono)
- number (Número)
- rating (Valoración)
- file (Archivo)
- image_upload (Subir imagen)
- signature (Firma)
- likert (Escala Likert)
- net_promoter (Net Promoter Score)
- slider (Control deslizante)
- comment_box (Caja de comentarios)
- demographic (Demográfica)
- contact_info (Información de contacto)
- multiple_textboxes (Múltiples cajas de texto)

## Visibilidad de tabs por tipo de pregunta

| Tipo de pregunta      | Validación | Lógica | Apariencia | Escala Likert | Avanzado |
|----------------------|:----------:|:------:|:----------:|:-------------:|:--------:|
| text                 |     ✔      |   ✔    |     ✔      |               |    ✔     |
| textarea             |     ✔      |   ✔    |     ✔      |               |    ✔     |
| multiple_choice      |     ✔      |   ✔    |     ✔      |               |    ✔     |
| checkbox             |     ✔      |   ✔    |     ✔      |               |    ✔     |
| dropdown             |     ✔      |   ✔    |     ✔      |               |    ✔     |
| scale                |     ✔      |   ✔    |     ✔      |               |    ✔     |
| matrix               |     ✔      |   ✔    |     ✔      |               |    ✔     |
| ranking              |     ✔      |   ✔    |     ✔      |               |    ✔     |
| date                 |     ✔      |   ✔    |     ✔      |               |    ✔     |
| time                 |     ✔      |   ✔    |     ✔      |               |    ✔     |
| email                |     ✔      |   ✔    |     ✔      |               |    ✔     |
| phone                |     ✔      |   ✔    |     ✔      |               |    ✔     |
| number               |     ✔      |   ✔    |     ✔      |               |    ✔     |
| rating               |     ✔      |   ✔    |     ✔      |               |    ✔     |
| file                 |     ✔      |   ✔    |     ✔      |               |    ✔     |
| image_upload         |     ✔      |   ✔    |     ✔      |               |    ✔     |
| signature            |     ✔      |   ✔    |     ✔      |               |    ✔     |
| likert               |     ✔      |   ✔    |     ✔      |      ✔        |    ✔     |
| net_promoter         |     ✔      |   ✔    |     ✔      |               |    ✔     |
| slider               |     ✔      |   ✔    |     ✔      |               |    ✔     |
| comment_box          |     ✔      |   ✔    |     ✔      |               |    ✔     |
| demographic          |     ✔      |   ✔    |     ✔      |               |    ✔     |
| contact_info         |     ✔      |   ✔    |     ✔      |               |    ✔     |
| multiple_textboxes   |     ✔      |   ✔    |     ✔      |               |    ✔     |

### Notas:
- El tab "Escala Likert" solo debe mostrarse para preguntas de tipo `likert`.
- Los demás tabs (Validación, Lógica, Apariencia, Avanzado) pueden mostrarse para todos los tipos, pero pueden tener controles deshabilitados o adaptados según el tipo.
- Si se requiere una lógica más restrictiva para otros tabs, especificar los tipos permitidos.

---

**Siguiente paso:**
- Implementar la lógica condicional en el componente para mostrar/ocultar tabs según el tipo de pregunta seleccionado.
