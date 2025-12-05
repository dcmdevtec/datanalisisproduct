# 🚀 Guía Rápida de Uso - Módulo de Zonas Optimizado

## 📖 Introducción

El módulo de zonas permite crear áreas geográficas de dos formas diferentes:
1. **Por Barrios (Choropleth)**: Selecciona barrios predefinidos del mapa
2. **Dibujo Manual**: Dibuja polígonos, líneas o puntos personalizados

## 🎯 Características Principales

### ✅ Problemas Resueltos
- ❌ **ANTES**: El mapa se recargaba al escribir → ✅ **AHORA**: Escritura fluida sin recargas
- ❌ **ANTES**: Coordenadas no se guardaban bien → ✅ **AHORA**: Guardado preciso de geometrías
- ❌ **ANTES**: Rendimiento lento → ✅ **AHORA**: Interfaz rápida y responsiva

### 🆕 Nuevas Características
- 🎨 Colores aleatorios automáticos para cada zona
- 📍 Contador de barrios seleccionados
- 🗑️ Eliminar barrios individualmente
- 🔍 Búsqueda inteligente de direcciones
- ✅ Validaciones robustas
- 📸 Captura automática de vista del mapa

---

## 📝 Modo 1: Crear Zona por Barrios

### Pasos:

1. **Abrir el módulo**
   - Ve a la sección "Zonas" en el menú
   - Click en "Crear Zona"

2. **Configurar información básica**
   - Ingresa el **Nombre de la Zona** (obligatorio)
     - ✅ El mapa NO se recargará al escribir
   - Ingresa una **Descripción** (opcional)

3. **Seleccionar modo**
   - Asegúrate que esté seleccionado **"Por Barrios"**
   - Se mostrará el mapa con barrios de Barranquilla

4. **Seleccionar barrios**
   - **Opción A - Click directo:**
     - Haz click en los barrios del mapa que desees incluir
     - Los barrios se pintarán con el color de tu zona
     - Aparecerán como badges arriba del mapa
   
   - **Opción B - Búsqueda:**
     - Usa la barra de búsqueda en el mapa
     - Escribe una dirección o nombre de barrio
     - El barrio correspondiente se seleccionará automáticamente

5. **Gestionar barrios**
   - Para **deseleccionar** un barrio: Click en el barrio pintado O click en la X del badge
   - Los barrios seleccionados se muestran arriba: "Barrios Seleccionados (N)"

6. **Capturar vista** (opcional pero recomendado)
   - Click en el botón "Capturar Vista"
   - Se generará una imagen del mapa actual
   - Esta imagen se mostrará en la vista previa de la zona

7. **Guardar**
   - Click en "Crear Zona"
   - La zona se guardará con:
     - ✅ Geometría combinada de todos los barrios
     - ✅ Lista de barrios seleccionados
     - ✅ Snapshot del mapa
     - ✅ Color único

### 💡 Tips:
- Puedes seleccionar barrios no contiguos (separados)
- El sistema combinará automáticamente los barrios en una geometría válida
- Usa la búsqueda para encontrar barrios rápidamente
- El zoom automático te lleva a los barrios seleccionados

---

## ✏️ Modo 2: Crear Zona por Dibujo Manual

### Pasos:

1. **Abrir el módulo**
   - Ve a la sección "Zonas" en el menú
   - Click en "Crear Zona"

2. **Configurar información básica**
   - Ingresa el **Nombre de la Zona** (obligatorio)
   - Ingresa una **Descripción** (opcional)

3. **Seleccionar modo**
   - Click en **"Dibujo Manual"**
   - Se mostrará el mapa con herramientas de dibujo

4. **Dibujar en el mapa**
   
   **Herramientas disponibles:**
   
   - **📐 Rectángulo**: Dibuja un área rectangular
     - Click en un punto inicial
     - Arrastra hasta el punto final
   
   - **🔷 Polígono**: Dibuja un área con forma personalizada
     - Click para cada vértice
     - Doble click o click en el primer punto para cerrar
   
   - **📏 Línea**: Dibuja una ruta o camino
     - Click para cada punto de la línea
     - Doble click para finalizar
   
   - **📍 Marcador**: Coloca un punto específico
     - Click en la ubicación deseada

5. **Editar el dibujo** (opcional)
   - **Editar**: Click en el ícono de lápiz, luego arrastra los puntos
   - **Eliminar**: Click en el ícono de basurero, luego click en la figura

6. **Búsqueda de ubicación** (opcional)
   - Usa la barra de búsqueda para encontrar una dirección
   - Se creará automáticamente un rectángulo del área buscada

7. **Capturar vista** (opcional pero recomendado)
   - Click en "Capturar Vista"
   - Se generará una imagen del dibujo actual

8. **Guardar**
   - Click en "Crear Zona"
   - La zona se guardará con la geometría exacta dibujada

### 💡 Tips:
- Solo puedes tener una figura a la vez (dibuja una nueva para reemplazar)
- Usa polígonos para áreas irregulares
- Usa líneas para rutas o caminos
- La búsqueda crea automáticamente un área del lugar encontrado

---

## ✏️ Editar una Zona Existente

1. **Abrir la edición**
   - En la lista de zonas, click en "Editar" de la zona deseada

2. **Modificar información**
   - Cambia el nombre o descripción
   - Cambia el modo (Barrios ↔ Manual) si lo deseas
   - Modifica la selección o el dibujo

3. **Guardar cambios**
   - Click en "Guardar Cambios"
   - La geometría se actualizará correctamente

### ⚠️ Importante al cambiar de modo:
- Si cambias de "Barrios" a "Manual": Se perderán los barrios seleccionados
- Si cambias de "Manual" a "Barrios": Se perderá el dibujo actual
- El sistema te pedirá confirmación antes de cambiar

---

## 🗑️ Eliminar una Zona

1. En la lista de zonas, click en "Eliminar"
2. Confirma la eliminación en el diálogo
3. La zona se eliminará permanentemente

⚠️ **Advertencia**: Esta acción no se puede deshacer

---

## 🔍 Buscar Zonas

Usa la barra de búsqueda en la parte superior para filtrar zonas por:
- Nombre
- Descripción

---

## ❓ Preguntas Frecuentes

### ¿Por qué debo capturar la vista del mapa?
La vista capturada se muestra en la tarjeta de la zona para identificarla rápidamente. Si no capturas, se generará automáticamente al guardar.

### ¿Puedo combinar barrios no adyacentes?
Sí, el sistema creará una geometría válida (MultiPolygon) que incluye todos los barrios seleccionados.

### ¿Qué pasa si dibujo una figura muy compleja?
El sistema guardará la geometría exacta, sin importar su complejidad.

### ¿Puedo tener múltiples figuras en modo manual?
No, solo una figura a la vez. Para múltiples áreas, usa el modo "Por Barrios" o crea zonas separadas.

### ¿Las coordenadas se guardan correctamente ahora?
✅ Sí, ambos modos guardan las coordenadas correctamente en la base de datos.

### ¿El mapa se sigue recargando al escribir?
✅ No, este bug fue solucionado. Ahora puedes escribir sin interrupciones.

---

## 📊 Información Técnica

### Datos Guardados:
```javascript
{
  name: "Nombre de la zona",
  description: "Descripción",
  geometry: { /* GeoJSON válido */ },
  zone_color: "#4ecdc4",
  selected_neighborhoods: ["Barrio 1", "Barrio 2"], // Solo en modo barrios
  map_snapshot: "https://...", // URL de la imagen
  status: "active"
}
```

### Tipos de Geometría Soportados:
- Point (Punto)
- LineString (Línea)
- Polygon (Polígono)
- MultiPolygon (Múltiples polígonos)
- GeometryCollection (Colección mixta)

---

## 🐛 Solución de Problemas

### Problema: El mapa no carga
**Solución**: Recarga la página (F5)

### Problema: No puedo seleccionar barrios
**Solución**: Asegúrate de estar en modo "Por Barrios"

### Problema: El botón "Guardar" está deshabilitado
**Solución**: Verifica que:
- Hayas ingresado un nombre
- Hayas seleccionado barrios (modo barrios) o dibujado algo (modo manual)

### Problema: La geometría no se guardó
**Solución**: 
1. Revisa la consola del navegador (F12) para errores
2. Intenta capturar la vista antes de guardar
3. Reporta el problema con los logs de consola

---

## ✅ Checklist Antes de Guardar

- [ ] Nombre ingresado
- [ ] Barrios seleccionados o figura dibujada
- [ ] Vista capturada (recomendado)
- [ ] Descripción agregada (opcional)
- [ ] Verificado en el mapa que la zona es correcta

---

## 📞 Soporte

Si encuentras problemas:
1. Abre la consola del navegador (F12)
2. Busca mensajes con emojis: ✅, ❌, ⚠️, 📍
3. Copia los mensajes de error
4. Reporta con screenshots si es posible

---

**Última actualización**: 2025-12-02
**Versión**: 1.0.0
