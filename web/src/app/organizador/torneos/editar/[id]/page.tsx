'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Save, ArrowLeft, Loader2, Calendar, Target, AlertTriangle, Clock, MapPin, Check, Sparkles, User, Users, RefreshCw, AlertCircle, CalendarRange, MessageSquare, X, Edit } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import PartidoChat from '@/components/PartidoChat';

const CATEGORIAS = ['SuperA', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D'];
const FASES = ['Inscripcion', 'Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinal', 'Final'];

const DAYS_EN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DAYS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const HOURS = Array.from({ length: 17 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`);

interface MatchCardProps {
  partido: any;
  playersMap: Map<string, string>;
  canchas: any[];
  onSave: (
    partidoId: number,
    fecha: string | null,
    hora: string | null,
    canchaId: number | null,
    estado: string,
    resultadoSet1: string | null,
    resultadoSet2: string | null,
    resultadoSet3: string | null,
    ganadorPareja: number | null
  ) => Promise<void>;
  onOpenChat: (partidoId: number) => void;
}function MatchCard({ partido, playersMap, canchas, onSave, onOpenChat }: MatchCardProps) {
  const [fecha, setFecha] = useState(partido.fecha_partido || '');
  const [hora, setHora] = useState(partido.hora_partido ? partido.hora_partido.substring(0, 5) : '');
  const [cancha, setCancha] = useState(partido.cancha_id || '');
  const [estado, setEstado] = useState(partido.estado || 'propuesto');
  const [set1, setSet1] = useState(partido.resultado_set1 || '');
  const [set2, setSet2] = useState(partido.resultado_set2 || '');
  const [set3, setSet3] = useState(partido.resultado_set3 || '');
  const [ganador, setGanador] = useState(partido.ganador_pareja || '');
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setFecha(partido.fecha_partido || '');
    setHora(partido.hora_partido ? partido.hora_partido.substring(0, 5) : '');
    setCancha(partido.cancha_id || '');
    setEstado(partido.estado || 'propuesto');
    setSet1(partido.resultado_set1 || '');
    setSet2(partido.resultado_set2 || '');
    setSet3(partido.resultado_set3 || '');
    setGanador(partido.ganador_pareja || '');
  }, [partido]);

  const isBye = !partido.p2_jugador_1_id;
  const p1Name = `${playersMap.get(partido.p1_jugador_1_id) || 'Jugador 1'}${partido.p1_jugador_2_id ? ' & ' + (playersMap.get(partido.p1_jugador_2_id) || 'Jugador 2') : ''}`;
  const p2Name = isBye ? 'BYE' : `${playersMap.get(partido.p2_jugador_1_id) || 'Jugador 3'}${partido.p2_jugador_2_id ? ' & ' + (playersMap.get(partido.p2_jugador_2_id) || 'Jugador 4') : ''}`;

  const isChanged = 
    fecha !== (partido.fecha_partido || '') ||
    hora !== (partido.hora_partido ? partido.hora_partido.substring(0, 5) : '') ||
    cancha.toString() !== (partido.cancha_id || '').toString() ||
    estado !== (partido.estado || 'propuesto') ||
    set1 !== (partido.resultado_set1 || '') ||
    set2 !== (partido.resultado_set2 || '') ||
    set3 !== (partido.resultado_set3 || '') ||
    ganador.toString() !== (partido.ganador_pareja || '').toString();

  const handleGanadorChange = (val: string) => {
    setGanador(val);
    if (val !== '') {
      setEstado('jugado');
    } else {
      setEstado('confirmado');
    }
  };

  const statusColors: Record<string, string> = {
    propuesto: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
    confirmado: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    reprogramado: 'border-sky-500/20 bg-sky-500/10 text-sky-400',
    'w.o.': 'border-rose-500/20 bg-rose-500/10 text-rose-400',
    jugado: 'border-primary/20 bg-primary/10 text-primary',
    cancelado: 'border-slate-500/20 bg-slate-500/10 text-muted',
  };

  // Do not mark as unscheduled if it is already played (has a winner or state is 'jugado')
  const isUnscheduled = !isBye && estado !== 'jugado' && !ganador && (!fecha || !hora || !cancha);

  const currentCanchaObj = canchas.find(c => c.id.toString() === cancha.toString());
  const canchaLabel = currentCanchaObj ? `Cancha ${currentCanchaObj.numero_cancha} (${currentCanchaObj.superficie})` : '';

  // Consider scoreboard active if there is any set text
  const hasScores = !!(set1 || set2 || set3);

  const parseSet = (val: string) => {
    if (!val) return { p1: '', p2: '' };
    const parts = val.split('-');
    if (parts.length === 1) {
      const score = parseInt(parts[0]);
      let loserScore = '-';
      if (!isNaN(score)) {
        if (score === 6) loserScore = '4';
        else if (score === 7) loserScore = '5';
        else if (score === 9) loserScore = '7';
        else if (score > 6) loserScore = (score - 2).toString();
        else loserScore = (score - 2) > 0 ? (score - 2).toString() : '0';
      }
      if (ganador.toString() === '2') {
        return { p1: loserScore, p2: parts[0] };
      } else {
        return { p1: parts[0], p2: loserScore };
      }
    }
    return {
      p1: parts[0] || '',
      p2: parts[1] || ''
    };
  };

  const renderSetBadge = (pVal: string, oVal: string) => {
    if (!pVal) return null;
    const p = parseInt(pVal);
    const o = parseInt(oVal);
    const hasBoth = !isNaN(p) && !isNaN(o);
    const isSetWinner = hasBoth && p > o;
    
    const badgeClass = isSetWinner
      ? 'bg-[#275a20] text-foreground font-black'
      : hasBoth
        ? 'bg-[#f4f6f5] text-slate-800 font-bold'
        : 'bg-surface text-muted';

    return (
      <span className={`w-7 h-7 rounded-md flex items-center justify-center text-xs shadow-sm transition-all ${badgeClass}`}>
        {pVal}
      </span>
    );
  };

  const s1 = parseSet(set1);
  const s2 = parseSet(set2);
  const s3 = parseSet(set3);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(
        partido.id,
        fecha || null,
        hora || null,
        cancha ? Number(cancha) : null,
        estado,
        set1 || null,
        set2 || null,
        set3 || null,
        ganador ? Number(ganador) : null
      );
      setIsEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`bg-surface/60 backdrop-blur-sm border ${isUnscheduled ? 'border-amber-500/30' : 'border-border'} rounded-2xl p-5 hover:border-slate-650 transition-all flex flex-col justify-between space-y-4`}>
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-full border ${statusColors[estado] || 'border-border bg-surface-secondary text-muted'}`}>
            {estado.toUpperCase()}
          </span>
          {!isBye && (
            <button
              type="button"
              onClick={() => onOpenChat(partido.id)}
              className="px-2 py-0.5 rounded bg-surface-secondary hover:bg-slate-750 text-foreground hover:text-primary border border-border hover:border-primary/30 transition-all text-[9px] font-black flex items-center gap-1 cursor-pointer shadow-sm"
              title="Abrir Chat de Partido"
            >
              <MessageSquare size={10} />
              CHAT
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {isBye && (
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md font-bold">
              BYE (Clasificado)
            </span>
          )}
          {isUnscheduled && (
            <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
              <AlertCircle size={10} /> Sin Programar
            </span>
          )}
          {!isBye && (
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${isEditing ? 'bg-surface-secondary border-border text-foreground hover:bg-slate-700' : 'bg-primary/15 hover:bg-indigo-650/20 border-primary/20 text-primary hover:text-indigo-300'}`}
            >
              <Edit size={10} />
              {isEditing ? 'CERRAR' : 'EDITAR'}
            </button>
          )}
        </div>
      </div>

      {/* Date, Time, and Court display */}
      {!isBye && (fecha || hora || canchaLabel) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-450 bg-surface/40 px-3 py-2 rounded-xl border border-border/60 shadow-inner">
          {fecha && (
            <span className="flex items-center gap-1 font-semibold">
              <Calendar size={12} className="text-primary" />
              {new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
          )}
          {hora && (
            <span className="flex items-center gap-1 font-semibold">
              <Clock size={12} className="text-primary" />
              {hora} hs
            </span>
          )}
          {canchaLabel && (
            <span className="flex items-center gap-1 font-semibold">
              <MapPin size={12} className="text-primary" />
              {canchaLabel}
            </span>
          )}
        </div>
      )}

      {/* Players list and scoreboard display */}
      <div className="space-y-2">
        {/* Player 1 Row */}
        <div className={`p-3 rounded-xl border transition-all ${ganador.toString() === '1' ? 'bg-[#275a20]/10 border-[#275a20]/25 font-bold text-foreground shadow-sm shadow-[#275a20]/5' : 'bg-surface/30 border-slate-900/40 text-muted'}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <User size={14} className={ganador.toString() === '1' ? 'text-emerald-400' : 'text-slate-650'} />
              <span className="truncate text-xs">{p1Name}</span>
              {ganador.toString() === '1' && <span className="text-[8px] bg-[#275a20] text-foreground px-1.5 py-0.2 rounded font-black tracking-tight uppercase">GANADOR</span>}
            </div>
            {!isBye && hasScores && (
              <div className="flex items-center gap-1.5 font-mono text-xs shrink-0">
                {renderSetBadge(s1.p1, s1.p2)}
                {renderSetBadge(s2.p1, s2.p2)}
                {renderSetBadge(s3.p1, s3.p2)}
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-[10px] text-slate-650 font-black tracking-widest my-1">VS</div>

        {/* Player 2 Row */}
        <div className={`p-3 rounded-xl border transition-all ${ganador.toString() === '2' ? 'bg-[#275a20]/10 border-[#275a20]/25 font-bold text-foreground shadow-sm shadow-[#275a20]/5' : 'bg-surface/30 border-slate-900/40 text-muted'} ${isBye ? 'italic opacity-60' : ''}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <User size={14} className={ganador.toString() === '2' ? 'text-emerald-400' : 'text-slate-650'} />
              <span className="truncate text-xs">{p2Name}</span>
              {ganador.toString() === '2' && <span className="text-[8px] bg-[#275a20] text-foreground px-1.5 py-0.2 rounded font-black tracking-tight uppercase">GANADOR</span>}
            </div>
            {!isBye && hasScores && (
              <div className="flex items-center gap-1.5 font-mono text-xs shrink-0">
                {renderSetBadge(s1.p2, s1.p1)}
                {renderSetBadge(s2.p2, s2.p1)}
                {renderSetBadge(s3.p2, s3.p1)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Editing collapsible form block */}
      {!isBye && isEditing && (
        <div className="space-y-4 pt-4 border-t border-border animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-bold text-muted block mb-0.5">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full bg-surface/60 border border-border text-foreground rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-muted block mb-0.5">Hora</label>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full bg-surface/60 border border-border text-foreground rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-[9px] font-bold text-muted block mb-0.5">Cancha</label>
            <select
              value={cancha}
              onChange={(e) => setCancha(e.target.value)}
              className="w-full bg-surface/60 border border-slate-855 text-foreground rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="">Sin cancha asignada</option>
              {canchas.map(c => (
                <option key={c.id} value={c.id}>
                  Cancha {c.numero_cancha} ({c.superficie})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-surface/60 p-3 rounded-xl border border-slate-900/60 space-y-2.5">
            <span className="text-[9px] font-black text-primary uppercase tracking-wider block">Registrar Marcador</span>
            
            <div className="grid grid-cols-3 gap-1">
              <div>
                <label className="text-[8px] font-black text-muted block mb-0.5 text-center">Set 1</label>
                <input
                  type="text"
                  placeholder="6-4"
                  value={set1}
                  onChange={(e) => setSet1(e.target.value)}
                  className="w-full bg-surface border border-border text-foreground rounded-lg p-1.5 text-xs text-center font-mono placeholder-slate-700 outline-none focus:border-border"
                />
              </div>
              <div>
                <label className="text-[8px] font-black text-muted block mb-0.5 text-center">Set 2</label>
                <input
                  type="text"
                  placeholder="4-6"
                  value={set2}
                  onChange={(e) => setSet2(e.target.value)}
                  className="w-full bg-surface border border-border text-foreground rounded-lg p-1.5 text-xs text-center font-mono placeholder-slate-700 outline-none focus:border-border"
                />
              </div>
              <div>
                <label className="text-[8px] font-black text-muted block mb-0.5 text-center">Set 3</label>
                <input
                  type="text"
                  placeholder="6-2"
                  value={set3}
                  onChange={(e) => setSet3(e.target.value)}
                  className="w-full bg-surface border border-border text-foreground rounded-lg p-1.5 text-xs text-center font-mono placeholder-slate-700 outline-none focus:border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-bold text-muted block mb-0.5">Definir Ganador</label>
                <select
                  value={ganador}
                  onChange={(e) => handleGanadorChange(e.target.value)}
                  className="w-full bg-surface border border-border/85 text-slate-350 rounded-lg p-1.5 text-xs outline-none cursor-pointer"
                >
                  <option value="">Sin definir</option>
                  <option value="1">Línea Superior</option>
                  <option value="2">Línea Inferior</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-muted block mb-0.5">Estado</label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-full bg-surface border border-border/85 text-slate-350 rounded-lg p-1.5 text-xs outline-none cursor-pointer"
                >
                  <option value="propuesto">Propuesto</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="reprogramado">Reprogramado</option>
                  <option value="w.o.">W.O.</option>
                  <option value="jugado">Jugado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 bg-surface-secondary hover:bg-slate-750 text-foreground font-bold py-2 rounded-xl text-xs transition-all border border-border"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !isChanged}
              className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-primary/25 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Check size={12} />
              )}
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EditarTorneoPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hideSettings = searchParams.get('hideSettings') === 'true';
  const id = params.id as string;

  const [nombre, setNombre] = useState('');
  const [deporte, setDeporte] = useState('Tenis');
  const [categoria, setCategoria] = useState('B');
  const [fechaInicio, setFechaInicio] = useState('');
  const [activo, setActivo] = useState(true);
  const [faseActual, setFaseActual] = useState('Inscripcion');
  const [cantSets, setCantSets] = useState(3);
  const [clubNombre, setClubNombre] = useState('');

  const [precioSingle, setPrecioSingle] = useState('');
  const [precioDobles, setPrecioDobles] = useState('');
  const [precioAmbos, setPrecioAmbos] = useState('');

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [partidos, setPartidos] = useState<any[]>([]);
  const [canchas, setCanchas] = useState<any[]>([]);
  const [selectedCanchaId, setSelectedCanchaId] = useState<number | null>(null);
  const [courtAvailability, setCourtAvailability] = useState<{ [key: string]: boolean }>({});
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [availSuccess, setAvailSuccess] = useState(false);
  const [loadingPartidos, setLoadingPartidos] = useState(false);
  const [playersMap, setPlayersMap] = useState<Map<string, string>>(new Map());
  const [generatingBracket, setGeneratingBracket] = useState(false);
  const [publishingRound, setPublishingRound] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('');
  const [miUsuarioId, setMiUsuarioId] = useState<string | null>(null);
  const [activeChatPartidoId, setActiveChatPartidoId] = useState<number | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setMiUsuarioId(user.id);
      }
    };
    fetchUser();
  }, []);

  const cargarPartidos = async () => {
    setLoadingPartidos(true);
    try {
      const { data: partidosData, error: pError } = await supabase
        .from('partidos')
        .select('*')
        .eq('torneo_id', id)
        .order('id', { ascending: true });

      if (pError) throw pError;
      
      const matches = partidosData || [];
      setPartidos(matches);

      // Collect unique player IDs to fetch names
      const playerIds = Array.from(
        new Set(
          matches.flatMap(p => [
            p.p1_jugador_1_id,
            p.p1_jugador_2_id,
            p.p2_jugador_1_id,
            p.p2_jugador_2_id
          ]).filter(Boolean)
        )
      );

      if (playerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('perfiles_usuarios')
          .select('id, nombre')
          .in('id', playerIds);

        const newMap = new Map<string, string>();
        if (profilesData) {
          profilesData.forEach(p => newMap.set(p.id, p.nombre));
        }
        setPlayersMap(newMap);
      }
    } catch (err) {
      console.error("Error cargando partidos:", err);
    } finally {
      setLoadingPartidos(false);
    }
  };

  const handleGenerarCuadro = async () => {
    setGeneratingBracket(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'}/functions/v1/generate-bracket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ torneo_id: Number(id) })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Error al generar el cuadro.");
      }

      setSuccess(true);
      await cargarPartidos();
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al generar el cuadro.");
    } finally {
      setGeneratingBracket(false);
    }
  };

  const handleGuardarPartido = async (
    partidoId: number, 
    fecha: string | null, 
    hora: string | null, 
    cancha: number | null,
    estado: string,
    resultadoSet1: string | null,
    resultadoSet2: string | null,
    resultadoSet3: string | null,
    ganadorPareja: number | null
  ) => {
    try {
      setError(null);
      let formattedHora = hora;
      if (hora && hora.length === 5) {
        formattedHora = `${hora}:00`;
      }

      const { error: updateError } = await supabase
        .from('partidos')
        .update({
          fecha_partido: fecha || null,
          hora_partido: formattedHora || null,
          cancha_id: cancha ? Number(cancha) : null,
          estado: estado,
          resultado_set1: resultadoSet1 || null,
          resultado_set2: resultadoSet2 || null,
          resultado_set3: resultadoSet3 || null,
          ganador_pareja: ganadorPareja ? Number(ganadorPareja) : null
        })
        .eq('id', partidoId);

      if (updateError) throw updateError;
      
      await cargarPartidos();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al guardar los cambios del partido.");
    }
  };

  const handlePublicarRonda = async () => {
    setPublishingRound(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('partidos')
        .update({ estado: 'confirmado' })
        .eq('torneo_id', id)
        .eq('fase', faseActual)
        .eq('estado', 'propuesto');

      if (updateError) throw updateError;

      await cargarPartidos();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al publicar la ronda.");
    } finally {
      setPublishingRound(false);
    }
  };

  // Cargar datos actuales del torneo
  useEffect(() => {
    const cargarTorneo = async () => {
      try {
        if (!id) return;

        // 1. Obtener Torneo
        const { data: torneo, error: tError } = await supabase
          .from('torneos')
          .select(`*, organizaciones(nombre)`)
          .eq('id', id)
          .single();

        if (tError) throw tError;

        if (torneo) {
          setNombre(torneo.nombre_torneo);
          setDeporte(torneo.deporte);
          setCategoria(torneo.categoria_torneo);
          setFechaInicio(torneo.fecha_inicio || '');
          setActivo(torneo.activo);
          setFaseActual(torneo.fase_actual);
          const formato = torneo.formato_sets || '3_sets_normal';
          const parts = formato.split('_sets_');
          setCantSets(parseInt(parts[0]) || (formato === '1_set' ? 1 : 3));
          setClubNombre(torneo.organizaciones?.nombre || 'Club no asignado');

          // 3. Obtener Canchas de la Organización
          const { data: canchasData } = await supabase
            .from('canchas')
            .select('*')
            .eq('organizacion_id', torneo.organizacion_id)
            .eq('activa', true);
          if (canchasData) {
            setCanchas(canchasData);
            if (canchasData.length > 0) {
              setSelectedCanchaId(canchasData[0].id);
            }
          }

          // 3.1. Obtener disponibilidades de cancha existentes para este torneo
          const { data: courtAvailData } = await supabase
            .from('disponibilidad_cancha_torneo')
            .select('*')
            .eq('torneo_id', id);

          if (courtAvailData) {
            const initialAvail: { [key: string]: boolean } = {};
            const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
            
            courtAvailData.forEach((av: any) => {
              const dateObj = new Date(av.fecha_disponible + 'T00:00:00');
              const dayOfWeek = dayNames[dateObj.getDay()];
              const hourStr = av.hora_inicio_disponible.substring(0, 5);
              initialAvail[`${av.cancha_id}_${dayOfWeek}_${hourStr}`] = true;
            });
            
            setCourtAvailability(initialAvail);
          }
        }

        // 2. Obtener Tarifas
        const { data: tarifas, error: pError } = await supabase
          .from('tarifas_torneo')
          .select('*')
          .eq('torneo_id', id)
          .single();

        if (!pError && tarifas) {
          setPrecioSingle(tarifas.precio_single.toString());
          setPrecioDobles(tarifas.precio_dobles.toString());
          setPrecioAmbos(tarifas.precio_ambos.toString());
        }

        // 4. Obtener Partidos
        await cargarPartidos();
      } catch (err: any) {
        console.error("Error al cargar torneo:", err);
        setError("No se pudo cargar la información del torneo.");
      } finally {
        setInitialLoading(false);
      }
    };

    cargarTorneo();
  }, [id]);

  const availablePhases = Array.from(new Set(partidos.map(p => p.fase))).sort((a, b) => {
    const phasesOrder = ['Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinal', 'Final'];
    return phasesOrder.indexOf(a) - phasesOrder.indexOf(b);
  });

  useEffect(() => {
    if (partidos.length > 0 && (!activeTab || !availablePhases.includes(activeTab))) {
      if (availablePhases.includes(faseActual)) {
        setActiveTab(faseActual);
      } else {
        setActiveTab(availablePhases[0]);
      }
    }
  }, [partidos, faseActual]);

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Actualizar Torneo
      const { error: tError } = await supabase
        .from('torneos')
        .update({
          nombre_torneo: nombre,
          deporte: deporte,
          categoria_torneo: categoria,
          fecha_inicio: fechaInicio,
          activo: activo,
          fase_actual: faseActual,
          formato_sets: `${cantSets}_sets`
        })
        .eq('id', id);

      if (tError) throw tError;

      // 2. Actualizar o Insertar Tarifas
      const { data: tarifaExistente } = await supabase
        .from('tarifas_torneo')
        .select('id')
        .eq('torneo_id', id)
        .single();

      if (tarifaExistente) {
        const { error: pError } = await supabase
          .from('tarifas_torneo')
          .update({
            precio_single: parseFloat(precioSingle),
            precio_dobles: parseFloat(precioDobles),
            precio_ambos: parseFloat(precioAmbos)
          })
          .eq('torneo_id', id);

        if (pError) throw pError;
      } else {
        const { error: pError } = await supabase
          .from('tarifas_torneo')
          .insert([{
            torneo_id: Number(id),
            precio_single: parseFloat(precioSingle),
            precio_dobles: parseFloat(precioDobles),
            precio_ambos: parseFloat(precioAmbos)
          }]);

        if (pError) throw pError;
      }

      setSuccess(true);
      setTimeout(() => {
        router.back();
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al actualizar el torneo.");
    } finally {
      setLoading(false);
    }
  };

  const copyCanchaAvailabilityToAll = () => {
    if (!selectedCanchaId) return;
    setCourtAvailability(prev => {
      const updated = { ...prev };
      canchas.forEach(c => {
        if (c.id !== selectedCanchaId) {
          DAYS_EN.forEach(day => {
            HOURS.forEach(hour => {
              const sourceKey = `${selectedCanchaId}_${day}_${hour}`;
              const targetKey = `${c.id}_${day}_${hour}`;
              updated[targetKey] = prev[sourceKey] || false;
            });
          });
        }
      });
      return updated;
    });
  };

  const copyDayAvailabilityForCancha = (sourceDay: string) => {
    if (!selectedCanchaId) return;
    setCourtAvailability(prev => {
      const updated = { ...prev };
      DAYS_EN.forEach(targetDay => {
        if (targetDay !== sourceDay) {
          HOURS.forEach(hour => {
            const sourceKey = `${selectedCanchaId}_${sourceDay}_${hour}`;
            const targetKey = `${selectedCanchaId}_${targetDay}_${hour}`;
            updated[targetKey] = prev[sourceKey] || false;
          });
        }
      });
      return updated;
    });
  };

  const handleGuardarDisponibilidadCanchas = async () => {
    setSavingAvailability(true);
    setError(null);
    setAvailSuccess(false);

    try {
      const daysMap: { [key: string]: number } = {
        lunes: 1,
        martes: 2,
        miercoles: 3,
        jueves: 4,
        viernes: 5,
        sabado: 6,
        domingo: 0
      };

      if (!fechaInicio) {
        throw new Error("El torneo debe tener una fecha de inicio configurada para guardar disponibilidad.");
      }

      const selectedSlots = Object.entries(courtAvailability)
        .filter(([_, isSelected]) => isSelected)
        .map(([key]) => key);

      const proposals = selectedSlots.map(slotKey => {
        const [canchaIdStr, dayName, hourStr] = slotKey.split('_');
        
        const targetDayOfWeek = daysMap[dayName];
        const start = new Date(fechaInicio + 'T00:00:00');
        const startDayOfWeek = start.getDay();
        
        let diff = targetDayOfWeek - startDayOfWeek;
        if (diff < 0) {
          diff += 7;
        }
        
        const resultDate = new Date(start);
        resultDate.setDate(start.getDate() + diff);
        const fechaDisponible = resultDate.toISOString().split('T')[0];

        const [h, m] = hourStr.split(':');
        const horaInicio = `${h}:${m}:00`;
        const horaFin = `${(parseInt(h) + 1).toString().padStart(2, '0')}:${m}:00`;

        return {
          torneo_id: Number(id),
          cancha_id: Number(canchaIdStr),
          fecha_disponible: fechaDisponible,
          hora_inicio_disponible: horaInicio,
          hora_fin_disponible: horaFin
        };
      });

      const { error: deleteError } = await supabase
        .from('disponibilidad_cancha_torneo')
        .delete()
        .eq('torneo_id', Number(id));

      if (deleteError) throw deleteError;

      if (proposals.length > 0) {
        const { error: insertError } = await supabase
          .from('disponibilidad_cancha_torneo')
          .insert(proposals);

        if (insertError) throw insertError;
      }

      setAvailSuccess(true);
      setTimeout(() => setAvailSuccess(false), 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al guardar la disponibilidad de canchas.");
    } finally {
      setSavingAvailability(false);
    }
  };

  const torneoIniciado = fechaInicio && new Date() > new Date(fechaInicio + 'T00:00:00');

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-background animate-fade-in flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary" size={48} />
          <p className="text-muted font-medium">Cargando datos del torneo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background animate-fade-in p-6 md:p-10 font-sans text-foreground">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="p-3 bg-surface-secondary/85 border border-border rounded-xl hover:bg-surface-secondary transition-colors">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
              <Trophy className="text-primary" /> Editar Torneo
            </h1>
            <p className="text-muted text-sm mt-1">Configuración actual del torneo asignado a {clubNombre}</p>
          </div>
        </div>
        {/* Alerta de torneo iniciado */}
        {!hideSettings && torneoIniciado && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold text-foreground text-sm">Este torneo ya ha iniciado oficialmente</p>
              <p className="text-xs text-muted mt-1">Las modificaciones siguen estando permitidas para administradores, profesores y superadmins.</p>
            </div>
          </div>
        )}



        {/* Sección: Gestión del Cuadro de Partidos */}
        <div className="mt-8 bg-surface-secondary/40 backdrop-blur-md animate-slide-up backdrop-blur-sm border border-border rounded-3xl p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Trophy className="text-primary" size={22} /> Cuadro e Itinerario de Partidos
              </h2>
              <p className="text-muted text-xs mt-1">
                Administración y programación horaria de los cruces del torneo.
              </p>
            </div>
            {partidos.length > 0 && (
              <button
                type="button"
                onClick={handleGenerarCuadro}
                disabled={generatingBracket}
                className="bg-surface-secondary hover:bg-slate-700 border border-border text-foreground font-bold py-2 px-4 rounded-xl text-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {generatingBracket ? (
                  <Loader2 size={14} className="animate-spin text-muted" />
                ) : (
                  <RefreshCw size={14} className="text-muted" />
                )}
                Regenerar Cuadro
              </button>
            )}
          </div>

          {partidos.length === 0 ? (
            <div className="text-center py-10 bg-primary/20/10 border border-primary/10 rounded-2xl p-6">
              <Sparkles className="text-primary mx-auto mb-4 animate-pulse" size={40} />
              <h3 className="text-lg font-bold text-foreground mb-2">Cuadro no generado</h3>
              <p className="text-muted text-sm max-w-md mx-auto mb-6">
                El torneo aún no tiene partidos creados. Los jugadores inscriptos con pago aprobado serán emparejados automáticamente considerando su disponibilidad horaria.
              </p>
              <button
                type="button"
                onClick={handleGenerarCuadro}
                disabled={generatingBracket}
                className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-xl text-sm transition-all shadow-lg shadow-primary/25 flex items-center gap-2 mx-auto disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {generatingBracket ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Sparkles size={18} />
                )}
                {generatingBracket ? 'Generando Cruces...' : 'Generar Cuadro e Itinerario con IA'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Tab Selector for Rounds */}
              <div className="flex flex-wrap gap-2 p-1.5 bg-surface/85 rounded-2xl border border-border">
                {availablePhases.map((phase) => {
                  const isActive = activeTab === phase;
                  const isCurrentFase = faseActual === phase;
                  const numMatches = partidos.filter(p => p.fase === phase).length;
                  return (
                    <button
                      key={phase}
                      type="button"
                      onClick={() => setActiveTab(phase)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-primary text-white shadow-md shadow-primary/15'
                          : 'text-muted hover:text-white hover:bg-surface-secondary/80'
                      }`}
                    >
                      {phase}
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        isActive ? 'bg-primary-hover text-indigo-100' : 'bg-surface-secondary text-muted'
                      }`}>
                        {numMatches}
                      </span>
                      {isCurrentFase && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Warnings / Stats banner */}
              {activeTab && (
                (() => {
                  const phaseMatches = partidos.filter(p => p.fase === activeTab);
                  const unscheduledMatches = phaseMatches.filter(p => !p.p2_jugador_1_id ? false : (p.estado !== 'jugado' && !p.ganador_pareja && (!p.fecha_partido || !p.hora_partido || !p.cancha_id)));
                  const proposedMatches = phaseMatches.filter(p => p.estado === 'propuesto');
                  const isSelectedCurrent = activeTab === faseActual;

                  return (
                    <div className="space-y-4">
                      {/* Top info and Publish action */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-surface/30 border border-border rounded-2xl">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-foreground">
                            Ronda de {activeTab}
                          </p>
                          <p className="text-xs text-muted">
                            {phaseMatches.length} partidos totales. {proposedMatches.length} propuestos y pendientes de publicación.
                          </p>
                        </div>
                        {isSelectedCurrent && proposedMatches.length > 0 && (
                          <button
                            type="button"
                            onClick={handlePublicarRonda}
                            disabled={publishingRound}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-1.5 disabled:opacity-75"
                          >
                            {publishingRound ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Check size={14} />
                            )}
                            Publicar e Iniciar Ronda
                          </button>
                        )}
                      </div>

                      {/* Conflict Alert */}
                      {unscheduledMatches.length > 0 && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
                          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5 animate-pulse" size={20} />
                          <div>
                            <p className="font-bold text-foreground text-sm">Conflictos de Disponibilidad Horaria</p>
                            <p className="text-xs text-muted mt-1">
                              Hay {unscheduledMatches.length} partidos propuestos que no pudieron ser agendados automáticamente por falta de coincidencias horarias o canchas libres. Asigna la fecha, hora y cancha manualmente.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Matches list grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {phaseMatches.map((partido) => (
                          <MatchCard
                            key={partido.id}
                            partido={partido}
                            playersMap={playersMap}
                            canchas={canchas}
                            onSave={handleGuardarPartido}
                            onOpenChat={(partidoId) => setActiveChatPartidoId(partidoId)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          )}
        </div>

        {/* Chat Drawer lateral */}
        {activeChatPartidoId !== null && miUsuarioId && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div 
              className="absolute inset-0 cursor-pointer" 
              onClick={() => setActiveChatPartidoId(null)} 
            />
            <div className="relative w-full max-w-md h-full bg-background shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
              
              {/* Close Button */}
              <div className="absolute top-4 right-4 z-20">
                <button
                  onClick={() => setActiveChatPartidoId(null)}
                  className="p-2 bg-slate-850 hover:bg-surface-secondary border border-border/30 rounded-xl text-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="h-full">
                <PartidoChat
                  partidoId={activeChatPartidoId}
                  miUsuarioId={miUsuarioId}
                  rolUsuario="Organizador"
                />
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
