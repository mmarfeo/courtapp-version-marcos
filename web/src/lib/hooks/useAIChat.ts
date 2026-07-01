'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type AgentStatus =
  | { type: 'idle' }
  | { type: 'thinking' }
  | { type: 'querying'; tool: string }
  | { type: 'error'; message: string };

const TOOL_LABELS: Record<string, string> = {
  consultar_canchas: 'Consultando canchas...',
  consultar_clases: 'Consultando clases disponibles...',
  consultar_partidos: 'Consultando partidos...',
  consultar_reservas: 'Consultando reservas...',
  consultar_profesores: 'Consultando profesores...',
  consultar_mis_clases: 'Consultando tus clases...',
  reservar_clase: 'Reservando clase...',
  buscar_canchas_disponibles: 'Buscando canchas disponibles...',
  crear_reserva_cancha: 'Creando tu reserva...',
  cancelar_reserva_cancha: 'Cancelando reserva...',
  listar_mis_reservas_cancha: 'Cargando tus reservas...',
  buscar_torneos: 'Buscando torneos...',
  inscribir_torneo: 'Inscribiéndote...',
};

const STORAGE_KEY = 'courtup_chat_messages';

function loadLocalMessages(): AIChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    // Migrar de sessionStorage a localStorage si hay mensajes viejos
    const old = sessionStorage.getItem(STORAGE_KEY);
    if (old) {
      localStorage.setItem(STORAGE_KEY, old);
      sessionStorage.removeItem(STORAGE_KEY);
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map((m: AIChatMessage) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function saveLocalMessages(msgs: AIChatMessage[]) {
  if (typeof window === 'undefined') return;
  try {
    // Guardar máximo 200 mensajes en localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-200)));
  } catch { /* quota exceeded */ }
}

async function saveToDb(role: string, content: string, token: string): Promise<string | null> {
  try {
    const res = await fetch('/api/ai/chat-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role, content }),
    });
    const data = await res.json();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

async function loadFromDb(token: string, before?: string): Promise<AIChatMessage[]> {
  try {
    const url = before
      ? `/api/ai/chat-history?limit=50&before=${before}`
      : '/api/ai/chat-history?limit=50';
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const { messages } = await res.json();
    return (messages ?? []).map((m: any) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: new Date(m.created_at),
    }));
  } catch {
    return [];
  }
}

export function useAIChat() {
  const [messages, setMessages] = useState<AIChatMessage[]>(loadLocalMessages);
  const [status, setStatus] = useState<AgentStatus>({ type: 'idle' });
  const [syncing, setSyncing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const oldestIdRef = useRef<string | null>(null);

  const isLoading = status.type !== 'idle' && status.type !== 'error';

  // Persistir en localStorage en cada cambio
  useEffect(() => {
    saveLocalMessages(messages);
  }, [messages]);

  // Sincronizar con DB al montar (en background)
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      setSyncing(true);
      const remote = await loadFromDb(session.access_token);
      setSyncing(false);
      if (remote.length > 0) {
        setMessages(remote);
        setHasMore(remote.length === 50);
        oldestIdRef.current = remote[0]?.id ?? null;
      }
    })();
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || !oldestIdRef.current) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    setSyncing(true);
    const older = await loadFromDb(session.access_token, oldestIdRef.current);
    setSyncing(false);
    if (older.length === 0) { setHasMore(false); return; }
    setHasMore(older.length === 50);
    oldestIdRef.current = older[0]?.id ?? null;
    setMessages(prev => [...older, ...prev]);
  }, [hasMore]);

  const sendMessage = useCallback(
    async (userText: string) => {
      if (!userText.trim() || isLoading) return;

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const userMessage: AIChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: userText.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setStatus({ type: 'thinking' });

      // Guardar mensaje del usuario en DB (background)
      if (token) saveToDb('user', userText.trim(), token);

      const assistantId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', timestamp: new Date() },
      ]);

      abortControllerRef.current = new AbortController();

      try {
        const apiMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMessages, userToken: token }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `Error ${response.status}`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              let data = '';
              try { data = JSON.parse(line.slice(6)); } catch { continue; }

              if (currentEvent === 'text') {
                accumulated += data;
                setMessages((prev) =>
                  prev.map((m) => m.id === assistantId ? { ...m, content: accumulated } : m)
                );
              } else if (currentEvent === 'tool_start') {
                setStatus({ type: 'querying', tool: TOOL_LABELS[data] || data });
              } else if (currentEvent === 'tool_end') {
                setStatus({ type: 'thinking' });
              } else if (currentEvent === 'done') {
                setStatus({ type: 'idle' });
              } else if (currentEvent === 'error') {
                throw new Error(data);
              }
              currentEvent = '';
            }
          }
        }

        // Guardar respuesta del asistente en DB y asignar id real
        if (token && accumulated) {
          const dbId = await saveToDb('assistant', accumulated, token);
          if (dbId) {
            setMessages((prev) =>
              prev.map((m) => m.id === assistantId ? { ...m, id: dbId } : m)
            );
          }
        }

        setStatus({ type: 'idle' });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          setStatus({ type: 'idle' });
          return;
        }
        const msg = err instanceof Error ? err.message : 'Error al conectar con el asistente';
        setStatus({ type: 'error', message: msg });
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: `⚠️ ${msg}` } : m)
        );
      }
    },
    [messages, isLoading]
  );

  const clearMessages = useCallback(async () => {
    abortControllerRef.current?.abort();
    localStorage.removeItem(STORAGE_KEY);
    setMessages([]);
    setStatus({ type: 'idle' });
    // Borrar también en DB
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      fetch('/api/ai/chat-history', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});
    }
  }, []);

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setStatus({ type: 'idle' });
  }, []);

  return { messages, status, isLoading, syncing, hasMore, loadMore, sendMessage, clearMessages, stopGeneration };
}
