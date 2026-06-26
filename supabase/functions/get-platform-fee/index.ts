import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Validar el token de autorización enviado por el cliente
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Initialize Supabase Client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // 2. Obtener la sesión del usuario para validaciones adicionales
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // 3. Obtener PLATFORM_FEE_ARS desde las variables de entorno / Vault
    const platformFeeStr = Deno.env.get("PLATFORM_FEE_ARS");
    
    if (!platformFeeStr) {
      // Abortar si la comisión no está definida en la infraestructura
      throw new Error("CRITICAL ERROR: PLATFORM_FEE_ARS variable not configured in the environment.");
    }

    const platformFee = parseFloat(platformFeeStr);

    if (isNaN(platformFee)) {
      throw new Error("CRITICAL ERROR: PLATFORM_FEE_ARS is not a valid number.");
    }

    // 4. Responder con la tarifa vigente
    return new Response(
      JSON.stringify({ 
        platform_fee_ars: platformFee,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
