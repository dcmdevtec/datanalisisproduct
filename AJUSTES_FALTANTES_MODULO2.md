# 📋 AJUSTES FALTANTES - MÓDULO 2: CREACIÓN DE ENCUESTAS

## 🎯 **OBJETIVO**
Facilitar la creación de encuestas personalizadas con diversas opciones de preguntas, cumpliendo con todos los requisitos especificados en la documentación del proyecto.

---

## ✅ **ESTADO ACTUAL DEL SISTEMA**

### **Tipos de Preguntas Implementados (75%)**
- ✅ Opción múltiple selección única
- ✅ Opción múltiple (Selección múltiple) - Check List
- ✅ Escalas Likert básicas (1-10)
- ✅ Fecha
- ✅ Hora (formato estándar)
- ✅ Lista desplegable
- ✅ Preguntas abiertas (texto libre)
- ✅ Matrices y tablas
- ✅ Números y rangos básicos
- ✅ Subir archivos (opcional)
- ✅ Ranking (simulado)
- ✅ Valoración (estrellas 1-5)
- ✅ Preguntas condicionales (lógica de ramificación)

### **Funcionalidades Implementadas**
- ✅ Skip Logic completo
- ✅ Display Logic completo
- ✅ Reconciliación automática de IDs
- ✅ Validación de datos básica
- ✅ Configuración de apariencia
- ✅ Temas y colores personalizables
- ✅ Logo y branding

---

## ❌ **FUNCIONALIDADES FALTANTES CRÍTICAS**

### **1. ESCALAS LIKERT PERSONALIZABLES**
**Estado:** Solo implementado 1-10
**Faltante:**
- Escalas del 1 al 5
- Escalas del 1 al 100
- Escalas del 1 al 7
- Escalas personalizables (X a Y)
- Etiquetas personalizables para extremos
- Opción "0 = No Sabe / No Responde"

**Implementación Requerida:**
```typescript
interface ScaleConfig {
  min: number
  max: number
  step: number
  startPosition: 'left' | 'center' | 'right'
  labels: {
    left: string
    center?: string
    right: string
  }
  showZero: boolean
  zeroLabel: string
}
```

### **2. EDITOR DE TEXTO RICO**
**Estado:** No implementado
**Faltante:**
- Cambiar tamaño de letra
- Cambiar tipo de letra
- Negrita, cursiva, subrayado
- Cambiar color de letra
- Viñetas y listas
- Resaltado de texto

**Implementación Requerida:**
```typescript
interface RichTextConfig {
  fontSize: number
  fontFamily: string
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  textDecoration: 'none' | 'underline'
  color: string
  backgroundColor: string
  listStyle: 'none' | 'bullet' | 'numbered'
  highlight: boolean
}
```

### **3. SISTEMA DE VALIDACIÓN AVANZADA**
**Estado:** Básico implementado
**Faltante:**
- Prevención de respuestas duplicadas
- Validación de archivos (tamaño, tipo, formato)
- Validación de rangos numéricos
- Validación de patrones personalizados
- Mensajes de error personalizables

**Implementación Requerida:**
```typescript
interface AdvancedValidation {
  preventDuplicates: boolean
  duplicateCheckFields: string[]
  fileValidation: {
    maxSize: number
    allowedTypes: string[]
    maxFiles: number
  }
  numericRange: {
    min: number
    max: number
    step: number
  }
  customPattern: {
    regex: string
    message: string
  }
}
```

### **4. RANKING REAL (DRAG & DROP)**
**Estado:** Solo simulado
**Faltante:**
- Implementación real de drag & drop
- Ordenamiento visual de opciones
- Validación de ranking completo
- Opción de ranking parcial

**Implementación Requerida:**
```typescript
interface RankingConfig {
  allowPartial: boolean
  minRanked: number
  maxRanked: number
  showNumbers: boolean
  dragAnimation: boolean
  validation: {
    requireAll: boolean
    allowTies: boolean
  }
}
```

### **5. TIEMPO MILITAR**
**Estado:** Solo formato estándar
**Faltante:**
- Formato de 24 horas
- Formato de 12 horas
- Selector de formato
- Validación de horarios

**Implementación Requerida:**
```typescript
interface TimeConfig {
  format: '12h' | '24h'
  showSeconds: boolean
  minTime: string
  maxTime: string
  step: number
  placeholder: string
}
```

---

## 🔧 **AJUSTES TÉCNICOS REQUERIDOS**

### **1. Base de Datos**
**Tabla `questions`:**
```sql
-- Agregar campos para escalas personalizables
ALTER TABLE questions ADD COLUMN scale_config jsonb DEFAULT '{}';
ALTER TABLE questions ADD COLUMN rich_text_config jsonb DEFAULT '{}';
ALTER TABLE questions ADD COLUMN advanced_validation jsonb DEFAULT '{}';

-- Agregar campos para ranking
ALTER TABLE questions ADD COLUMN ranking_config jsonb DEFAULT '{}';

-- Agregar campos para tiempo
ALTER TABLE questions ADD COLUMN time_config jsonb DEFAULT '{}';
```

**Tabla `surveys`:**
```sql
-- Agregar campo para configuración de duplicados
ALTER TABLE surveys ADD COLUMN duplicate_prevention jsonb DEFAULT '{}';
```

### **2. Interfaces TypeScript**
```typescript
// Actualizar Question interface
interface Question {
  // ... campos existentes
  scaleConfig?: ScaleConfig
  richTextConfig?: RichTextConfig
  advancedValidation?: AdvancedValidation
  rankingConfig?: RankingConfig
  timeConfig?: TimeConfig
}

// Actualizar Survey interface
interface Survey {
  // ... campos existentes
  duplicatePrevention?: DuplicatePreventionConfig
}
```

### **3. Componentes React**
```typescript
// Nuevos componentes requeridos
- ScaleConfigurator
- RichTextEditor
- AdvancedValidationPanel
- RankingDragDrop
- TimeFormatSelector
- DuplicatePreventionSettings
```

---

## 📱 **OPTIMIZACIONES DE UX/UI**

### **1. Responsive Design**
- ✅ Implementado básicamente
- ❌ Optimización para móviles
- ❌ Touch gestures para ranking
- ❌ Adaptación de escalas para pantallas pequeñas

### **2. Accesibilidad**
- ❌ Navegación por teclado
- ❌ Screen reader support
- ❌ Alto contraste
- ❌ Tamaños de fuente ajustables

### **3. Performance**
- ❌ Lazy loading de componentes
- ❌ Memoización de validaciones
- ❌ Debounce en inputs
- ❌ Virtualización para listas largas

---

## 🚀 **PLAN DE IMPLEMENTACIÓN**

### **Fase 1: Escalas Personalizables (Prioridad ALTA)**
1. Implementar `ScaleConfigurator`
2. Actualizar base de datos
3. Integrar en question-editor
4. Actualizar preview
5. Testing y validación

### **Fase 2: Editor de Texto Rico (Prioridad ALTA)**
1. Implementar `RichTextEditor`
2. Integrar TipTap o Quill
3. Actualizar interfaces
4. Testing de funcionalidad

### **Fase 3: Validación Avanzada (Prioridad MEDIA)**
1. Implementar `AdvancedValidationPanel`
2. Sistema anti-duplicados
3. Validación de archivos
4. Testing de casos edge

### **Fase 4: Ranking Real (Prioridad MEDIA)**
1. Implementar drag & drop
2. Integrar react-beautiful-dnd
3. Validación de ranking
4. Testing de interacciones

### **Fase 5: Optimizaciones (Prioridad BAJA)**
1. Tiempo militar
2. Responsive design
3. Accesibilidad
4. Performance

---

## 🧪 **CASOS DE PRUEBA REQUERIDOS**

### **Escalas Personalizables**
- [ ] Escala 1-5 con etiquetas personalizadas
- [ ] Escala 1-100 con step personalizable
- [ ] Escala 1-7 con opción "No Sabe"
- [ ] Validación de rangos
- [ ] Persistencia de configuración

### **Editor de Texto Rico**
- [ ] Formato básico (negrita, cursiva, subrayado)
- [ ] Cambio de fuente y tamaño
- [ ] Colores de texto y fondo
- [ ] Listas y viñetas
- [ ] Resaltado de texto

### **Validación Avanzada**
- [ ] Prevención de duplicados
- [ ] Validación de archivos
- [ ] Rangos numéricos
- [ ] Patrones personalizados
- [ ] Mensajes de error

### **Ranking Real**
- [ ] Drag & drop funcional
- [ ] Validación de orden
- [ ] Opciones parciales
- [ ] Persistencia de ranking
- [ ] Responsive en móviles

---

## 📊 **MÉTRICAS DE ÉXITO**

### **Funcionalidad**
- [ ] 100% de tipos de pregunta implementados
- [ ] 100% de validaciones funcionando
- [ ] 100% de configuraciones personalizables

### **Performance**
- [ ] Tiempo de carga < 2 segundos
- [ ] Memoria < 100MB en uso
- [ ] Sin lag en interacciones

### **UX/UI**
- [ ] 100% responsive
- [ ] 100% accesible
- [ ] 100% intuitivo

---

## 🔗 **DEPENDENCIAS EXTERNAS**

### **Librerías Requeridas**
```json
{
  "react-beautiful-dnd": "^13.1.1",
  "@tiptap/react": "^2.1.0",
  "@tiptap/starter-kit": "^2.1.0",
  "react-color": "^2.19.3",
  "react-dropzone": "^14.2.3"
}
```

### **Configuraciones**
- PostCSS para optimización CSS
- Webpack para bundling optimizado
- Jest para testing unitario
- Cypress para testing E2E

---

## 📝 **NOTAS IMPORTANTES**

1. **Compatibilidad:** Mantener compatibilidad con encuestas existentes
2. **Migración:** Crear scripts de migración para datos existentes
3. **Testing:** 100% de cobertura de código requerida
4. **Documentación:** Documentar todas las nuevas funcionalidades
5. **Performance:** No degradar performance existente

---

## 🎉 **RESULTADO ESPERADO**

Al completar todos los ajustes, el sistema tendrá:
- ✅ **100% de tipos de pregunta** según especificaciones
- ✅ **Editor de texto rico** completo
- ✅ **Validación avanzada** robusta
- ✅ **Ranking real** funcional
- ✅ **Escalas personalizables** flexibles
- ✅ **UX/UI profesional** comparable a SurveyMonkey
- ✅ **Sistema robusto** para producción empresarial

**El MÓDULO 2 será la razón de ser de la aplicación, cumpliendo con todos los requisitos especificados.**
