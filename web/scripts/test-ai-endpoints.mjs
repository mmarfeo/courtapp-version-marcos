/**
 * Script de prueba manual para los endpoints de IA.
 * Uso: node web/scripts/test-ai-endpoints.mjs
 *
 * Requiere las siguientes variables de entorno:
 *   TEST_API_URL   - URL base (ej: http://localhost:3001)
 *   TEST_JWT_TOKEN - JWT de un usuario Jugador logueado
 *   TEST_JWT_PROFESOR - JWT de un usuario Profesor logueado (opcional)
 */

const API = process.env.TEST_API_URL || 'http://localhost:3001';
const TOKEN_JUGADOR = process.env.TEST_JWT_TOKEN;
const TOKEN_PROFESOR = process.env.TEST_JWT_PROFESOR;

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    → ${err.message}`);
    failed++;
  }
}

async function post(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ── A. Endpoints de canchas ─────────────────────────────────────────────────

console.log('\n── A. Endpoints de canchas ─────────────────────────────────');

await test('A.2 cancelar sin token → 401', async () => {
  const { status } = await post('/api/canchas/cancelar', { alquiler_id: 9999 }, null);
  assert(status === 401, `Esperaba 401, recibí ${status}`);
});

await test('A.2 cancelar alquiler inexistente → 404', async () => {
  if (!TOKEN_JUGADOR) return console.log('    (sin TOKEN_JUGADOR, skip)');
  const { status, data } = await post('/api/canchas/cancelar', { alquiler_id: 9999999 }, TOKEN_JUGADOR);
  assert(status === 404, `Esperaba 404, recibí ${status}: ${data.error}`);
});

await test('A.1 reservar sin token → 401', async () => {
  const { status } = await post('/api/canchas/reservar', { cancha_id: 1, fecha: '2026-12-01', hora_inicio: '10:00:00', hora_fin: '11:00:00' }, null);
  assert(status === 401, `Esperaba 401, recibí ${status}`);
});

await test('A.1 reservar con parámetros faltantes → 400', async () => {
  if (!TOKEN_JUGADOR) return console.log('    (sin TOKEN_JUGADOR, skip)');
  const { status } = await post('/api/canchas/reservar', { cancha_id: 1 }, TOKEN_JUGADOR);
  assert(status === 400, `Esperaba 400, recibí ${status}`);
});

// ── B. Endpoints de clases ──────────────────────────────────────────────────

console.log('\n── B. Endpoints de clases ───────────────────────────────────');

await test('A.3 cancelar clase sin token → 401', async () => {
  const { status } = await post('/api/clases/cancelar', { reserva_clase_id: 1 }, null);
  assert(status === 401, `Esperaba 401, recibí ${status}`);
});

await test('A.3 cancelar clase inexistente → 404', async () => {
  if (!TOKEN_JUGADOR) return console.log('    (sin TOKEN_JUGADOR, skip)');
  const { status } = await post('/api/clases/cancelar', { reserva_clase_id: 9999999 }, TOKEN_JUGADOR);
  assert(status === 404, `Esperaba 404, recibí ${status}`);
});

await test('A.6 crear clase sin token → 401', async () => {
  const { status } = await post('/api/clases/crear', { cancha_id: 1, fecha: '2026-12-01', hora_inicio: '10:00:00', hora_fin: '11:00:00', categoria_target: 'B', precio_clase: 5000, deporte: 'Tenis' }, null);
  assert(status === 401, `Esperaba 401, recibí ${status}`);
});

await test('A.6 crear clase como jugador → 403', async () => {
  if (!TOKEN_JUGADOR) return console.log('    (sin TOKEN_JUGADOR, skip)');
  const { status } = await post('/api/clases/crear', { cancha_id: 1, fecha: '2026-12-01', hora_inicio: '10:00:00', hora_fin: '11:00:00', categoria_target: 'B', precio_clase: 5000, deporte: 'Tenis' }, TOKEN_JUGADOR);
  assert(status === 403, `Esperaba 403 (solo profesores), recibí ${status}`);
});

await test('A.7 cancelar-clase sin token → 401', async () => {
  const { status } = await post('/api/clases/cancelar-clase', { clase_id: 1 }, null);
  assert(status === 401, `Esperaba 401, recibí ${status}`);
});

// ── C. Endpoints de torneos ─────────────────────────────────────────────────

console.log('\n── C. Endpoints de torneos ──────────────────────────────────');

await test('A.4 inscribir sin token → 401', async () => {
  const { status } = await post('/api/torneos/inscribir', { torneo_id: 1, modalidad: 'Single' }, null);
  assert(status === 401, `Esperaba 401, recibí ${status}`);
});

await test('A.4 inscribir con modalidad inválida → 400', async () => {
  if (!TOKEN_JUGADOR) return console.log('    (sin TOKEN_JUGADOR, skip)');
  const { status } = await post('/api/torneos/inscribir', { torneo_id: 1, modalidad: 'Invalido' }, TOKEN_JUGADOR);
  assert(status === 400, `Esperaba 400, recibí ${status}`);
});

await test('A.4 inscribir a torneo inexistente → 404', async () => {
  if (!TOKEN_JUGADOR) return console.log('    (sin TOKEN_JUGADOR, skip)');
  const { status } = await post('/api/torneos/inscribir', { torneo_id: 9999999, modalidad: 'Single' }, TOKEN_JUGADOR);
  assert(status === 404, `Esperaba 404, recibí ${status}`);
});

await test('A.5 cancelar inscripcion sin token → 401', async () => {
  const { status } = await post('/api/torneos/cancelar-inscripcion', { torneo_id: 1 }, null);
  assert(status === 401, `Esperaba 401, recibí ${status}`);
});

await test('A.5 cancelar inscripcion inexistente → 404', async () => {
  if (!TOKEN_JUGADOR) return console.log('    (sin TOKEN_JUGADOR, skip)');
  const { status } = await post('/api/torneos/cancelar-inscripcion', { torneo_id: 9999999 }, TOKEN_JUGADOR);
  assert(status === 404, `Esperaba 404, recibí ${status}`);
});

// ── D. Chat IA (G.7 - verificar que RLS filtra herramientas) ───────────────

console.log('\n── D. Chat IA ───────────────────────────────────────────────');

await test('Chat sin mensajes → 400', async () => {
  const res = await fetch(`${API}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [] }),
  });
  assert(res.status === 400, `Esperaba 400, recibí ${res.status}`);
});

await test('Chat con pregunta simple responde SSE', async () => {
  const res = await fetch(`${API}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: '¿Hola?' }] }),
  });
  assert(res.status === 200, `Esperaba 200, recibí ${res.status}`);
  assert(res.headers.get('content-type')?.includes('text/event-stream'), 'Respuesta no es SSE');
  // Leer el primer chunk para verificar que hay datos
  const reader = res.body.getReader();
  const { value } = await reader.read();
  assert(value && value.length > 0, 'Stream vacío');
  reader.cancel();
});

// ── Resumen ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Resultado: ${passed} pasados, ${failed} fallidos`);
if (failed > 0) process.exit(1);
