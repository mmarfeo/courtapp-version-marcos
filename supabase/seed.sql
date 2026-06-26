-- ============================================================================
-- SEED DATA: Datos de prueba para CourtUp SaaS
-- Ejecutar con: npx supabase db reset (aplicará migraciones + seed)
-- ============================================================================

-- 1. Organizaciones (Clubes)
INSERT INTO organizaciones (nombre, slug, activa) VALUES
  ('Buenos Aires Lawn Tennis Club', 'baltc', true),
  ('Club El Abierto Padel', 'elabierto', true),
  ('San Isidro Club Tenis', 'sic-tenis', true);

-- 2. Canchas
INSERT INTO canchas (organizacion_id, nombre_club, numero_cancha, superficie, deporte, activa) VALUES
  (1, 'BALTC', 1, 'Polvo de Ladrillo', 'Tenis', true),
  (1, 'BALTC', 2, 'Polvo de Ladrillo', 'Tenis', true),
  (1, 'BALTC', 3, 'Cemento', 'Tenis', true),
  (2, 'El Abierto', 1, 'Sintético (Blindex)', 'Padel', true),
  (2, 'El Abierto', 2, 'Sintético (Blindex)', 'Padel', true),
  (3, 'SIC', 1, 'Polvo de Ladrillo', 'Tenis', true),
  (3, 'SIC', 2, 'Césped Sintético', 'Tenis', true);

-- 3. Torneo de ejemplo
INSERT INTO torneos (organizacion_id, nombre_torneo, categoria_torneo, deporte, fase_actual, activo) VALUES
  (1, 'Copa Ciudad de Buenos Aires 2026', 'A', 'Tenis', 'Inscripcion', true),
  (2, 'Abierto de Padel Verano 2026', 'B', 'Padel', 'Inscripcion', true);

-- 4. Tarifas del torneo
INSERT INTO tarifas_torneo (torneo_id, precio_single, precio_dobles, precio_ambos) VALUES
  (1, 25000.00, 18000.00, 38000.00),
  (2, 20000.00, 15000.00, 30000.00);

-- 5. Usuario SuperAdmin (nicortiz29@gmail.com / admin)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a6068667-5f1d-4bd3-9b77-bdb279842645',
  'authenticated',
  'authenticated',
  'nicortiz29@gmail.com',
  crypt('admin', gen_salt('bf', 10)),
  now(),
  null,
  null,
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Nico Ortiz"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
) ON CONFLICT DO NOTHING;

-- Actualizar rol a SuperAdmin con todos los roles
UPDATE perfiles_usuarios
SET rol = 'SuperAdmin',
    roles = ARRAY['SuperAdmin','Organizador','Profesor','Jugador']::rol_usuario_saas[]
WHERE id = 'a6068667-5f1d-4bd3-9b77-bdb279842645';

-- Vincular SuperAdmin a todos los clubes
INSERT INTO miembros_organizacion (usuario_id, organizacion_id) VALUES
  ('a6068667-5f1d-4bd3-9b77-bdb279842645', 1),
  ('a6068667-5f1d-4bd3-9b77-bdb279842645', 2),
  ('a6068667-5f1d-4bd3-9b77-bdb279842645', 3)
ON CONFLICT DO NOTHING;
