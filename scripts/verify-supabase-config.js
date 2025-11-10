#!/usr/bin/env node

/**
 * Script de verificación de configuración de Supabase
 * Ejecutar con: node scripts/verify-supabase-config.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración de Supabase...\n');

let errors = [];
let warnings = [];
let success = [];

// 1. Verificar variables de entorno
console.log('📋 Verificando variables de entorno...');
const envPath = path.join(process.cwd(), '.env.local');

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  if (envContent.includes('NEXT_PUBLIC_SUPABASE_URL')) {
    success.push('✅ NEXT_PUBLIC_SUPABASE_URL está configurada');
  } else {
    errors.push('❌ NEXT_PUBLIC_SUPABASE_URL no está configurada');
  }
  
  if (envContent.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY')) {
    success.push('✅ NEXT_PUBLIC_SUPABASE_ANON_KEY está configurada');
  } else {
    errors.push('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY no está configurada');
  }
} else {
  errors.push('❌ Archivo .env.local no encontrado');
}

// 2. Verificar estructura de archivos
console.log('\n📁 Verificando estructura de archivos...');

const requiredFiles = [
  'lib/supabase/client.ts',
  'lib/hooks/use-supabase.ts',
  'components/auth-provider.tsx',
];

for (const file of requiredFiles) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    success.push(`✅ ${file} existe`);
  } else {
    errors.push(`❌ ${file} no encontrado`);
  }
}

// 3. Verificar que no hay imports incorrectos
console.log('\n🔎 Buscando imports incorrectos...');

function searchForBadImports(dir, badPatterns) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    // Ignorar carpetas específicas
    if (stat.isDirectory()) {
      if (['node_modules', '.next', '.git', 'dist', 'build'].includes(file)) {
        continue;
      }
      searchForBadImports(filePath, badPatterns);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      for (const pattern of badPatterns) {
        if (content.includes(pattern)) {
          warnings.push(`⚠️  ${filePath} contiene: ${pattern}`);
        }
      }
    }
  }
}

const badPatterns = [
  'createBrowserClient(',
  'from "@supabase/ssr"',
];

// Buscar en las carpetas principales
const searchDirs = ['app', 'components', 'lib'];
for (const dir of searchDirs) {
  const dirPath = path.join(process.cwd(), dir);
  if (fs.existsSync(dirPath)) {
    searchForBadImports(dirPath, badPatterns);
  }
}

if (warnings.length === 0) {
  success.push('✅ No se encontraron imports directos de createBrowserClient');
}

// 4. Verificar configuración del cliente
console.log('\n⚙️  Verificando configuración del cliente...');

const clientPath = path.join(process.cwd(), 'lib/supabase/client.ts');
if (fs.existsSync(clientPath)) {
  const clientContent = fs.readFileSync(clientPath, 'utf8');
  
  const requiredConfigs = [
    'autoRefreshToken',
    'persistSession',
    'detectSessionInUrl',
    'flowType',
    'storage'
  ];
  
  for (const config of requiredConfigs) {
    if (clientContent.includes(config)) {
      success.push(`✅ Configuración '${config}' presente`);
    } else {
      warnings.push(`⚠️  Configuración '${config}' no encontrada`);
    }
  }
  
  // Verificar patrón singleton
  if (clientContent.includes('let supabaseInstance') && clientContent.includes('if (supabaseInstance)')) {
    success.push('✅ Patrón singleton implementado correctamente');
  } else {
    errors.push('❌ Patrón singleton no encontrado o incompleto');
  }
}

// 5. Verificar auth-provider
console.log('\n🔐 Verificando auth-provider...');

const authProviderPath = path.join(process.cwd(), 'components/auth-provider.tsx');
if (fs.existsSync(authProviderPath)) {
  const authContent = fs.readFileSync(authProviderPath, 'utf8');
  
  if (authContent.includes('useMemo')) {
    success.push('✅ Auth provider usa useMemo para optimización');
  } else {
    warnings.push('⚠️  Auth provider podría beneficiarse de useMemo');
  }
  
  if (authContent.includes('useCallback')) {
    success.push('✅ Auth provider usa useCallback para funciones');
  } else {
    warnings.push('⚠️  Auth provider podría beneficiarse de useCallback');
  }
}

// Resumen
console.log('\n' + '='.repeat(50));
console.log('📊 RESUMEN DE VERIFICACIÓN\n');

if (success.length > 0) {
  console.log('✨ Éxitos:\n');
  success.forEach(msg => console.log(`  ${msg}`));
  console.log('');
}

if (warnings.length > 0) {
  console.log('⚠️  Advertencias:\n');
  warnings.forEach(msg => console.log(`  ${msg}`));
  console.log('');
}

if (errors.length > 0) {
  console.log('❌ Errores:\n');
  errors.forEach(msg => console.log(`  ${msg}`));
  console.log('');
}

console.log('='.repeat(50));

if (errors.length === 0) {
  console.log('\n✅ ¡Configuración correcta! Tu app debería funcionar sin recargas.\n');
  process.exit(0);
} else {
  console.log('\n❌ Se encontraron errores. Por favor, corrígelos antes de continuar.\n');
  process.exit(1);
}
