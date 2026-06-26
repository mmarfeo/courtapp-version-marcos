const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function addClubPolicies() {
  try {
    await client.connect();
    
    const sql = `
      -- Permite insertar organizaciones (para el SuperAdmin o localmente)
      CREATE POLICY "Permitir insert organizaciones" ON organizaciones FOR INSERT WITH CHECK (true);
    `;
    
    await client.query(sql);
    console.log("¡Política RLS para organizaciones añadida con éxito!");
  } catch (err) {
    console.error("Error o las políticas ya existían:", err.message);
  } finally {
    await client.end();
  }
}

addClubPolicies();
