const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function addPolicies() {
  try {
    await client.connect();
    
    const sql = `
      -- Permite lectura de torneos a todos
      DROP POLICY IF EXISTS "Permitir lectura publica torneos" ON torneos;
      CREATE POLICY "Permitir lectura publica torneos" ON torneos FOR SELECT USING (true);
      
      -- Permite insertar torneos (para desarrollo local)
      DROP POLICY IF EXISTS "Permitir insert torneos" ON torneos;
      CREATE POLICY "Permitir insert torneos" ON torneos FOR INSERT WITH CHECK (true);
      
      -- Permite actualizar torneos (para desarrollo local)
      DROP POLICY IF EXISTS "Permitir update torneos" ON torneos;
      CREATE POLICY "Permitir update torneos" ON torneos FOR UPDATE USING (true) WITH CHECK (true);
      
      -- Permite lectura de tarifas
      DROP POLICY IF EXISTS "Permitir lectura publica tarifas" ON tarifas_torneo;
      CREATE POLICY "Permitir lectura publica tarifas" ON tarifas_torneo FOR SELECT USING (true);
      
      -- Permite insertar tarifas
      DROP POLICY IF EXISTS "Permitir insert tarifas" ON tarifas_torneo;
      CREATE POLICY "Permitir insert tarifas" ON tarifas_torneo FOR INSERT WITH CHECK (true);
      
      -- Permite actualizar tarifas (para desarrollo local)
      DROP POLICY IF EXISTS "Permitir update tarifas" ON tarifas_torneo;
      CREATE POLICY "Permitir update tarifas" ON tarifas_torneo FOR UPDATE USING (true) WITH CHECK (true);

      -- Permite lectura de partidos a todos
      DROP POLICY IF EXISTS "Permitir lectura publica partidos" ON partidos;
      CREATE POLICY "Permitir lectura publica partidos" ON partidos FOR SELECT USING (true);
      
      -- Permite lectura de perfiles de usuario a todos (para ver nombres en partidos/brackets)
      DROP POLICY IF EXISTS "Permitir lectura publica perfiles" ON perfiles_usuarios;
      CREATE POLICY "Permitir lectura publica perfiles" ON perfiles_usuarios FOR SELECT USING (true);
    `;
    
    await client.query(sql);
    console.log("¡Políticas RLS para torneos añadidas con éxito!");
  } catch (err) {
    // Ignore errors if policy already exists
    console.error("Error o las políticas ya existían:", err.message);
  } finally {
    await client.end();
  }
}

addPolicies();
