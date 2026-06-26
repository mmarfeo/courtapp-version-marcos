'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal, Trash2, Pause, Play } from 'lucide-react';

export default function LogsPage() {
  const [lines, setLines] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const esRef = useRef<EventSource | null>(null);

  pausedRef.current = paused;

  useEffect(() => {
    const es = new EventSource('/api/admin/logs');
    esRef.current = es;
    setConnected(true);

    es.onmessage = (e) => {
      if (pausedRef.current) return;
      const text: string = JSON.parse(e.data);
      const newLines = text.split('\n').filter(Boolean);
      setLines((prev) => [...prev, ...newLines].slice(-500));
    };

    es.onerror = () => setConnected(false);

    return () => {
      es.close();
      setConnected(false);
    };
  }, []);

  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, paused]);

  const colorize = (line: string) => {
    if (line.includes('[AI] tool_call')) return 'text-yellow-400';
    if (line.includes('[AI] tool_result')) return 'text-green-400';
    if (line.includes('error') || line.includes('Error') || line.includes('ERROR')) return 'text-red-400';
    if (line.includes('✓') || line.includes('Ready')) return 'text-emerald-400';
    if (line.includes('warn') || line.includes('WARN')) return 'text-orange-400';
    return 'text-gray-300';
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 font-mono">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Terminal size={20} className="text-green-400" />
            <h1 className="text-lg font-bold">Logs en tiempo real — courtup-marcos</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full ${connected ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
              {connected ? '● conectado' : '○ desconectado'}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPaused((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
            >
              {paused ? <Play size={14} /> : <Pause size={14} />}
              {paused ? 'Reanudar' : 'Pausar'}
            </button>
            <button
              onClick={() => setLines([])}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
            >
              <Trash2 size={14} />
              Limpiar
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-xs mb-3 text-gray-500">
          <span><span className="text-yellow-400">■</span> tool_call</span>
          <span><span className="text-green-400">■</span> tool_result</span>
          <span><span className="text-red-400">■</span> error</span>
          <span><span className="text-emerald-400">■</span> ready/ok</span>
        </div>

        {/* Log output */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 h-[75vh] overflow-y-auto p-4 text-xs leading-5">
          {lines.length === 0 ? (
            <p className="text-gray-600 italic">Esperando logs...</p>
          ) : (
            lines.map((line, i) => (
              <div key={i} className={`whitespace-pre-wrap break-all ${colorize(line)}`}>
                {line}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <p className="text-xs text-gray-600 mt-2">Mostrando últimas {lines.length}/500 líneas · Auto-scroll {paused ? 'pausado' : 'activo'}</p>
      </div>
    </div>
  );
}
