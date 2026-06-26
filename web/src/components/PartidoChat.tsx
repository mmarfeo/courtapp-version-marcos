'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Clock, User, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { usePartidoChat } from '@/lib/hooks/usePartidoChat';

export default function PartidoChat({
  partidoId,
  miUsuarioId,
  rolUsuario
}: {
  partidoId: number;
  miUsuarioId: string;
  rolUsuario: 'Jugador' | 'Organizador' | 'SuperAdmin' | 'Profesor';
}) {
  const { mensajes, perfiles, loading, enviarMensaje } = usePartidoChat(partidoId);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [sending, setSending] = useState(false);
  const mensajesEndRef = useRef<HTMLDivElement>(null);

  // Autoscroll al final cuando llegan nuevos mensajes o se termina de cargar
  useEffect(() => {
    mensajesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, loading]);

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoMensaje.trim() || sending) return;

    setSending(true);
    try {
      await enviarMensaje(nuevoMensaje, miUsuarioId);
      setNuevoMensaje('');
    } catch (err) {
      console.error('Error enviando mensaje:', err);
    } finally {
      setSending(false);
    }
  };

  const formatearHora = (isoDate: string) => {
    try {
      return new Date(isoDate).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-[520px] w-full bg-slate-950/80 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl font-sans relative backdrop-blur-md">
      
      {/* Header del Chat */}
      <div className="bg-slate-900/50 border-b border-slate-800/80 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            {rolUsuario === 'Organizador' || rolUsuario === 'SuperAdmin' ? (
              <ShieldCheck size={20} className="text-indigo-400" />
            ) : (
              <User size={20} className="text-indigo-450" />
            )}
          </div>
          <div>
            <h3 className="font-extrabold text-white text-sm">Chat de Partido #{partidoId}</h3>
            <p className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Canal de Partido Activo
            </p>
          </div>
        </div>
      </div>

      {/* Área de Mensajes */}
      <div className="flex-1 p-6 overflow-y-auto bg-slate-950/20 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
        {loading ? (
          <div className="flex flex-col justify-center items-center h-full gap-2 text-slate-500">
            <Loader2 size={24} className="animate-spin text-indigo-500" />
            <span className="text-xs font-semibold">Cargando chat...</span>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Mensaje Informativo del Sistema */}
            <div className="flex justify-center mb-6">
              <span className="bg-indigo-500/5 border border-indigo-500/15 text-indigo-300 text-[10px] py-1.5 px-4 rounded-full flex items-center gap-2 font-semibold">
                <ShieldCheck size={12} className="text-indigo-400" />
                Los mensajes son visibles para los participantes y el Organizador
              </span>
            </div>

            {mensajes.length === 0 ? (
              <div className="text-center py-12 text-slate-650 flex flex-col items-center justify-center gap-2">
                <User size={36} className="text-slate-800 opacity-60" />
                <p className="text-xs font-semibold text-slate-505">No hay mensajes en este chat.</p>
                <p className="text-[10px] text-slate-506">¡Sé el primero en enviar uno para coordinar!</p>
              </div>
            ) : (
              mensajes.map((msj) => {
                const esMio = msj.remitente_id === miUsuarioId;
                const remitente = perfiles[msj.remitente_id];
                const nombreRemitente = remitente ? remitente.nombre : 'Usuario';
                const esOrganizador = remitente?.rol === 'Organizador' || remitente?.rol === 'SuperAdmin';
                
                return (
                  <div key={msj.id} className={`flex flex-col ${esMio ? 'items-end' : 'items-start'}`}>
                    {/* Nombre del remitente (si no es mío) */}
                    {!esMio && (
                      <span className="text-[10px] font-black text-slate-400 mb-1 px-1 flex items-center gap-1">
                        {nombreRemitente}
                        {esOrganizador && (
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[8px] font-black uppercase px-1 py-0.2 rounded">
                            Org
                          </span>
                        )}
                      </span>
                    )}

                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 transition-all ${
                      esMio 
                        ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-600/10' 
                        : esOrganizador
                          ? 'bg-slate-900/90 border border-amber-500/25 text-amber-100 rounded-tl-none'
                          : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msj.mensaje}</p>
                      <div className={`flex items-center gap-1 mt-1 text-[9px] font-semibold justify-end ${
                        esMio ? 'text-indigo-200' : 'text-slate-500'
                      }`}>
                        <Clock size={9} />
                        {formatearHora(msj.enviado_at)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={mensajesEndRef} />
          </div>
        )}
      </div>

      {/* Formulario de Input */}
      <div className="bg-slate-900/40 p-4 border-t border-slate-800/80">
        <form onSubmit={handleEnviar} className="flex items-center gap-2">
          <input
            type="text"
            value={nuevoMensaje}
            onChange={(e) => setNuevoMensaje(e.target.value)}
            disabled={loading}
            placeholder={loading ? "Espere un momento..." : "Escribe un mensaje para coordinar..."}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-full py-3 px-5 text-sm text-white placeholder-slate-500 focus:bg-slate-950 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all disabled:opacity-50"
          />
          <button 
            type="submit"
            disabled={!nuevoMensaje.trim() || sending || loading}
            className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-850 disabled:text-slate-600 text-white rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 shrink-0"
          >
            {sending ? (
              <Loader2 size={18} className="animate-spin text-white" />
            ) : (
              <Send size={16} className={nuevoMensaje.trim() ? "ml-0.5" : ""} />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
