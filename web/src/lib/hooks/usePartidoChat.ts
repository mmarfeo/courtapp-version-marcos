import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export interface MensajeChat {
  id: number;
  partido_id: number;
  remitente_id: string;
  mensaje: string;
  enviado_at: string;
}

export interface PerfilUsuario {
  id: string;
  nombre: string;
  rol: 'Jugador' | 'Organizador' | 'SuperAdmin' | 'Profesor';
}

export function usePartidoChat(partidoId: number) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [perfiles, setPerfiles] = useState<Record<string, PerfilUsuario>>({});
  const [loading, setLoading] = useState(true);

  // 1. Cargar el historial inicial y suscribirse en tiempo real
  useEffect(() => {
    const fetchMensajes = async () => {
      const { data, error } = await supabase
        .from('mensajes_chat')
        .select('*')
        .eq('partido_id', partidoId)
        .order('enviado_at', { ascending: true });

      if (!error && data) {
        setMensajes(data as MensajeChat[]);
      }
      setLoading(false);
    };

    fetchMensajes();

    const channel = supabase
      .channel(`chat_partido_${partidoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes_chat',
          filter: `partido_id=eq.${partidoId}`
        },
        (payload) => {
          const nuevoMensaje = payload.new as MensajeChat;
          setMensajes((prev) => [...prev, nuevoMensaje]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [partidoId]);

  // 2. Cargar perfiles de usuarios de forma reactiva a medida que llegan mensajes
  useEffect(() => {
    const idsSinPerfil = mensajes
      .map((m) => m.remitente_id)
      // eslint-disable-next-line security/detect-object-injection
      .filter((id) => id && !perfiles[id]);

    const uniqueIds = Array.from(new Set(idsSinPerfil));
    if (uniqueIds.length === 0) return;

    let active = true;
    const fetchPerfiles = async () => {
      const { data, error } = await supabase
        .from('perfiles_usuarios')
        .select('id, nombre, rol')
        .in('id', uniqueIds);

      if (active && !error && data) {
        setPerfiles((prev) => {
          const updated = { ...prev };
          data.forEach((p) => {
            updated[p.id] = p as PerfilUsuario;
          });
          return updated;
        });
      }
    };

    fetchPerfiles();
    return () => {
      active = false;
    };
  }, [mensajes]);

  // Función para enviar mensaje
  const enviarMensaje = async (mensaje: string, remitenteId: string) => {
    if (!mensaje.trim()) return;

    const { error } = await supabase
      .from('mensajes_chat')
      .insert([
        {
          partido_id: partidoId,
          remitente_id: remitenteId,
          mensaje: mensaje.trim()
        }
      ]);

    if (error) {
      console.error('Error enviando mensaje:', error);
      throw error;
    }
  };

  return { mensajes, perfiles, loading, enviarMensaje };
}

