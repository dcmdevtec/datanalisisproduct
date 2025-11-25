-- Migration: Add contact_info columns to public_respondents
-- Created: 2025-11-25
-- Description: Agrega columnas para almacenar información completa de contacto
--              capturada mediante preguntas de tipo contact_info

-- 1) Agregar columnas de información de contacto
ALTER TABLE public.public_respondents
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2) Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_public_respondents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Crear trigger para actualizar updated_at en cada UPDATE
DROP TRIGGER IF EXISTS trigger_update_public_respondents_updated_at ON public.public_respondents;
CREATE TRIGGER trigger_update_public_respondents_updated_at
  BEFORE UPDATE ON public.public_respondents
  FOR EACH ROW
  EXECUTE FUNCTION update_public_respondents_updated_at();

-- 4) Agregar comentarios para documentación
COMMENT ON COLUMN public.public_respondents.email IS 'Correo electrónico del encuestado (capturado de contact_info)';
COMMENT ON COLUMN public.public_respondents.phone IS 'Número de teléfono del encuestado (capturado de contact_info)';
COMMENT ON COLUMN public.public_respondents.address IS 'Dirección completa del encuestado (capturado de contact_info)';
COMMENT ON COLUMN public.public_respondents.company IS 'Nombre de la empresa del encuestado (capturado de contact_info)';
COMMENT ON COLUMN public.public_respondents.updated_at IS 'Fecha de última actualización del registro';

-- 5) Crear índice para búsquedas por email (opcional pero recomendado)
CREATE INDEX IF NOT EXISTS idx_public_respondents_email ON public.public_respondents(email) WHERE email IS NOT NULL;

-- End of migration
