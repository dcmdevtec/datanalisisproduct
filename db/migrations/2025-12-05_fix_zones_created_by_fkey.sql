-- Eliminar la constraint existente que no permite NULL
ALTER TABLE zones DROP CONSTRAINT IF EXISTS zones_created_by_fkey;

-- Recrear la constraint permitiendo NULL
ALTER TABLE zones 
ADD CONSTRAINT zones_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES users(id) 
ON DELETE SET NULL;
