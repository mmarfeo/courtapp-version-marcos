import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Necesitás iniciar sesión para reservar.' }, { status: 401 });
    }

    const { clase_id } = await req.json();
    if (!clase_id) {
      return NextResponse.json({ error: 'Se requiere clase_id.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Verify user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Sesión inválida. Iniciá sesión de nuevo.' }, { status: 401 });
    }

    // Get class details
    const { data: clase, error: claseError } = await supabase
      .from('clases_disponibles')
      .select('id, precio_clase, activa, deporte, fecha, hora_inicio, profesor:perfiles_usuarios!clases_disponibles_profesor_id_fkey(nombre)')
      .eq('id', clase_id)
      .eq('activa', true)
      .single();

    if (claseError || !clase) {
      return NextResponse.json({ error: 'Clase no encontrada o no disponible.' }, { status: 404 });
    }

    // Check duplicate reservation
    const { data: existing } = await supabase
      .from('reservas_clases')
      .select('id')
      .eq('clase_id', clase_id)
      .eq('alumno_id', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Ya tenés una reserva para esta clase.' }, { status: 409 });
    }

    // Check capacity
    const { count } = await supabase
      .from('reservas_clases')
      .select('*', { count: 'exact', head: true })
      .eq('clase_id', clase_id);

    const claseData = clase as any;
    if (count !== null && claseData.cupo_maximo && count >= claseData.cupo_maximo) {
      return NextResponse.json({ error: 'La clase ya no tiene cupos disponibles.' }, { status: 409 });
    }

    // Insert reservation
    const { error: insertError } = await supabase.from('reservas_clases').insert({
      clase_id,
      alumno_id: user.id,
      monto_total_pagado: claseData.precio_clase,
      comision_plataforma: 1000.00,
      monto_neto_club: claseData.precio_clase - 1000.00,
      estado_pago: 'Aprobado',
      fecha_pago: new Date().toISOString(),
    });

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Ya tenés una reserva para esta clase.' }, { status: 409 });
      }
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      mensaje: `Reserva confirmada para la clase del ${claseData.fecha} a las ${claseData.hora_inicio.substring(0, 5)} hs.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno.' }, { status: 500 });
  }
}
