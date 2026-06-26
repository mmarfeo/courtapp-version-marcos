import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email('Formato de correo electrónico inválido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.').optional().or(z.literal('')),
  nombre: z.string().min(1, 'El nombre completo es requerido.'),
  organizacion_ids: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
  rol: z.string().optional()
});

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();
    
    const parseResult = createUserSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ 
        success: false, 
        error: parseResult.error.errors.map(e => e.message).join(' ') 
      }, { status: 400 });
    }

    const { email, password, nombre, organizacion_ids, roles, rol } = parseResult.data;

    let rolesArray: string[] = [];
    let initialRol = 'Jugador';

    if (roles && roles.length > 0) {
      rolesArray = roles;
      initialRol = roles[0];
    } else if (rol) {
      rolesArray = [rol];
      initialRol = rol;
    } else {
      rolesArray = ['Jugador'];
      initialRol = 'Jugador';
    }

    if (!rolesArray.includes('Jugador')) {
      rolesArray.push('Jugador');
    }

    let newUserId = "";
    let isNewUser = false;

    // Search if profile exists
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
      const currentRoles = existingProfile.roles || [];
      const updatedRoles = Array.from(new Set([...currentRoles, ...rolesArray]));
      
      const { error: profileUpdateError } = await supabaseAdmin
        .from('perfiles_usuarios')
        .update({ 
          roles: updatedRoles,
          nombre: nombre 
        })
        .eq('id', newUserId);

      if (profileUpdateError) throw new Error(`Error actualizando roles: ${profileUpdateError.message}`);
    } else {
      isNewUser = true;
      // Create user in Auth
      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { 
          full_name: nombre,
          force_password_reset: true 
        }
      });

      if (createError) {
        if (createError.message && (createError.message.includes('already been registered') || createError.message.includes('already exists'))) {
          throw new Error('El correo electrónico ingresado ya está registrado.');
        }
        throw new Error(`Error al crear usuario en Auth: ${createError.message}`);
      }

      newUserId = authData.user.id;

      // Update profile created by trigger
      const { error: profileError } = await supabaseAdmin
        .from('perfiles_usuarios')
        .update({ 
          rol: initialRol, 
          roles: rolesArray,
          nombre: nombre,
          requiere_cambio_password: true
        })
        .eq('id', newUserId);

      if (profileError) throw new Error(`Error actualizando perfil: ${profileError.message}`);
    }

    // Link organizations
    const tieneStaffRol = rolesArray.includes('Profesor') || rolesArray.includes('Organizador');
    if (organizacion_ids && Array.isArray(organizacion_ids) && tieneStaffRol) {
      for (const org_id of organizacion_ids) {
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

    // Return success
    return NextResponse.json({ 
      success: true, 
      message: "Usuario creado y vinculado exitosamente.",
      user_id: newUserId
    });

  } catch (error: any) {
    console.error("API create user error:", error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 200 });
  }
}
