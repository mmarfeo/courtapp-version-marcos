import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'courtup_chat_history_v1';
const MAX_LOCAL = 200;
const API_BASE = (process.env.EXPO_PUBLIC_API_URL || 'https://courtup-web.vercel.app').replace(/\/$/, '');

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function callHistoryApi(method: string, path: string, body?: object) {
  const token = await getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

function serializeMessages(msgs: ChatMessage[]): string {
  return JSON.stringify(msgs.map((m) => ({ ...m, timestamp: m.timestamp.toISOString() })));
}

function deserializeMessages(raw: string): ChatMessage[] {
  try {
    return JSON.parse(raw).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

export function useChatHistory() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [oldestId, setOldestId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Carga inicial: primero AsyncStorage (rápido), luego sincroniza con DB en segundo plano
  const loadHistory = useCallback(async () => {
    // 1. Cargar desde AsyncStorage
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const local = deserializeMessages(raw);
        setMessages(local);
        if (local.length > 0) setOldestId(local[0].id);
      }
    } catch { /* ignore */ }

    // 2. Sincronizar con Supabase en segundo plano
    setSyncing(true);
    const result = await callHistoryApi('GET', '/api/ai/chat-history?limit=50');
    setSyncing(false);

    if (result?.messages && result.messages.length > 0) {
      const remote: ChatMessage[] = result.messages.map((m: any) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.created_at),
      }));
      setMessages(remote);
      setHasMore(remote.length === 50);
      setOldestId(remote[0]?.id ?? null);
      // Actualizar caché local con los datos frescos de la DB
      try {
        await AsyncStorage.setItem(STORAGE_KEY, serializeMessages(remote.slice(-MAX_LOCAL)));
      } catch { /* ignore */ }
    }
  }, []);

  // Guardar un mensaje nuevo
  const saveMessage = useCallback(async (role: 'user' | 'assistant', content: string): Promise<ChatMessage> => {
    const tempId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const msg: ChatMessage = { id: tempId, role, content, timestamp: new Date() };

    // Actualizar estado local inmediatamente
    setMessages((prev) => {
      const updated = [...prev, msg];
      // Persistir en AsyncStorage (sin await, en background)
      AsyncStorage.setItem(STORAGE_KEY, serializeMessages(updated.slice(-MAX_LOCAL))).catch(() => {});
      return updated;
    });

    // Guardar en DB en background (sin bloquear la UI)
    callHistoryApi('POST', '/api/ai/chat-history', { role, content }).then((res) => {
      if (res?.id) {
        // Reemplazar el id temporal por el id real de la DB
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, id: res.id } : m))
        );
      }
    });

    return msg;
  }, []);

  // Actualizar el contenido del último mensaje del asistente (streaming)
  const updateLastAssistantMessage = useCallback((content: string) => {
    setMessages((prev) => {
      const updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].role === 'assistant') {
          updated[i] = { ...updated[i], content };
          break;
        }
      }
      return updated;
    });
  }, []);

  // Cargar mensajes más antiguos (paginación al scrollear arriba)
  const loadMore = useCallback(async () => {
    if (!hasMore || !oldestId) return;
    const result = await callHistoryApi('GET', `/api/ai/chat-history?limit=50&before=${oldestId}`);
    if (result?.messages && result.messages.length > 0) {
      const older: ChatMessage[] = result.messages.map((m: any) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.created_at),
      }));
      setMessages((prev) => [...older, ...prev]);
      setHasMore(older.length === 50);
      setOldestId(older[0]?.id ?? null);
    } else {
      setHasMore(false);
    }
  }, [hasMore, oldestId]);

  // Limpiar todo el historial
  const clearHistory = useCallback(async () => {
    setMessages([]);
    setHasMore(false);
    setOldestId(null);
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    await callHistoryApi('DELETE', '/api/ai/chat-history');
  }, []);

  return { messages, setMessages, hasMore, syncing, loadHistory, saveMessage, updateLastAssistantMessage, loadMore, clearHistory };
}
