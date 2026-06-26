-- Crear tabla de tokens
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil_id UUID NOT NULL REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    plataforma VARCHAR(20),
    creado_en TIMESTAMPTZ DEFAULT now()
);

-- Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Usuarios pueden ver sus propios tokens"
ON public.push_tokens FOR SELECT
USING (auth.uid() = perfil_id);

CREATE POLICY "Usuarios pueden insertar sus propios tokens"
ON public.push_tokens FOR INSERT
WITH CHECK (auth.uid() = perfil_id);

CREATE POLICY "Usuarios pueden actualizar sus propios tokens"
ON public.push_tokens FOR UPDATE
USING (auth.uid() = perfil_id);

CREATE POLICY "Usuarios pueden borrar sus propios tokens"
ON public.push_tokens FOR DELETE
USING (auth.uid() = perfil_id);

-- Otorgar permisos a roles autenticados
GRANT ALL ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;
