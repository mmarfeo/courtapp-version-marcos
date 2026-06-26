import { createClient } from '@supabase/supabase-js';

if (typeof window !== 'undefined') {
  throw new Error('El cliente de Supabase Admin (Service Role) NO puede ser importado ni ejecutado en el frontend. Riesgo de fuga de credenciales.');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const getSupabaseAdmin = () => {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno (.env.local). Configúrala para crear usuarios.');
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
