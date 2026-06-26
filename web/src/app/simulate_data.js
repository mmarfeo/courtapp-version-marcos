const { Client } = require('pg');
const crypto = require('crypto');

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

const PLAYERS_COUNT = 32;

const firstNames = [
  'Santiago', 'Carlos', 'Martín', 'Juan', 'Facundo', 'Matías', 'Agustín', 'Lucas', 
  'Tomás', 'Nicolás', 'Mateo', 'Benjamín', 'Franco', 'Lautaro', 'Bruno', 'Joaquín', 
  'Daniel', 'Alejandro', 'Gabriel', 'Sebastián', 'Enzo', 'Valentín', 'Felipe', 'Bautista', 
  'Thiago', 'Ramiro', 'Javier', 'Ignacio', 'Gonzalo', 'Mariano', 'Patricio', 'Rodrigo'
];

const lastNames = [
  'Pérez', 'Gómez', 'Rodríguez', 'Fernández', 'López', 'Díaz', 'Martínez', 'González', 
  'Álvarez', 'Romero', 'Herrera', 'Castro', 'Ruiz', 'Silva', 'Ramos', 'Sosa', 
  'Sánchez', 'García', 'Medina', 'Benítez', 'Flores', 'Acosta', 'Rojas', 'Molina', 
  'Quiroga', 'Ledesma', 'Correa', 'Frías', 'Cáceres', 'Ortiz', 'Morales', 'Miranda'
];

async function main() {
  await client.connect();
  console.log('Conectado a la base de datos local...');

  // 1. Generar jugadores con nombres reales
  const players = [];
  for (let i = 1; i <= PLAYERS_COUNT; i++) {
    const id = crypto.randomUUID();
    const email = `player${i}_${crypto.randomInt(1000, 9999)}@courtup.com`;
    const name = `${firstNames[i - 1]} ${lastNames[i - 1]}`;
    players.push({ id, email, name });
  }

  console.log(`Insertando ${PLAYERS_COUNT} jugadores en auth.users...`);
  for (const p of players) {
    // Insertar en auth.users
    await client.query(`
      INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, is_sso_user, is_anonymous, created_at, updated_at)
      VALUES ($1, $2, $3, 'authenticated', 'authenticated', false, false, now(), now())
      ON CONFLICT DO NOTHING;
    `, [p.id, p.email, JSON.stringify({ full_name: p.name })]);

    // La base de datos tiene un trigger para crear automáticamente perfiles_usuarios,
    // pero nos aseguramos de actualizar su categoría deportiva para simular mejor
    await client.query(`
      UPDATE perfiles_usuarios
      SET categoria = $2
      WHERE id = $1;
    `, [p.id, iToCat(players.indexOf(p))]);
  }

  // 2. Crear Torneo 1 (Tenis, Single, en fase Dieciseisavos - Formato a 3 sets con super tiebreak)
  console.log('Creando Torneo de Tenis 3 Sets (Dieciseisavos)...');
  const t1Res = await client.query(`
    INSERT INTO torneos (organizacion_id, nombre_torneo, categoria_torneo, deporte, fase_actual, formato_sets, activo)
    VALUES (1, 'Copa CourtUp Tenis - Cat B', 'B', 'Tenis', 'Dieciseisavos', '3_sets_super_tiebreak', true)
    RETURNING id;
  `);
  const t1Id = t1Res.rows[0].id;

  // Insertar partidos para Torneo 1 (16 partidos de Dieciseisavos)
  console.log(`Creando 16 partidos en Dieciseisavos para el Torneo #${t1Id}...`);
  for (let i = 0; i < 16; i++) {
    const p1 = players[i * 2];
    const p2 = players[i * 2 + 1];
    
    const isPlayed = i < 10;
    const resultado_set1 = isPlayed ? String(crypto.randomInt(6, 8)) : null;
    const resultado_set2 = isPlayed ? String(crypto.randomInt(2, 6)) : null;
    // Super tiebreak de tercer set (ej: 10-8 o 10-5)
    const resultado_set3 = (isPlayed && crypto.randomInt(0, 2) === 1) ? `${crypto.randomInt(10, 12)}-${crypto.randomInt(5, 9)}` : null;
    const ganador_pareja = isPlayed ? (crypto.randomInt(1, 3)) : null;

    await client.query(`
      INSERT INTO partidos (torneo_id, fase, p1_jugador_1_id, p2_jugador_1_id, fecha_partido, hora_partido, resultado_set1, resultado_set2, resultado_set3, ganador_pareja)
      VALUES ($1, 'Dieciseisavos', $2, $3, CURRENT_DATE + $4::int, '18:00:00', $5, $6, $7, $8);
    `, [
      t1Id, 
      p1.id, 
      p2.id, 
      i, 
      resultado_set1, 
      resultado_set2, 
      resultado_set3, 
      ganador_pareja
    ]);
  }

  // 3. Crear Torneo 2 (Pádel, Dobles, en fase Final/Semifinal - Formato a 3 sets normal)
  console.log('Creando Torneo de Pádel Dobles (Final)...');
  const t2Res = await client.query(`
    INSERT INTO torneos (organizacion_id, nombre_torneo, categoria_torneo, deporte, fase_actual, formato_sets, activo)
    VALUES (2, 'Abierto de Pádel Club El Abierto - Cat A', 'A', 'Padel', 'Final', '3_sets_normal', true)
    RETURNING id;
  `);
  const t2Id = t2Res.rows[0].id;

  console.log('Creando partidos de Cuartos de Final...');
  const cuartosIds = [];
  for (let i = 0; i < 4; i++) {
    const p1_j1 = players[i * 4];
    const p1_j2 = players[i * 4 + 1];
    const p2_j1 = players[i * 4 + 2];
    const p2_j2 = players[i * 4 + 3];

    const res = await client.query(`
      INSERT INTO partidos (torneo_id, fase, p1_jugador_1_id, p1_jugador_2_id, p2_jugador_1_id, p2_jugador_2_id, fecha_partido, hora_partido, resultado_set1, resultado_set2, resultado_set3, ganador_pareja)
      VALUES ($1, 'Cuartos', $2, $3, $4, $5, CURRENT_DATE - 3, '19:00:00', '6', '4', $6, $7)
      RETURNING id;
    `, [
      t2Id,
      p1_j1.id, p1_j2.id,
      p2_j1.id, p2_j2.id,
      i % 2 === 0 ? '6' : null,
      1
    ]);
    cuartosIds.push(res.rows[0].id);
  }

  console.log('Creando partidos de Semifinal...');
  const semi1Res = await client.query(`
    INSERT INTO partidos (torneo_id, fase, p1_jugador_1_id, p1_jugador_2_id, p2_jugador_1_id, p2_jugador_2_id, partido_previo_p1_id, partido_previo_p2_id, fecha_partido, hora_partido, resultado_set1, resultado_set2, ganador_pareja)
    VALUES ($1, 'Semifinal', $2, $3, $4, $5, $6, $7, CURRENT_DATE - 1, '20:30:00', '7', '5', 1)
    RETURNING id;
  `, [
    t2Id,
    players[0].id, players[1].id,
    players[4].id, players[5].id,
    cuartosIds[0], cuartosIds[1]
  ]);
  const semi1Id = semi1Res.rows[0].id;

  const semi2Res = await client.query(`
    INSERT INTO partidos (torneo_id, fase, p1_jugador_1_id, p1_jugador_2_id, p2_jugador_1_id, p2_jugador_2_id, partido_previo_p1_id, partido_previo_p2_id, fecha_partido, hora_partido, resultado_set1, resultado_set2, ganador_pareja)
    VALUES ($1, 'Semifinal', $2, $3, $4, $5, $6, $7, CURRENT_DATE - 1, '21:00:00', '6', '3', 2)
    RETURNING id;
  `, [
    t2Id,
    players[8].id, players[9].id,
    players[12].id, players[13].id,
    cuartosIds[2], cuartosIds[3]
  ]);
  const semi2Id = semi2Res.rows[0].id;

  console.log('Creando partido de Final...');
  await client.query(`
    INSERT INTO partidos (torneo_id, fase, p1_jugador_1_id, p1_jugador_2_id, p2_jugador_1_id, p2_jugador_2_id, partido_previo_p1_id, partido_previo_p2_id, fecha_partido, hora_partido)
    VALUES ($1, 'Final', $2, $3, $4, $5, $6, $7, CURRENT_DATE + 2, '21:00:00');
  `, [
    t2Id,
    players[0].id, players[1].id,
    players[12].id, players[13].id,
    semi1Id,
    semi2Id
  ]);

  // 4. Crear Torneo 3 (Tenis, Single, en fase Octavos - Formato express a 1 set único)
  console.log('Creando Torneo de Tenis Express 1 Set (Octavos)...');
  const t3Res = await client.query(`
    INSERT INTO torneos (organizacion_id, nombre_torneo, categoria_torneo, deporte, fase_actual, formato_sets, activo)
    VALUES (3, 'Desafío Tenis Express - Cat C', 'C', 'Tenis', 'Octavos', '1_set', true)
    RETURNING id;
  `);
  const t3Id = t3Res.rows[0].id;

  console.log(`Creando 8 partidos en Octavos para el Torneo Express #${t3Id}...`);
  for (let i = 0; i < 8; i++) {
    // Usamos jugadores de la segunda mitad para este torneo
    const p1 = players[16 + i * 2];
    const p2 = players[16 + i * 2 + 1];
    
    const isPlayed = i < 5;
    const resultado_set1 = isPlayed ? String(crypto.randomInt(6, 10)) : null;
    const ganador_pareja = isPlayed ? (crypto.randomInt(1, 3)) : null;

    await client.query(`
      INSERT INTO partidos (torneo_id, fase, p1_jugador_1_id, p2_jugador_1_id, fecha_partido, hora_partido, resultado_set1, ganador_pareja)
      VALUES ($1, 'Octavos', $2, $3, CURRENT_DATE + $4::int, '17:00:00', $5, $6);
    `, [
      t3Id, 
      p1.id, 
      p2.id, 
      i, 
      resultado_set1, 
      ganador_pareja
    ]);
  }

  console.log('¡Simulación completada con éxito!');
  await client.end();
}

function iToCat(i) {
  const cats = ['A', 'B', 'C', 'D'];
  return cats[i % cats.length];
}

main().catch(async (err) => {
  console.error('Error durante la simulación:', err);
  await client.end();
});
