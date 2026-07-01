import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Necesitás iniciar sesión para inscribirte.' }, { status: 401 });
    }

    const { torneo_id, modalidad, pareja_email } = await req.json();
    if (!torneo_id || !modalidad) {
      return NextResponse.json({ error: 'Se requieren torneo_id y modalidad.' }, { status: 400 });
    }

    if (!['Single', 'Dobles', 'Ambos'].includes(modalidad)) {
      return NextResponse.json({ error: 'Modalidad inválida. Debe ser Single, Dobles o Ambos.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Sesión inválida. Iniciá sesión de nuevo.' }, { status: 401 });
    }

    const { data: torneo, error: torneoError } = await supabase
      .from('torneos')
      .select('id, nombre_torneo, fase_actual, activo, deporte, categoria_torneo')
      .eq('id', torneo_id)
      .single();

    if (torneoError || !torneo) {
      return NextResponse.json({ error: 'Torneo no encontrado.' }, { status: 404 });
    }

    if (!torneo.activo || torneo.fase_actual !== 'Inscripcion') {
      return NextResponse.json({ error: 'El torneo no está abierto para inscripciones.' }, { status: 409 });
    }

    const { data: existing } = await supabase
      .from('inscripciones_torneo')
      .select('id')
      .eq('torneo_id', torneo_id)
      .eq('usuario_id', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Ya estás inscripto en este torneo.' }, { status: 409 });
    }

    const { data: tarifa, error: tarifaError } = await supabase
      .from('tarifas_torneo')
      .select('precio_single, precio_dobles, precio_ambos')
      .eq('torneo_id', torneo_id)
      .single();

    if (tarifaError || !tarifa) {
      return NextResponse.json({ error: 'No se encontró la tarifa del torneo.' }, { status: 404 });
    }

    const precioMap: Record<string, number> = {
      Single: tarifa.precio_single,
      Dobles: tarifa.precio_dobles,
      Ambos: tarifa.precio_ambos,
    };
    const monto_total = precioMap[modalidad];
    const feeDecimal = parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || '10') / 100;
    const comision_plataforma = monto_total * feeDecimal;
    const monto_neto_club = monto_total - comision_plataforma;

    let pareja_usuario_id: string | null = null;
    if (modalidad !== 'Single' && pareja_email) {
      const { data: pareja } = await supabase
        .from('perfiles_usuarios')
        .select('id')
        .eq('email', pareja_email)
        .maybeSingle();
      pareja_usuario_id = pareja?.id ?? null;
    }

    const { error: insertError } = await supabase.from('inscripciones_torneo').insert({
      torneo_id,
      usuario_id: user.id,
      modalidad,
      monto_total_pagado: monto_total,
      comision_plataforma,
      monto_neto_club,
      estado_pago: 'Aprobado',
      fecha_pago: new Date().toISOString(),
      pareja_usuario_id,
      pareja_email: pareja_email ?? null,
    });

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Ya estás inscripto en este torneo.' }, { status: 409 });
      }
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      mensaje: `Inscripción confirmada en ${torneo.nombre_torneo} (${modalidad}). Monto: $${monto_total}.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno.' }, { status: 500 });
  }
}
