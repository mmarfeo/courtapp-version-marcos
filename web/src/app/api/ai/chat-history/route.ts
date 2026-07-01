import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function getUserId(token: string): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: { user } } = await supabase.auth.getUser(token);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// GET /api/ai/chat-history?limit=50&before=<uuid>
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200);
  const before = searchParams.get('before');

  const supabase = getSupabaseAdmin();

  let q = supabase
    .from('chat_ia_historial')
    .select('id, role, content, created_at')
    .eq('usuario_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    // Cursor-based pagination: messages older than 'before' id
    const { data: pivot } = await supabase
      .from('chat_ia_historial')
      .select('created_at')
      .eq('id', before)
      .single();
    if (pivot) q = q.lt('created_at', pivot.created_at) as typeof q;
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return in ascending order for rendering
  return NextResponse.json({ messages: (data ?? []).reverse() });
}

// POST /api/ai/chat-history  { role, content }
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });

  const body = await req.json();
  const { role, content } = body;

  if (!role || !content || !['user', 'assistant'].includes(role)) {
    return NextResponse.json({ error: 'role y content son requeridos.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('chat_ia_historial')
    .insert({ usuario_id: userId, role, content })
    .select('id, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, id: data.id, created_at: data.created_at });
}

// DELETE /api/ai/chat-history  — borra todo el historial del usuario
export async function DELETE(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('chat_ia_historial')
    .delete()
    .eq('usuario_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
