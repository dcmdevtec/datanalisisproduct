# Guía de Despliegue

Este documento resume las configuraciones, scripts y variables de entorno clave para el correcto despliegue de esta aplicación Next.js.

## 1. Archivo `package.json`

Contiene los scripts y dependencias del proyecto.

### Scripts Principales

-   `"dev"`: Inicia el servidor de desarrollo estándar de Next.js.
-   `"dev:ultra"`: Inicia el servidor de desarrollo con una configuración optimizada para velocidad (`next.config.dev.mjs`).
-   `"build"`: Ejecuta el proceso de compilación estándar de Next.js para producción.
-   `"build:safe"`: Ejecuta la compilación para producción utilizando una configuración específica y más segura (`next.config.build.mjs`).
-   `"start"`: Inicia el servidor de producción de Next.js en el puerto `3000`. **Este es el comando que se usa en producción.**
-   `"lint"`: Ejecuta el linter de Next.js para revisar la calidad del código.

### Dependencias Clave

La aplicación depende de varios paquetes, entre los que destacan:

-   **Framework**: `next`, `react`, `react-dom`
-   **UI y Componentes**: `@mantine/core`, `@radix-ui/*`, `lucide-react`, `tailwindcss`
-   **Backend y Datos**: `@supabase/ssr`, `@supabase/supabase-js`
-   **Editor de Texto Enriquecido**: `@tiptap/react`
-   **Mapas**: `leaflet`, `react-leaflet`, `react-leaflet-draw`

## 2. Archivo `Dockerfile`

Define el entorno contenedorizado para construir y ejecutar la aplicación.

-   **Estrategia Multi-etapa**:
    1.  **Etapa `builder`**: Usa `node:20-alpine` para instalar dependencias (`npm install`) y compilar el proyecto (`npm run build`). Esto crea una build optimizada de producción.
    2.  **Etapa de ejecución**: Usa una imagen limpia de `node:20-alpine` y copia únicamente los artefactos necesarios de la etapa `builder` (`.next`, `public`, `node_modules`, `package.json`, `next.config.mjs`).

-   **Puerto Expuesto**: El contenedor expone el puerto `3000`.
-   **Comando de Inicio**: El contenedor se inicia ejecutando `npm start`, que a su vez ejecuta `next start -p 3000`.

## 3. Archivos de Configuración de Next.js

Existen múltiples archivos de configuración para diferentes entornos:

### `next.config.mjs` (Configuración General)

-   **Optimizaciones**: Habilita optimizaciones de paquetes (`@radix-ui`, `lucide-react`) y de CSS.
-   **Imágenes**: Configura la optimización de imágenes con formatos `webp` y `avif`.
-   **Webpack**: Excluye módulos del lado del servidor (`fs`, `net`, etc.) para compatibilidad con el entorno de navegador.
-   **Supabase**: Configurado para funcionar correctamente con `serverExternalPackages`.

### `next.config.build.mjs` (Configuración para `npm run build:safe`)

-   **Seguridad**: Deshabilita los errores de ESLint y TypeScript durante la compilación para no detener el pipeline.
-   **Consola**: Elimina los `console.log` en el código de producción.
-   **Headers de Seguridad**: Añade headers HTTP (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`) para mejorar la seguridad.

### `next.config.dev.mjs` (Configuración para `npm run dev:ultra`)

-   **Optimización para Desarrollo**: Configuración agresiva para un entorno de desarrollo más rápido, deshabilitando `reactStrictMode`, optimizaciones de CSS, Turbo, y usando `eval` para los source maps de Webpack.

## 4. Variables de Entorno

Aunque el contenido del archivo `.env.local` no está disponible, la configuración y las dependencias (`@supabase/supabase-js`) sugieren que las siguientes variables de entorno son **críticas** para el funcionamiento de la aplicación:

```env
# URL de tu proyecto de Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<id-proyecto>.supabase.co

# Clave anónima (pública) de tu proyecto de Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-clave-anon>

# (Opcional, pero recomendado para operaciones seguras del lado del servidor)
# Clave de servicio (secreta) de tu proyecto de Supabase
SUPABASE_SERVICE_ROLE_KEY=<tu-clave-de-servicio>
```

Es fundamental que estas variables estén configuradas en el entorno de despliegue.
