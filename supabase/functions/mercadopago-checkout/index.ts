import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { torneo_id, modalidad, usuario_id } = await req.json();

    // Validar headers y autenticación
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized user");

    // 1. Obtener la tarifa del torneo y datos del organizador
    const { data: torneoData, error: torneoError } = await supabaseClient
      .from('torneos')
      .select(`
        nombre_torneo,
        organizacion_id,
        organizaciones ( mp_access_token, mp_user_id ),
        tarifas_torneo ( precio_single, precio_dobles, precio_ambos )
      `)
      .eq('id', torneo_id)
      .single();

    if (torneoError || !torneoData) throw new Error("Tournament not found");

    // Determinar precio base según modalidad
    let precioBase = 0;
    const tarifas = torneoData.tarifas_torneo[0];
    if (modalidad === 'Single') precioBase = parseFloat(tarifas.precio_single);
    else if (modalidad === 'Dobles') precioBase = parseFloat(tarifas.precio_dobles);
    else if (modalidad === 'Ambos') precioBase = parseFloat(tarifas.precio_ambos);

    // 2. Extraer Comisión SaaS
    const platformFeeStr = Deno.env.get("PLATFORM_FEE_ARS");
    if (!platformFeeStr) throw new Error("CRITICAL: PLATFORM_FEE_ARS not configured");
    const platformFee = parseFloat(platformFeeStr);
    
    // El monto neto del club será el precio total menos el fee
    const montoNetoClub = precioBase - platformFee;

    // 3. Crear el registro "Pendiente" en inscripciones_torneo
    const { data: inscripcion, error: insertError } = await supabaseClient
      .from('inscripciones_torneo')
      .insert({
        torneo_id,
        usuario_id: user.id,
        modalidad,
        monto_total_pagado: precioBase,
        comision_plataforma: platformFee,
        monto_neto_club: montoNetoClub,
        estado_pago: 'Pendiente'
      })
      .select()
      .single();

    if (insertError) throw new Error("Error creating registration: " + insertError.message);

    // 4. Crear preferencia en Mercado Pago (Marketplace)
    const orgAccessToken = torneoData.organizaciones.mp_access_token;
    
    // Simulamos la llamada a la API de MP (En prod sería fetch a api.mercadopago.com/checkout/preferences)
    // El payload llevaría el application_fee apuntando a la cuenta plataforma
    const payloadMP = {
      items: [{
        title: `Inscripción Torneo: ${torneoData.nombre_torneo} (${modalidad})`,
        unit_price: precioBase,
        quantity: 1,
      }],
      marketplace_fee: platformFee, // Comisión retenida para la plataforma SaaS
      external_reference: inscripcion.id.toString(), // ID interno para el webhook
      notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
      back_urls: {
        success: `https://tu-saas.com/jugador/exito`,
        failure: `https://tu-saas.com/jugador/fallo`
      }
    };

    // Para la simulación, devolvemos un link falso y éxito
    console.log("Creando preferencia MP con:", payloadMP);

    return new Response(
      JSON.stringify({ 
        success: true, 
        init_point: "https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=SIMULATED_PREF_ID",
        inscripcion_id: inscripcion.id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
