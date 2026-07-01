-- Tabla de historial de chat con la IA, persistente por usuario
CREATE TABLE IF NOT EXISTS public.chat_ia_historial (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.chat_ia_historial ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo ve y puede escribir sus propios mensajes
CREATE POLICY "usuario_ve_su_historial"
  ON public.chat_ia_historial
  FOR ALL
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- Índice para carga eficiente del historial paginado
CREATE INDEX idx_chat_historial_usuario_fecha
  ON public.chat_ia_historial(usuario_id, created_at DESC);
