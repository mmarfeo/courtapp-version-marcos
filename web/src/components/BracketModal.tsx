'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, MapPin, X, Loader2, Award, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import PartidoChat from '@/components/PartidoChat';

function cleanPlayerName(name: string) {
  if (!name) return '';
  return name.replace(/^Jugador\s+\d+\s*-\s*/i, '').trim();
}

function getLastName(fullName: string) {
  const cleaned = cleanPlayerName(fullName);
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+/);
  return parts[parts.length - 1] || cleaned;
}

interface BracketModalProps {
  torneo: any;
  user: any;
  profile: any;
  onClose: () => void;
}

export default function BracketModal({ torneo, user, profile, onClose }: BracketModalProps) {
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [partidos, setPartidos] = useState<any[]>([]);
  const [selectedFaseTab, setSelectedFaseTab] = useState<string>('');
  const [activeChatPartidoId, setActiveChatPartidoId] = useState<number | null>(null);

  useEffect(() => {
    const fetchMatches = async () => {
      setLoadingMatches(true);
      try {
        const { data: partidosData, error: partidosError } = await supabase
          .from('partidos')
          .select('*')
          .eq('torneo_id', torneo.id)
          .order('id', { ascending: true });

        if (partidosError) throw partidosError;

        const matches = partidosData || [];

        if (matches.length > 0) {
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

          let profilesMap = new Map<string, any>();
          if (playerIds.length > 0) {
            const { data: profilesData, error: profilesError } = await supabase
              .from('perfiles_usuarios')
              .select('id, nombre, foto_url')
              .in('id', playerIds);

            if (profilesError) throw profilesError;
            
            (profilesData || []).forEach(p => {
              profilesMap.set(p.id, p);
            });
          }

          const matchesWithPlayers = matches.map(p => ({
            ...p,
            p1_j1: p.p1_jugador_1_id ? profilesMap.get(p.p1_jugador_1_id) : null,
            p1_j2: p.p1_jugador_2_id ? profilesMap.get(p.p1_jugador_2_id) : null,
            p2_j1: p.p2_jugador_1_id ? profilesMap.get(p.p2_jugador_1_id) : null,
            p2_j2: p.p2_jugador_2_id ? profilesMap.get(p.p2_jugador_2_id) : null,
          }));

          setPartidos(matchesWithPlayers);

          const phasesInMatches = Array.from(new Set(matches.map(m => m.fase)));
          const phasesPriority = ['Final', 'Semifinal', 'Cuartos', 'Octavos', 'Dieciseisavos'];
          const defaultPhase = phasesPriority.find(p => phasesInMatches.includes(p)) || phasesInMatches[0] || '';
          setSelectedFaseTab(defaultPhase);
        }
      } catch (err) {
        console.error('Error fetching matches:', err);
      } finally {
        setLoadingMatches(false);
      }
    };

    if (torneo) {
      fetchMatches();
    }
  }, [torneo]);

  const filteredMatchesByPhase = useMemo(() => {
    return partidos.filter(p => p.fase === selectedFaseTab);
  }, [partidos, selectedFaseTab]);

  const uniquePhasesInSelectedTorneo = useMemo(() => {
    return Array.from(new Set(partidos.map(p => p.fase)));
  }, [partidos]);

  if (!torneo) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-surface border border-border rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-scale-in">
          
          <div className="p-6 border-b border-border flex items-start justify-between bg-surface-secondary relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-primary"></div>
            <div>
              <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 uppercase tracking-wider">
                Cat {torneo.categoria_torneo}
              </span>
              <h2 className="text-xl font-black mt-2 flex items-center gap-2">
                {torneo.nombre_torneo}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 flex items-center gap-1.5">
                <MapPin size={12} />
                {torneo.organizaciones?.nombre} | Deporte: {torneo.deporte}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 bg-surface hover:bg-surface-secondary rounded-xl text-stone-400 hover:text-foreground transition-colors border border-border z-10"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loadingMatches ? (
              <div className="py-20 flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-amber-500" size={40} />
                <p className="text-slate-450 text-sm font-medium">Cargando partidos...</p>
              </div>
            ) : partidos.length === 0 ? (
              <div className="py-16 text-center">
                <Award size={48} className="text-slate-700 mx-auto mb-4 animate-bounce" />
                <h4 className="text-base font-bold text-[var(--foreground)]">Cuadro en generación</h4>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs mx-auto">
                  El organizador aún no ha publicado los emparejamientos de partidos para este torneo.
                </p>
              </div>
            ) : (
              <>
                <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-thin scrollbar-thumb-slate-800">
                  {uniquePhasesInSelectedTorneo.map(phase => (
                    <button
                      key={phase}
                      onClick={() => setSelectedFaseTab(phase)}
                      className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap border transition-all ${
                        selectedFaseTab === phase 
                          ? 'bg-amber-600 border-amber-500 text-[var(--foreground)] shadow-sm' 
                          : 'bg-[var(--surface)]/85 border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]/85'
                      }`}
                    >
                      {phase}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredMatchesByPhase.map((match: any) => {
                    const hasResult = match.ganador_pareja !== null;
                    const canChat = user && (
                      user.id === match.p1_jugador_1_id ||
                      user.id === match.p1_jugador_2_id ||
                      user.id === match.p2_jugador_1_id ||
                      user.id === match.p2_jugador_2_id ||
                      profile?.rol === 'Organizador' ||
                      profile?.rol === 'SuperAdmin'
                    );
                    
                    const parseSetScore = (setStr: string | null | undefined) => {
                      if (!setStr) return { s1: null, s2: null };
                      const parts = setStr.split('-');
                      if (parts.length === 2) {
                        const s1 = parseInt(parts[0]);
                        const s2 = parseInt(parts[1]);
                        return {
                          s1: isNaN(s1) ? null : s1,
                          s2: isNaN(s2) ? null : s2
                        };
                      }
                      const val = parseInt(setStr);
                      return {
                        s1: isNaN(val) ? null : val,
                        s2: null
                      };
                    };

                    const renderSets = (matchItem: any, teamNum: number) => {
                      const formato = torneo?.formato_sets || '3_sets_normal';
                      const parts = formato.split('_sets_');
                      const cantSets = parseInt(parts[0]) || (formato === '1_set' ? 1 : 3);
                      
                      const setsToRender = [];
                      for (let i = 1; i <= Math.min(cantSets, 3); i++) {
                        const setVal = matchItem[`resultado_set${i}`];
                        const shouldShow = i === 1 || (i === 2 && cantSets > 1) || (i === 3 && setVal !== null && setVal !== undefined && setVal !== '');
                        
                        if (shouldShow) {
                          const scores = parseSetScore(setVal);
                          const val = teamNum === 1 ? scores.s1 : scores.s2;
                          const oppVal = teamNum === 1 ? scores.s2 : scores.s1;
                          
                          const isSetWinner = val !== null && oppVal !== null && val > oppVal;
                          const hasSetPlayed = val !== null && oppVal !== null;
                          
                          const badgeClass = isSetWinner 
                            ? 'bg-[#275a20] text-[var(--foreground)] font-black' 
                            : hasSetPlayed 
                              ? 'bg-[#f4f6f5] text-slate-800 font-bold' 
                              : 'bg-[var(--surface)] text-slate-600';
                          
                          setsToRender.push(
                            <span key={i} className={`w-7 h-7 rounded-md flex items-center justify-center text-xs shadow-sm transition-all ${badgeClass}`}>
                              {val !== null ? val : '-'}
                            </span>
                          );
                        }
                      }
                      return <>{setsToRender}</>;
                    };

                    const renderTeam = (p_j1: any, p_j2: any, isTeam1: boolean) => {
                      const isWinner = hasResult && match.ganador_pareja === (isTeam1 ? 1 : 2);
                      
                      if (!p_j1) {
                        return (
                          <span className="text-xs italic text-[var(--text-muted)]">Por definir</span>
                        );
                      }
                      
                      const isDoubles = torneo?.deporte === 'Padel' || p_j2;
                      let teamName = '';
                      
                      if (isDoubles) {
                        const lastName1 = getLastName(p_j1.nombre);
                        const lastName2 = p_j2 ? getLastName(p_j2.nombre) : '';
                        teamName = p_j2 ? `${lastName1} / ${lastName2}` : lastName1;
                      } else {
                        teamName = cleanPlayerName(p_j1.nombre);
                      }
                      
                      return (
                        <span className={`text-xs font-bold truncate flex items-center gap-1.5 ${isWinner ? 'text-emerald-400 font-black' : 'text-[var(--text-primary)]'}`}>
                          {teamName}
                          {isWinner && <Trophy size={12} className="text-amber-400 shrink-0" />}
                        </span>
                      );
                    };

                    return (
                      <div 
                        key={match.id}
                        className="bg-[var(--surface)]/40 border border-[var(--border)] rounded-2xl p-4 flex flex-col justify-between hover:border-[var(--border)] transition-colors"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className={`w-1.5 h-7 rounded-full shrink-0 ${
                                hasResult && match.ganador_pareja === 1 ? 'bg-emerald-500' : 'bg-[var(--surface-secondary)]'
                              }`} />
                              {renderTeam(match.p1_j1, match.p1_j2, true)}
                            </div>
                            
                            <div className="flex gap-1.5 font-mono text-xs font-bold shrink-0">
                              {hasResult ? (
                                renderSets(match, 1)
                              ) : (
                                <span className="text-[10px] text-slate-600 uppercase font-sans">En Espera</span>
                              )}
                            </div>
                          </div>

                          <div className="border-t border-slate-900/60" />

                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className={`w-1.5 h-7 rounded-full shrink-0 ${
                                hasResult && match.ganador_pareja === 2 ? 'bg-emerald-500' : 'bg-[var(--surface-secondary)]'
                              }`} />
                              {renderTeam(match.p2_j1, match.p2_j2, false)}
                            </div>

                            <div className="flex gap-1.5 font-mono text-xs font-bold shrink-0">
                              {hasResult ? (
                                renderSets(match, 2)
                              ) : (
                                <span className="text-[10px] text-slate-600 uppercase font-sans">En Espera</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3.5 pt-2.5 border-t border-slate-900/40 flex justify-between items-center text-[10px] text-[var(--text-muted)]">
                          <div className="flex items-center gap-1.5">
                            <span>Partido #{match.id}</span>
                            {canChat && (
                              <button
                                onClick={() => setActiveChatPartidoId(match.id)}
                                className="px-1.5 py-0.5 rounded bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-indigo-400 border border-[var(--border)] hover:border-indigo-500/35 transition-all font-black flex items-center gap-1 cursor-pointer"
                                title="Abrir Chat del Partido"
                              >
                                <MessageCircle size={10} />
                                CHAT
                              </button>
                            )}
                          </div>
                          {(match.fecha_partido || match.hora_partido) ? (
                            <span className="font-semibold text-[var(--text-secondary)] bg-[var(--surface)]/80 px-2 py-0.5 rounded">
                              {match.fecha_partido ? new Date(match.fecha_partido + 'T00:00:00').toLocaleDateString('es-AR') : ''} {match.hora_partido ? match.hora_partido.substring(0, 5) : ''}
                            </span>
                          ) : (
                            <span>Fecha por definir</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="p-4 border-t border-border bg-surface-secondary flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-surface hover:bg-surface-secondary text-foreground font-bold text-xs rounded-xl transition-all border border-border"
            >
              Cerrar Cuadro
            </button>
          </div>

        </div>
      </div>

      {activeChatPartidoId !== null && user && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col relative animate-scale-in">
            <div className="absolute top-4 right-4 z-20">
              <button
                onClick={() => setActiveChatPartidoId(null)}
                className="p-2 bg-surface-secondary hover:bg-surface border border-border rounded-xl text-stone-500 hover:text-foreground transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <PartidoChat
              partidoId={activeChatPartidoId}
              miUsuarioId={user.id}
              rolUsuario={profile?.rol || 'Jugador'}
            />
          </div>
        </div>
      )}
    </>
  );
}
