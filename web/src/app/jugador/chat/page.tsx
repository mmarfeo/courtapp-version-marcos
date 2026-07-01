'use client';

import { useState, useRef, useEffect, useCallback, Fragment } from 'react';
import { Sparkles, Trash2, Send, Loader2, ChevronUp, Zap, Trophy, Calendar, Bookmark } from 'lucide-react';
import { useAIChat, type AIChatMessage } from '@/lib/hooks/useAIChat';

const QUICK_ACTIONS = [
  { label: 'Reservar cancha hoy', icon: Zap, msg: 'Quiero reservar una cancha para hoy' },
  { label: 'Mis próximas clases', icon: Calendar, msg: '¿Cuáles son mis próximas clases?' },
  { label: 'Torneos abiertos', icon: Trophy, msg: 'Mostrame los torneos abiertos para inscribirme' },
  { label: 'Mis reservas', icon: Bookmark, msg: 'Mostrá mis reservas de canchas' },
];

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Hoy';
  if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
  return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

type ListItem =
  | { type: 'separator'; key: string; label: string }
  | { type: 'message'; key: string; msg: AIChatMessage };

function buildListItems(messages: AIChatMessage[]): ListItem[] {
  const items: ListItem[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const dateStr = msg.timestamp.toDateString();
    if (dateStr !== lastDate) {
      lastDate = dateStr;
      items.push({ type: 'separator', key: `sep_${dateStr}_${msg.id}`, label: formatDateSeparator(msg.timestamp) });
    }
    items.push({ type: 'message', key: msg.id, msg });
  }
  return items;
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-0.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] opacity-60"
          style={{ animation: `chatDot 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </span>
  );
}

export default function JugadorChatPage() {
  const { messages, status, isLoading, syncing, hasMore, loadMore, sendMessage, clearMessages } = useAIChat();
  const [input, setInput] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const toolStatus = status.type === 'querying' ? status.tool : null;
  const isThinking = status.type === 'thinking';

  const scrollToBottom = useCallback((smooth = true) => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }, 50);
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await sendMessage(text);
    scrollToBottom();
  }, [input, isLoading, sendMessage, scrollToBottom]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handleQuickAction = (msg: string) => {
    if (isLoading) return;
    sendMessage(msg);
    scrollToBottom();
  };

  const handleClear = async () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    setConfirmClear(false);
    await clearMessages();
  };

  const listItems = buildListItems(messages);

  return (
    <>
      <style>{`
        @keyframes chatDot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div className="flex flex-col" style={{ height: '100vh' }}>

        {/* Header estilo WhatsApp */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)] shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0 shadow-md shadow-[var(--primary)]/30">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--foreground)] leading-tight">Asistente CourtUp</p>
              <p className="text-xs text-[var(--text-muted)] leading-tight">
                {syncing
                  ? 'Sincronizando...'
                  : toolStatus
                  ? toolStatus
                  : isThinking
                  ? 'Escribiendo...'
                  : 'En línea · 24/7'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClear}
            title={confirmClear ? 'Confirmar borrado' : 'Limpiar conversación'}
            className={`p-2 rounded-xl transition-all ${
              confirmClear
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)]'
            }`}
          >
            <Trash2 size={18} />
          </button>
        </header>

        {/* Banner herramienta activa */}
        {toolStatus && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)]/5 border-b border-[var(--primary)]/20 text-xs font-medium text-[var(--primary)] shrink-0">
            <Loader2 size={12} className="animate-spin" />
            {toolStatus}
          </div>
        )}

        {/* Área de mensajes */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">

          {/* Botón cargar más */}
          {hasMore && (
            <div className="flex justify-center pb-3">
              <button
                onClick={loadMore}
                disabled={syncing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 transition-colors disabled:opacity-50"
              >
                {syncing ? <Loader2 size={12} className="animate-spin" /> : <ChevronUp size={12} />}
                Cargar mensajes anteriores
              </button>
            </div>
          )}

          {/* Estado vacío */}
          {messages.length === 0 && !syncing && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
                <Sparkles size={28} className="text-[var(--primary)]" />
              </div>
              <div>
                <p className="text-base font-bold text-[var(--foreground)]">¿En qué te ayudo?</p>
                <p className="text-sm text-[var(--text-muted)] mt-1 max-w-xs">
                  Podés preguntarme sobre canchas, clases, torneos o tus reservas.
                </p>
              </div>
            </div>
          )}

          {/* Mensajes */}
          {listItems.map((item) => {
            if (item.type === 'separator') {
              return (
                <div key={item.key} className="flex items-center gap-3 py-3">
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  <span className="text-[11px] font-semibold text-[var(--text-muted)] shrink-0">{item.label}</span>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                </div>
              );
            }

            const { msg } = item;
            const isUser = msg.role === 'user';
            const isEmpty = msg.content === '' && !isUser;

            return (
              <div key={item.key} className={`flex items-end gap-2 mb-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0 mb-5 shadow-sm">
                    <Sparkles size={12} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-[var(--primary)] text-white rounded-br-sm shadow-md shadow-[var(--primary)]/20'
                        : 'bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--foreground)] rounded-bl-sm'
                    }`}
                  >
                    {isEmpty ? (
                      <TypingDots />
                    ) : (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] mt-1 px-1">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Acciones rápidas — siempre visibles */}
        <div className="px-4 pt-2 pb-1 shrink-0 border-t border-[var(--border)]/50">
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => handleQuickAction(action.msg)}
                  disabled={isLoading}
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all disabled:opacity-50"
                >
                  <Icon size={12} className="text-[var(--primary)]" />
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Escribí tu consulta... (Enter para enviar)"
              disabled={isLoading}
              rows={1}
              maxLength={1000}
              className="flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] placeholder:text-[var(--text-muted)] text-sm px-4 py-2.5 focus:outline-none focus:border-[var(--primary)] transition-colors disabled:opacity-50 min-h-[42px] max-h-[120px] leading-relaxed"
              style={{ overflow: 'hidden' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all disabled:opacity-40 shadow-md"
              style={{
                backgroundColor: input.trim() && !isLoading ? 'var(--primary)' : 'var(--surface-secondary)',
                boxShadow: input.trim() && !isLoading ? '0 4px 12px color-mix(in srgb, var(--primary) 30%, transparent)' : 'none',
              }}
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" />
              ) : (
                <Send size={16} className={input.trim() ? 'text-white' : 'text-[var(--text-muted)]'} />
              )}
            </button>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] text-right mt-1">Shift+Enter para nueva línea</p>
        </div>
      </div>
    </>
  );
}
