-- Modificar la tabla canchas para agregar precios por hora y horario nocturno
ALTER TABLE canchas
ADD COLUMN precio_hora_dia DECIMAL(10,2) NOT NULL DEFAULT 14000.00,
ADD COLUMN precio_hora_noche DECIMAL(10,2) NOT NULL DEFAULT 18000.00,
ADD COLUMN hora_inicio_noche TIME NOT NULL DEFAULT '18:00:00';
