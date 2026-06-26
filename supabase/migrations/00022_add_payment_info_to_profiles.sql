-- Add payment configuration fields to perfiles_usuarios (for Professors/Organizers)
ALTER TABLE perfiles_usuarios
ADD COLUMN cvu VARCHAR(22),
ADD COLUMN alias VARCHAR(50),
ADD COLUMN banco VARCHAR(100),
ADD COLUMN cuit_cuil VARCHAR(20),
ADD COLUMN mp_access_token TEXT,
ADD COLUMN mp_refresh_token TEXT,
ADD COLUMN mp_user_id VARCHAR(100);

-- Add receipt URL for manual bank transfers in class reservations
ALTER TABLE reservas_clases
ADD COLUMN comprobante_url TEXT;

-- Update RLS policies to allow users to update their own payment fields (already handled by 00003_rls_policies_setup.sql for perfiles_usuarios, but we're just adding columns so it should be fine).
