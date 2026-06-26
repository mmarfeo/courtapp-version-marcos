-- ENUMS
CREATE TYPE categoria_deportiva AS ENUM ('SuperA','A+','A','B+','B','C+','C','D');
CREATE TYPE modalidad_torneo    AS ENUM ('Single','Dobles','Ambos');
CREATE TYPE estado_pago_saas    AS ENUM ('Pendiente','Aprobado','Rechazado','Reembolsado');
CREATE TYPE rol_usuario_saas    AS ENUM ('Jugador','Profesor','Organizador','SuperAdmin');
CREATE TYPE fase_torneo         AS ENUM ('Inscripcion','Dieciseisavos','Octavos','Cuartos','Semifinal','Final');
CREATE TYPE tipo_deporte        AS ENUM ('Tenis','Padel');

-- ORGANIZACIONES (TENANTS)
CREATE TABLE organizaciones (
    id               SERIAL PRIMARY KEY,
    nombre           VARCHAR(150) NOT NULL,
    slug             VARCHAR(100) UNIQUE NOT NULL,
    mp_access_token  TEXT,
    mp_user_id       VARCHAR(100),
    activa           BOOLEAN DEFAULT TRUE,
    creado_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- USUARIOS (Extensión de auth.users de Supabase)
CREATE TABLE perfiles_usuarios (
    id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre              VARCHAR(100) NOT NULL,
    email               VARCHAR(150) UNIQUE NOT NULL,
    foto_url            TEXT,
    categoria           categoria_deportiva,
    rol                 rol_usuario_saas NOT NULL DEFAULT 'Jugador',
    activo              BOOLEAN DEFAULT TRUE,
    fecha_registro      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- N:M USUARIOS <> ORGANIZACIONES
CREATE TABLE miembros_organizacion (
    usuario_id       UUID REFERENCES perfiles_usuarios(id) ON DELETE CASCADE,
    organizacion_id  INT REFERENCES organizaciones(id) ON DELETE CASCADE,
    PRIMARY KEY (usuario_id, organizacion_id)
);

-- CANCHAS
CREATE TABLE canchas (
    id               SERIAL PRIMARY KEY,
    organizacion_id  INT REFERENCES organizaciones(id) ON DELETE CASCADE,
    nombre_club      VARCHAR(100) NOT NULL,
    numero_cancha    INT NOT NULL,
    superficie       VARCHAR(50),
    deporte          tipo_deporte NOT NULL DEFAULT 'Tenis',
    activa           BOOLEAN DEFAULT TRUE
);

-- CLASES (MÓDULO ACADÉMICO)
CREATE TABLE clases_disponibles (
    id               SERIAL PRIMARY KEY,
    organizacion_id  INT REFERENCES organizaciones(id) ON DELETE CASCADE,
    profesor_id      UUID REFERENCES perfiles_usuarios(id) ON DELETE CASCADE,
    cancha_id        INT REFERENCES canchas(id) ON DELETE SET NULL,
    deporte          tipo_deporte NOT NULL,
    categoria_target categoria_deportiva NOT NULL,
    fecha            DATE NOT NULL,
    hora_inicio      TIME NOT NULL,
    hora_fin         TIME NOT NULL,
    cupo_maximo      INT NOT NULL DEFAULT 1,
    precio_clase     DECIMAL(10,2) NOT NULL,
    activa           BOOLEAN DEFAULT TRUE,
    creado_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RESERVAS DE CLASES (Inscripciones de Alumnos)
CREATE TABLE reservas_clases (
    id                      SERIAL PRIMARY KEY,
    clase_id                INT REFERENCES clases_disponibles(id) ON DELETE CASCADE,
    alumno_id               UUID REFERENCES perfiles_usuarios(id),
    monto_total_pagado      DECIMAL(10,2) NOT NULL,
    comision_plataforma     DECIMAL(10,2) NOT NULL,
    monto_neto_club         DECIMAL(10,2) NOT NULL,
    estado_pago             estado_pago_saas DEFAULT 'Pendiente',
    referencia_pago_externo VARCHAR(255),
    fecha_pago              TIMESTAMP WITH TIME ZONE,
    UNIQUE(clase_id, alumno_id)
);

-- TORNEOS
CREATE TABLE torneos (
    id               SERIAL PRIMARY KEY,
    organizacion_id  INT REFERENCES organizaciones(id) ON DELETE CASCADE,
    nombre_torneo    VARCHAR(150) NOT NULL,
    categoria_torneo categoria_deportiva NOT NULL,
    deporte          tipo_deporte NOT NULL DEFAULT 'Tenis',
    fase_actual      fase_torneo DEFAULT 'Inscripcion',
    activo           BOOLEAN DEFAULT TRUE,
    creado_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- TARIFAS TORNEO
CREATE TABLE tarifas_torneo (
    id              SERIAL PRIMARY KEY,
    torneo_id       INT REFERENCES torneos(id) ON DELETE CASCADE,
    precio_single   DECIMAL(10,2) NOT NULL,
    precio_dobles   DECIMAL(10,2) NOT NULL,
    precio_ambos    DECIMAL(10,2) NOT NULL
);

-- INSCRIPCIONES TORNEO
CREATE TABLE inscripciones_torneo (
    id                       SERIAL PRIMARY KEY,
    torneo_id                INT REFERENCES torneos(id) ON DELETE CASCADE,
    usuario_id               UUID REFERENCES perfiles_usuarios(id) ON DELETE CASCADE,
    modalidad                modalidad_torneo NOT NULL,
    monto_total_pagado       DECIMAL(10,2) NOT NULL,
    comision_plataforma      DECIMAL(10,2) NOT NULL,
    monto_neto_club          DECIMAL(10,2) NOT NULL,
    estado_pago              estado_pago_saas DEFAULT 'Pendiente',
    referencia_pago_externo  VARCHAR(255),
    fecha_pago               TIMESTAMP WITH TIME ZONE,
    UNIQUE(torneo_id, usuario_id)
);

-- ALQUILERES CANCHA
CREATE TABLE alquileres_cancha (
    id                       SERIAL PRIMARY KEY,
    cancha_id                INT REFERENCES canchas(id) ON DELETE CASCADE,
    usuario_id               UUID REFERENCES perfiles_usuarios(id) ON DELETE CASCADE,
    fecha                    DATE NOT NULL,
    hora_inicio              TIME NOT NULL,
    hora_fin                 TIME NOT NULL,
    monto_total              DECIMAL(10,2) NOT NULL,
    comision_plataforma      DECIMAL(10,2) NOT NULL,
    monto_neto_club          DECIMAL(10,2) NOT NULL,
    estado_pago              estado_pago_saas DEFAULT 'Pendiente',
    referencia_pago_externo  VARCHAR(255),
    fecha_pago               TIMESTAMP WITH TIME ZONE,
    creado_at                TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- DISPONIBILIDAD PROPUESTA POR JUGADORES
CREATE TABLE propuestas_disponibilidad (
    id                      SERIAL PRIMARY KEY,
    torneo_id               INT REFERENCES torneos(id) ON DELETE CASCADE,
    jugador_1_id            UUID REFERENCES perfiles_usuarios(id) ON DELETE CASCADE,
    jugador_2_id            UUID REFERENCES perfiles_usuarios(id) ON DELETE CASCADE,
    categoria_inscripta     categoria_deportiva NOT NULL,
    fecha_disponible        DATE NOT NULL,
    hora_inicio_disponible  TIME NOT NULL,
    hora_fin_disponible     TIME NOT NULL,
    asignado_a_partido      BOOLEAN DEFAULT FALSE
);

-- PARTIDOS (ÁRBOL DEL BRACKET)
CREATE TABLE partidos (
    id                   SERIAL PRIMARY KEY,
    torneo_id            INT REFERENCES torneos(id) ON DELETE CASCADE,
    cancha_id            INT REFERENCES canchas(id) ON DELETE SET NULL,
    fase                 fase_torneo NOT NULL,
    p1_jugador_1_id      UUID REFERENCES perfiles_usuarios(id),
    p1_jugador_2_id      UUID REFERENCES perfiles_usuarios(id),
    p2_jugador_1_id      UUID REFERENCES perfiles_usuarios(id),
    p2_jugador_2_id      UUID REFERENCES perfiles_usuarios(id),
    fecha_partido        DATE,
    hora_partido         TIME,
    resultado_set1       VARCHAR(10),
    resultado_set2       VARCHAR(10),
    resultado_set3       VARCHAR(10),
    ganador_pareja       INT,
    partido_previo_p1_id INT REFERENCES partidos(id),
    partido_previo_p2_id INT REFERENCES partidos(id)
);

-- MENSAJES DE CHAT (INTERNOS POR PARTIDO)
CREATE TABLE mensajes_chat (
    id            SERIAL PRIMARY KEY,
    partido_id    INT REFERENCES partidos(id) ON DELETE CASCADE,
    remitente_id  UUID REFERENCES perfiles_usuarios(id) ON DELETE CASCADE,
    mensaje       TEXT NOT NULL,
    enviado_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
