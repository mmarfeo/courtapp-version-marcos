import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Consultar el total adeudado por cada profesor
    const { data: deudas, error: deudasError } = await supabaseClient
      .rpc('get_profesores_deuda_semanal');

    // Alternativamente, si no tenemos RPC, podemos hacerlo directamente:
    const { data: alquileresPendientes, error } = await supabaseClient
      .from('alquileres_cancha')
      .select('usuario_id, monto_total, perfiles_usuarios!inner(rol)')
      .eq('estado_pago', 'Pendiente')
      .eq('perfiles_usuarios.rol', 'Profesor');

    if (error) throw error;

    // Agrupar por profesor y sumar monto
    const deudasMap: Record<string, number> = {};
    for (const alquiler of alquileresPendientes || []) {
      if (!deudasMap[alquiler.usuario_id]) deudasMap[alquiler.usuario_id] = 0;
      deudasMap[alquiler.usuario_id] += Number(alquiler.monto_total);
    }

    // Insertar notificaciones
    const notificacionesToInsert = Object.keys(deudasMap).map(usuario_id => ({
      usuario_id,
      titulo: 'Resumen Semanal de Alquileres',
      cuerpo: `Tienes un saldo pendiente de pago de $${deudasMap[usuario_id]} por las canchas reservadas esta semana.`,
      estado: 'Pendiente'
    }));

    if (notificacionesToInsert.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('notificaciones_pendientes')
        .insert(notificacionesToInsert);
        
      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({ success: true, count: notificacionesToInsert.length }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    })
  }
})
