'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Trash2, Square, Bot, User, Database, Loader2 } from 'lucide-react';
import { useAIChat } from '@/lib/hooks/useAIChat';

interface AIAssistantProps {
  initialGreeting?: string;
  position?: 'bottom-right' | 'bottom-left';
}

export default function AIAssistant({
  initialGreeting = '¡Hola! Soy el asistente de CourtUp. Puedo consultarte información sobre canchas, clases, partidos y reservas del club. ¿En qué puedo ayudarte?',
  position = 'bottom-right',
}: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { messages, status, isLoading, sendMessage, clearMessages, stopGeneration } = useAIChat();

  const positionClass = position === 'bottom-right' ? 'bottom-6 right-6' : 'bottom-6 left-6';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Status bar label
  const statusLabel =
    status.type === 'thinking'
      ? 'Pensando...'
      : status.type === 'querying'
        ? status.tool
        : status.type === 'error'
          ? 'Error'
          : 'En línea';

  const statusColor =
    status.type === 'error'
      ? 'text-red-300'
      : status.type === 'idle'
        ? 'text-green-200'
        : 'text-yellow-200';

  return (
    <div className={`fixed ${positionClass} z-50 flex flex-col items-end gap-3`}>
      {isOpen && (
        <div className="w-80 sm:w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-green-600 text-white">
            <div className="flex items-center gap-2">
              <Bot size={20} />
              <div>
                <p className="text-sm font-semibold leading-none">Asistente CourtUp</p>
                <p className={`text-xs mt-0.5 flex items-center gap-1 ${statusColor}`}>
                  {(status.type === 'thinking' || status.type === 'querying') && (
                    <Loader2 size={10} className="animate-spin" />
                  )}
                  {status.type === 'querying' && <Database size={10} />}
                  {statusLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearMessages}
                  title="Limpiar conversación"
                  aria-label="Limpiar conversación"
                  className="p-1.5 rounded-lg hover:bg-green-500 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Cerrar"
                aria-label="Cerrar asistente"
                className="p-1.5 rounded-lg hover:bg-green-500 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {/* Greeting */}
            {messages.length === 0 && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={14} className="text-green-600" />
                </div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm max-w-[85%]">
                  <p className="text-sm text-gray-700">{initialGreeting}</p>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    msg.role === 'user' ? 'bg-green-600' : 'bg-green-100'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <User size={14} className="text-white" />
                  ) : (
                    <Bot size={14} className="text-green-600" />
                  )}
                </div>
                <div
                  className={`rounded-2xl px-3 py-2 shadow-sm max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-green-600 text-white rounded-tr-sm'
                      : 'bg-white text-gray-700 rounded-tl-sm'
                  }`}
                >
                  {msg.content ? (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  ) : (
                    <span className="inline-flex gap-1 items-center py-1">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Agent activity indicator */}
            {status.type === 'querying' && (
              <div className="flex gap-2 items-center">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Database size={13} className="text-green-600 animate-pulse" />
                </div>
                <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-1.5 text-xs text-green-700 flex items-center gap-1.5">
                  <Loader2 size={11} className="animate-spin" />
                  {status.tool}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Error banner */}
          {status.type === 'error' && (
            <div className="px-3 py-1.5 bg-red-50 border-t border-red-100">
              <p className="text-xs text-red-600">{status.message}</p>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2 px-3 py-3 border-t border-gray-100 bg-white"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Preguntá sobre canchas, clases, partidos..."
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent max-h-24 min-h-[38px] overflow-y-auto disabled:opacity-50"
            />
            {isLoading ? (
              <button
                type="button"
                onClick={stopGeneration}
                className="p-2 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors flex-shrink-0"
                title="Detener"
              >
                <Square size={16} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Enviar mensaje"
                className="p-2 rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <Send size={16} />
              </button>
            )}
          </form>
        </div>
      )}

      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          isOpen ? 'bg-gray-700 hover:bg-gray-800' : 'bg-green-600 hover:bg-green-700'
        } text-white`}
        title={isOpen ? 'Cerrar asistente' : 'Abrir asistente IA'}
        aria-label={isOpen ? 'Cerrar asistente' : 'Abrir asistente IA'}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
