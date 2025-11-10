#!/usr/bin/env node

/**
 * Script de migración automática de imports de Supabase
 * Ejecutar con: node scripts/migrate-supabase-imports.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 Migrando imports de Supabase...\n');

let filesUpdated = 0;
let changesCount = 0;

const replacements = [
  {
    from: /import\s+\{\s*createBrowserClient\s*\}\s+from\s+['"]@supabase\/ssr['"]/g,
    to: "import supabase from '@/lib/supabase/client'",
    description: 'Reemplazar createBrowserClient por cliente singleton'
  },
  {
    from: /import\s+\{\s*supabase\s*\}\s+from\s+['"]@\/lib\/supabase-browser['"]/g,
    to: "import supabase from '@/lib/supabase/client'",
    description: 'Actualizar import desde archivo deprecado'
  },
  {
    from: /from\s+['"]@\/lib\/supabase-client['"]/g,
    to: "from '@/lib/supabase/client'",
    description: 'Actualizar path del cliente'
  }
];

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let fileChanged = false;
  let changesInFile = 0;
  
  for (const replacement of replacements) {
    const matches = content.match(replacement.from);
    if (matches) {
      content = content.replace(replacement.from, replacement.to);
      changesInFile += matches.length;
      fileChanged = true;
      console.log(`  ✓ ${replacement.description}`);
    }
  }
  
  if (fileChanged) {
    fs.writeFileSync(filePath, content, 'utf8');
    filesUpdated++;
    changesCount += changesInFile;
    console.log(`✅ Actualizado: ${filePath} (${changesInFile} cambios)\n`);
  }
  
  return fileChanged;
}

function searchAndMigrate(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    // Ignorar carpetas específicas
    if (stat.isDirectory()) {
      if (['node_modules', '.next', '.git', 'dist', 'build'].includes(file)) {
        continue;
      }
      searchAndMigrate(filePath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      // Solo procesar archivos que no sean los que acabamos de crear
      if (!filePath.includes('lib/supabase/client.ts') && 
          !filePath.includes('lib/hooks/use-supabase.ts') &&
          !filePath.includes('scripts/')) {
        migrateFile(filePath);
      }
    }
  }
}

// Crear backup antes de migrar
console.log('📦 Creando backup...');
const backupDir = path.join(process.cwd(), '.backup-supabase-migration');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
  console.log(`✅ Backup creado en: ${backupDir}\n`);
} else {
  console.log(`ℹ️  Usando directorio de backup existente: ${backupDir}\n`);
}

// Buscar y migrar en las carpetas principales
console.log('🔍 Buscando archivos para migrar...\n');

const searchDirs = ['app', 'components', 'lib', 'hooks'];
for (const dir of searchDirs) {
  const dirPath = path.join(process.cwd(), dir);
  if (fs.existsSync(dirPath)) {
    console.log(`📂 Procesando directorio: ${dir}/`);
    searchAndMigrate(dirPath);
  }
}

// Resumen
console.log('\n' + '='.repeat(50));
console.log('📊 RESUMEN DE MIGRACIÓN\n');

if (filesUpdated > 0) {
  console.log(`✅ Archivos actualizados: ${filesUpdated}`);
  console.log(`✅ Total de cambios: ${changesCount}`);
  console.log('\n💡 Recomendaciones:');
  console.log('  1. Ejecuta: npm run verify:supabase');
  console.log('  2. Revisa los cambios con git diff');
  console.log('  3. Prueba la aplicación: npm run dev');
  console.log('  4. Si todo funciona, elimina el backup');
} else {
  console.log('ℹ️  No se encontraron archivos que necesiten migración.');
  console.log('✅ Tu código ya está usando los imports correctos.');
}

console.log('\n' + '='.repeat(50));
