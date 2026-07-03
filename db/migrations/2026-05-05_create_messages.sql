-- ============================================================
-- Migración: crear tabla messages
-- Fecha: 2026-05-05
-- Ejecutar en: Supabase SQL Editor
-- ============================================================

-- 1. Crear tabla
CREATE TABLE IF NOT EXISTS public.messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    UUID NOT NULL,
  receiver_id  UUID,
  content      TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'direct' CHECK (message_type IN ('direct', 'broadcast')),
  read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS messages_sender_idx   ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS messages_receiver_idx ON public.messages (receiver_id);
CREATE INDEX IF NOT EXISTS messages_created_idx  ON public.messages (created_at DESC);
CREATE INDEX IF NOT EXISTS messages_type_idx     ON public.messages (message_type);

-- 3. Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_updated_at ON public.messages;
CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Leer: remitente, destinatario o broadcast
DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
    OR message_type = 'broadcast'
  );

-- Insertar: solo como remitente
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Actualizar read: solo el destinatario
DROP POLICY IF EXISTS "messages_update_read" ON public.messages;
CREATE POLICY "messages_update_read" ON public.messages
  FOR UPDATE USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
