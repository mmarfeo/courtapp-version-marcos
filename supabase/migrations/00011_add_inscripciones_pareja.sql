-- Agregar la columna pareja_usuario_id a la tabla inscripciones_torneo
ALTER TABLE inscripciones_torneo ADD COLUMN IF NOT EXISTS pareja_usuario_id UUID REFERENCES perfiles_usuarios(id) ON DELETE SET NULL;
