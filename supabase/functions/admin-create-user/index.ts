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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // 1. Verificar autenticación del emisor
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "No autorizado: Faltan credenciales" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401
      });
    }

    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "No autorizado: Token inválido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401
      });
    }

    // Cliente Admin: Para crear el usuario en Auth (bypass RLS) y verificar roles
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 2. Verificar rol de administrador o organizador del emisor
    const { data: callerProfile } = await supabaseAdmin
      .from('perfiles_usuarios')
      .select('rol, roles')
      .eq('id', user.id)
      .single();

    const isSuperAdmin = callerProfile?.rol === 'SuperAdmin' || callerProfile?.roles?.includes('SuperAdmin');
    const isOrganizador = callerProfile?.rol === 'Organizador' || callerProfile?.roles?.includes('Organizador');

    if (!isSuperAdmin && !isOrganizador) {
      return new Response(JSON.stringify({ success: false, error: "Acceso denegado: Se requiere rol de SuperAdmin u Organizador" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403
      });
    }

    const body = await req.json();
    const { email, password, nombre, organizacion_ids } = body;

    // Si viene `roles` (array) lo usamos. Si no, retrocompatible con `rol` (string)
    let rolesArray: string[] = [];
    let initialRol = 'Jugador';

    if (body.roles && Array.isArray(body.roles) && body.roles.length > 0) {
      rolesArray = body.roles;
      initialRol = body.roles[0];
    } else if (body.rol) {
      rolesArray = [body.rol];
      initialRol = body.rol;
    } else {
      rolesArray = ['Jugador'];
      initialRol = 'Jugador';
    }

    // Nos aseguramos de incluir 'Jugador' en la lista de roles del usuario
    if (!rolesArray.includes('Jugador')) {
      rolesArray.push('Jugador');
    }

    let newUserId: string = "";
    let isNewUser = false;

    // Buscar si el usuario ya existe en perfiles_usuarios
    const { data: existingProfile, error: searchError } = await supabaseAdmin
      .from('perfiles_usuarios')
      .select('id, roles')
      .eq('email', email)
      .maybeSingle();

    if (searchError) {
      console.error("Search profile error:", searchError);
    }

    if (existingProfile) {
      newUserId = existingProfile.id;
      // Combinar roles existentes con los nuevos roles solicitados
      const currentRoles = existingProfile.roles || [];
      const updatedRoles = Array.from(new Set([...currentRoles, ...rolesArray]));
      
      const { error: profileUpdateError } = await supabaseAdmin
        .from('perfiles_usuarios')
        .update({ 
          roles: updatedRoles,
          nombre: nombre // Actualiza nombre por si acaso
        })
        .eq('id', newUserId);

      if (profileUpdateError) {
        throw new Error(`Error actualizando roles del perfil existente: ${profileUpdateError.message}`);
      }
    } else {
      isNewUser = true;
      // Crear cuenta en Supabase Auth
      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { full_name: nombre }
      });

      if (createError) {
        if (createError.message && (createError.message.includes('already been registered') || createError.message.includes('already exists'))) {
          throw new Error('El correo electrónico ingresado ya está registrado.');
        }
        throw new Error(`Error al crear usuario en Auth: ${createError.message || JSON.stringify(createError)}`);
      }

      newUserId = authData.user.id;

      // El trigger on_auth_user_created crea el perfil. Ahora lo actualizamos con los roles y rol activo inicial.
      const { error: profileError } = await supabaseAdmin
        .from('perfiles_usuarios')
        .update({ 
          rol: initialRol, 
          roles: rolesArray,
          nombre: nombre 
        })
        .eq('id', newUserId);

      if (profileError) {
        throw new Error(`Error actualizando perfil del nuevo usuario: ${profileError.message}`);
      }
    }

    // Vincular a las organizaciones si corresponde
    const tieneStaffRol = rolesArray.includes('Profesor') || rolesArray.includes('Organizador');
    if (organizacion_ids && Array.isArray(organizacion_ids) && tieneStaffRol) {
      for (const org_id of organizacion_ids) {
        // Verificar si ya está vinculado a este club para no duplicar registro en miembros_organizacion
        const { data: existingMember } = await supabaseAdmin
          .from('miembros_organizacion')
          .select('id')
          .eq('organizacion_id', org_id)
          .eq('usuario_id', newUserId)
          .maybeSingle();

        if (!existingMember) {
          const { error: orgError } = await supabaseAdmin
            .from('miembros_organizacion')
            .insert({
              organizacion_id: org_id,
              usuario_id: newUserId
            });

          if (orgError) throw new Error(`Error vinculando al club: ${orgError.message}`);
        }
      }
    }

    // Enviar correo de bienvenida con las credenciales solo si es nuevo usuario
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:3000";
    const senderEmail = Deno.env.get("SENDER_EMAIL") ?? "onboarding@resend.dev";

    // Roles legibles para el correo (ej: "Organizador y Profesor")
    const rolesFiltrados = rolesArray.filter(r => r !== 'Jugador');
    const rolesParaMostrar = rolesFiltrados.length > 0 ? rolesFiltrados.join(' y ') : 'Miembro';

    if (isNewUser) {
      if (resendApiKey) {
        try {
          console.log(`Enviando email de bienvenida a ${email}...`);
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
              from: `CourtUp <${senderEmail}>`,
              to: [email],
              subject: "¡Bienvenido a CourtUp! - Tus Credenciales de Acceso",
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
                  <h2 style="color: #4f46e5; margin-bottom: 20px;">¡Hola, ${nombre}!</h2>
                  <p>Te damos la bienvenida al staff de <strong>CourtUp</strong> como <strong>${rolesParaMostrar}</strong>.</p>
                  <p>Se ha creado tu cuenta con éxito. A continuación encontrarás tus credenciales temporales para iniciar sesión:</p>
                  
                  <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0; font-family: monospace; border: 1px solid #e2e8f0;">
                    <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                    <p style="margin: 5px 0;"><strong>Contraseña Temporal:</strong> ${password}</p>
                  </div>

                  <p>Por favor, ingresa al siguiente enlace para iniciar sesión y actualizar tu contraseña:</p>
                  <p style="text-align: center; margin: 30px 0;">
                    <a href="${siteUrl}/login" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Iniciar Sesión</a>
                  </p>
                  
                  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                  <p style="font-size: 12px; color: #64748b; text-align: center;">Este es un correo automático. Por favor no lo respondas.</p>
                </div>
              `
            })
          });

          if (!emailRes.ok) {
            const errText = await emailRes.text();
            console.error(`Error al enviar email con Resend: ${errText}`);
          } else {
            console.log(`Email de bienvenida enviado con éxito a ${email}`);
          }
        } catch (err) {
          console.error("Error inesperado al enviar email con Resend:", err);
        }
      } else {
        console.log("\n========================================================");
        console.log(" MOCK EMAIL (No se configuró RESEND_API_KEY)");
        console.log(` Destinatario: ${email}`);
        console.log(` Nombre: ${nombre}`);
        console.log(` Roles: ${rolesArray.join(', ')}`);
        console.log(` Contraseña: ${password}`);
        console.log(` Enlace de Login: ${siteUrl}/login`);
        console.log("========================================================\n");
      }
    } else {
      console.log(`Usuario existente ${email} vinculado con éxito sin enviar email.`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Usuario creado, vinculado y notificado exitosamente",
      user_id: newUserId
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
