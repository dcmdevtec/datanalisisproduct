# Documentación: Persistencia de Configuración Likert

## Descripción del Problema
Se identificó que la configuración de escala Likert no se estaba preservando correctamente cuando se guardaban las preguntas en la base de datos. El problema ocurría porque la configuración Likert no se incluía en el objeto `settings` al momento de guardar.

## Solución Implementada

### 1. Guardado de Preguntas
Se modificó la estructura de datos al guardar preguntas para incluir la configuración Likert dentro del campo `settings`:

```typescript
const questionData = {
  // ... otros campos ...
  settings: {
    // Configuraciones existentes
    allowOther: questionConfig.allowOther || false,
    randomizeOptions: questionConfig.randomizeOptions || false,
    ratingEmojis: questionConfig.ratingEmojis !== undefined ? questionConfig.ratingEmojis : true,
    scaleMin: questionConfig.scaleMin || 1,
    scaleMax: questionConfig.scaleMax || 5,
    // ... otras configuraciones ...

    // Añadir configuración Likert en settings
    likertScale: questionConfig.likertScale || null,
  },
}
```

### 2. Carga de Preguntas
Se asegura que la configuración Likert se recupere correctamente al cargar preguntas existentes:

```typescript
const questionConfig = {
  // Configuraciones generales del campo settings
  ...q.settings,
  
  // Preservar configuración Likert si existe
  likertScale: q.settings?.likertScale || null,
  
  // ... otras configuraciones ...
}
```

### 3. Creación de Nuevas Preguntas
Se inicializa el campo Likert en nuevas preguntas:

```typescript
const newQuestion = {
  // ... otros campos ...
  config: {
    // Configuraciones básicas
    allowOther: false,
    randomizeOptions: false,
    // ... otras configuraciones básicas ...

    // Configuración Likert inicializada como null
    likertScale: null,

    // ... otras configuraciones ...
  },
}
```

## Estructura de Datos

### Campo `settings` en la Base de Datos
```typescript
interface QuestionSettings {
  allowOther: boolean
  randomizeOptions: boolean
  ratingEmojis: boolean
  scaleMin: number
  scaleMax: number
  matrixCellType: string | null
  scaleLabels: string[]
  otherText: string
  dropdownMulti: boolean
  likertScale: LikertConfig | null  // Configuración Likert
}
```

### Configuración Likert
```typescript
interface LikertConfig {
  options: string[]      // Opciones de la escala
  labels?: {            // Etiquetas opcionales
    start?: string      // Etiqueta inicial
    end?: string        // Etiqueta final
  }
  style?: {            // Configuración de estilo
    direction: 'horizontal' | 'vertical'
    showLabels: boolean
  }
}
```

## Flujo de Datos

1. **Creación**: 
   - Al crear una nueva pregunta, `likertScale` se inicializa como `null`
   - El usuario puede configurar la escala Likert a través de la interfaz

2. **Guardado**:
   - La configuración Likert se incluye en el objeto `settings`
   - Se guarda en la base de datos junto con otros datos de la pregunta

3. **Carga**:
   - Al cargar una pregunta existente, se recupera la configuración del campo `settings`
   - Se mantiene la configuración en el estado local para edición

## Validación

Para verificar que la configuración se está guardando correctamente:

1. Revisar los logs de consola durante el guardado:
   ```typescript
   console.log(`📝 Configuración cargada para pregunta "${q.text.substring(0, 30)}...":`, {
     id: q.id,
     likertScale: questionConfig.likertScale,
     settings: q.settings
   })
   ```

2. Confirmar que la configuración persiste después de:
   - Guardar y recargar la encuesta
   - Editar otras preguntas
   - Reordenar secciones o preguntas
