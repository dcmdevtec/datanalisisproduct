#!/bin/bash

echo "🚀 Iniciando proceso de deploy con optimización de imágenes de Supabase..."

echo "🧹 Limpiando caché de Next.js..."
rm -rf .next

echo "🔧 Instalando dependencias..."
npm install

echo "🏗️ Construyendo aplicación..."
npm run build

echo "✅ Proceso completado!"
echo ""
echo "📋 Checklist post-deploy:"
echo "- [ ] Verificar variables de entorno en producción"
echo "- [ ] Probar carga de imágenes de empresa/proyecto"
echo "- [ ] Confirmar que no hay errores 400 en Network Tab"
echo "- [ ] Validar optimización WebP/AVIF en producción"
echo ""
echo "🔍 Para debuggear imágenes:"
echo "1. Abrir Network Tab en DevTools"
echo "2. Buscar requests a /_next/image"
echo "3. Verificar que no haya errores 400"
echo "4. Confirmar que las URLs coinciden con remotePatterns"