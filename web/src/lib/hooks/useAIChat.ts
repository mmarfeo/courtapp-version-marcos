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
};

const STORAGE_KEY = 'courtup_chat_messages';

function loadMessages(): AIChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((m: AIChatMessage) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function saveMessages(msgs: AIChatMessage[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
  } catch {
    // storage quota exceeded — ignore
  }
}

export function useAIChat() {
  const [messages, setMessages] = useState<AIChatMessage[]>(loadMessages);
  const [status, setStatus] = useState<AgentStatus>({ type: 'idle' });
  const abortControllerRef = useRef<AbortController | null>(null);

  const isLoading = status.type !== 'idle' && status.type !== 'error';

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  const sendMessage = useCallback(
    async (userText: string) => {
      if (!userText.trim() || isLoading) return;

      const userMessage: AIChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: userText.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setStatus({ type: 'thinking' });

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

        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMessages, userToken: session?.access_token }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `Error ${response.status}`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              // next line has the data — handled below via pairing
              continue;
            }
            if (!line.startsWith('data: ')) continue;

            // Find the event type from the preceding lines
            const lineIdx = lines.indexOf(line);
            const eventLine = lines[lineIdx - 1] ?? '';
            const eventType = eventLine.startsWith('event: ')
              ? eventLine.slice(7).trim()
              : 'text';

            let data = '';
            try {
              data = JSON.parse(line.slice(6));
            } catch {
              continue;
            }

            if (eventType === 'text') {
              accumulated += data;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: accumulated } : m
                )
              );
            } else if (eventType === 'tool_start') {
              setStatus({ type: 'querying', tool: TOOL_LABELS[data] || data });
            } else if (eventType === 'tool_end') {
              setStatus({ type: 'thinking' });
            } else if (eventType === 'done') {
              setStatus({ type: 'idle' });
            } else if (eventType === 'error') {
              throw new Error(data);
            }
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
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: `⚠️ ${msg}` } : m
          )
        );
      }
    },
    [messages, isLoading]
  );

  const clearMessages = useCallback(() => {
    abortControllerRef.current?.abort();
    sessionStorage.removeItem(STORAGE_KEY);
    setMessages([]);
    setStatus({ type: 'idle' });
  }, []);

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setStatus({ type: 'idle' });
  }, []);

  return { messages, status, isLoading, sendMessage, clearMessages, stopGeneration };
}
