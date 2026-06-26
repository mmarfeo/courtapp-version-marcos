-- --------------------------------------------------------------------------------
-- Parche: Integración de canales de chat externos (Telegram y WhatsApp)
-- --------------------------------------------------------------------------------

ALTER TABLE perfiles_usuarios 
ADD COLUMN IF NOT EXISTS telegram_id VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS telefono VARCHAR(30) UNIQUE;
