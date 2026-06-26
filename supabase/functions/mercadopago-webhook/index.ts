import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || url.searchParams.get("topic");
    const id = url.searchParams.get("id") || url.searchParams.get("data.id");

    if (!id) {
      return new Response("Missing ID", { status: 400 });
    }

    // Inicializar Supabase usando Service Role (para bypassear RLS al confirmar pago)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Simulación: Consultar estado real del pago en MP usando el ID recibido
    // const paymentData = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {...})
    
    // Para esta simulación, asumimos que el pago fue aprobado
    // Extraemos la external_reference que Mercado Pago nos devuelve (nuestro ID de inscripciones_torneo)
    const external_reference = "1"; // Simulado
    const status = "approved"; // Simulado

    if (status === "approved") {
      // 1. Actualizar estado de la inscripción
      const { data, error } = await supabaseAdmin
        .from('inscripciones_torneo')
        .update({
          estado_pago: 'Aprobado',
          referencia_pago_externo: id.toString(),
          fecha_pago: new Date().toISOString()
        })
        .eq('id', external_reference)
        .select()
        .single();

      if (error) {
        console.error("Error al actualizar inscripción:", error);
        throw error;
      }

      console.log(`Pago aprobado para inscripción ID: ${external_reference}. Comisión persistida históricamente: $${data.comision_plataforma}`);
    }

    return new Response("Webhook OK", { status: 200 });

  } catch (error) {
    console.error("Webhook Error:", error.message);
    return new Response(`Webhook Error: ${error.message}`, { status: 500 });
  }
});
