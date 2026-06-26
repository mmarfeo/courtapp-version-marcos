'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, 
  CalendarDays, 
  Users, 
  MapPin, 
  ArrowLeft, 
  ArrowRight,
  Loader2, 
  Search, 
  Filter, 
  Target, 
  PlayCircle,
  TrendingUp,
  X,
  Award,
  Compass,
  MessageCircle
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import BracketModal from '@/components/BracketModal';

// Types representing the database structure
interface Organizacion {
  id: number;
  nombre: string;
}

interface Torneo {
  id: number;
  nombre_torneo: string;
  categoria_torneo: string;
  deporte: 'Tenis' | 'Padel';
  fase_actual: 'Inscripcion' | 'Dieciseisavos' | 'Octavos' | 'Cuartos' | 'Semifinal' | 'Final';
  activo: boolean;
  creado_at: string;
  fecha_inicio?: string;
  formato_sets?: string;
  organizaciones: Organizacion;
}

interface Partido {
  id: number;
  fase: string;
  fecha_partido?: string;
  hora_partido?: string;
  resultado_set1?: string;
  resultado_set2?: string;
  resultado_set3?: string;
  ganador_pareja?: number;
  p1_jugador_1_id?: string;
  p1_jugador_2_id?: string;
  p2_jugador_1_id?: string;
  p2_jugador_2_id?: string;
}

interface PerfilUsuario {
  id: string;
  nombre: string;
  foto_url?: string;
}

export default function TorneosPublicosPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeChatPartidoId, setActiveChatPartidoId] = useState<number | null>(null);
  
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([]);
  const [inscritosIds, setInscritosIds] = useState<number[]>([]);
  
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('perfiles_usuarios')
        .select('rol')
        .eq('id', user.id)
        .single();
      if (!error && data) {
        setProfile(data);
      }
    };
    fetchProfile();
  }, [user]);

  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [deporteFilter, setDeporteFilter] = useState<'Todos' | 'Tenis' | 'Padel'>('Todos');
  const [clubFilter, setClubFilter] = useState<string>('Todos');
  const [activeTab, setActiveTab] = useState<'inscripcion' | 'en_curso'>('inscripcion');

  // Selected tournament for details/draw modal
  const [selectedTorneo, setSelectedTorneo] = useState<Torneo | null>(null);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch user session
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);
        
        // 1. Fetch active tournaments
        const { data: torneosData, error: torneosError } = await supabase
          .from('torneos')
          .select(`*, organizaciones(id, nombre)`)
          .eq('activo', true);

        if (torneosError) throw torneosError;

        // 2. Fetch clubs/organizations
        const { data: orgData, error: orgError } = await supabase
          .from('organizaciones')
          .select('id, nombre')
          .eq('activa', true);

        if (orgError) throw orgError;

        // 3. Fetch user enrollments
        if (session?.user) {
          const { data: inscData } = await supabase
            .from('inscripciones_torneo')
            .select('torneo_id')
            .eq('usuario_id', session.user.id);
          if (inscData) {
            setInscritosIds(inscData.map(i => i.torneo_id));
          }
        }

        const torneosList = torneosData || [];
        setTorneos(torneosList);
        setOrganizaciones(orgData || []);

        // Auto-generate bracket if a tournament has started but is still in 'Inscripcion'
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const startedTorneos = torneosList.filter(t => 
          t.fase_actual === 'Inscripcion' && 
          t.fecha_inicio && 
          t.fecha_inicio <= todayStr
        );

        if (startedTorneos.length > 0) {
          Promise.all(
            startedTorneos.map(async (t) => {
              try {
                console.log(`Auto-generando cuadro para torneo #${t.id} porque ya llegó la fecha de inicio.`);
                const { data: { session } } = await supabase.auth.getSession();
                await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'}/functions/v1/generate-bracket`, {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token || ''}`
                  },
                  body: JSON.stringify({ torneo_id: t.id })
                });
              } catch (e) {
                console.error(`Error auto-generando cuadro para torneo #${t.id}:`, e);
              }
            })
          ).then(async () => {
            // Re-fetch torneos list after auto-generating
            const { data: refreshedData } = await supabase
              .from('torneos')
              .select(`*, organizaciones(id, nombre)`)
              .eq('activo', true);
            if (refreshedData) setTorneos(refreshedData);
          });
        }
      } catch (err) {
        console.error('Error fetching public tournaments data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Filter tournaments
  const filteredTorneos = useMemo(() => {
    return torneos.filter(t => {
      if (inscritosIds.includes(t.id)) return false;

      const matchesSearch = t.nombre_torneo.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.organizaciones?.nombre.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDeporte = deporteFilter === 'Todos' || t.deporte === deporteFilter;
      
      const matchesClub = clubFilter === 'Todos' || t.organizaciones?.id.toString() === clubFilter;
      
      const matchesPhase = activeTab === 'inscripcion' 
        ? (t.fase_actual === 'Inscripcion' && !!t.fecha_inicio) 
        : t.fase_actual !== 'Inscripcion';

      return matchesSearch && matchesDeporte && matchesClub && matchesPhase;
    });
  }, [torneos, searchTerm, deporteFilter, clubFilter, activeTab]);

  // Open modal
  const handleOpenDraw = (torneo: Torneo) => {
    setSelectedTorneo(torneo);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans pb-24 transition-colors duration-300 animate-fade-in">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-surface/80 border-b border-border py-12 px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5"></div>
        <div className="max-w-6xl mx-auto relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-secondary border border-border rounded-lg hover:bg-surface transition-colors text-muted hover:text-foreground text-xs font-semibold mb-4">
              <ArrowLeft size={14} />
              Volver al Inicio
            </Link>
            <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight flex items-center gap-3">
              <Trophy className="text-primary animate-bounce-subtle" size={36} />
              Cartelera de Torneos
            </h1>
            <p className="text-stone-500 dark:text-stone-400 mt-1.5 text-sm md:text-base">
              Consulta inscripciones abiertas y sigue las fases en curso de tenis y pádel.
            </p>
          </div>
          
          <div className="flex gap-4 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('inscripcion')}
              className={`flex-1 md:flex-initial px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border ${
                activeTab === 'inscripcion' 
                  ? 'bg-primary border-primary text-white shadow-lg shadow-primary/25' 
                  : 'bg-surface-secondary border-border hover:bg-surface text-stone-500 dark:text-stone-400 hover:text-foreground'
              }`}
            >
              <Compass size={18} />
              Inscripciones Abiertas
            </button>
            <button
              onClick={() => setActiveTab('en_curso')}
              className={`flex-1 md:flex-initial px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border ${
                activeTab === 'en_curso' 
                  ? 'bg-primary border-primary text-white shadow-lg shadow-primary/25' 
                  : 'bg-surface-secondary border-border hover:bg-surface text-stone-500 dark:text-stone-400 hover:text-foreground'
              }`}
            >
              <PlayCircle size={18} />
              Torneos en Curso
            </button>
          </div>
        </div>
      </div>

      {/* Filters Area */}
      <div className="max-w-6xl mx-auto px-6 mt-8">
        <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar torneo o club..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-secondary border border-border text-foreground rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-primary outline-none transition-all placeholder-slate-500 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-4 w-full md:w-auto">
            {/* Sport filter */}
            <div className="flex bg-surface border border-border rounded-xl p-1 shrink-0">
              {(['Todos', 'Tenis', 'Padel'] as const).map(sport => (
                <button
                  key={sport}
                  onClick={() => setDeporteFilter(sport)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    deporteFilter === sport 
                      ? 'bg-primary/15 text-primary shadow-sm' 
                      : 'text-stone-500 hover:text-foreground'
                  }`}
                >
                  {sport === 'Padel' ? 'Pádel' : sport}
                </button>
              ))}
            </div>

            {/* Club filter */}
            <select
              value={clubFilter}
              onChange={(e) => setClubFilter(e.target.value)}
              className="bg-surface border border-border text-foreground rounded-xl px-3 py-2 focus:ring-2 focus:ring-primary outline-none transition-all text-xs font-semibold appearance-none pr-8 relative cursor-pointer"
              style={{
                backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%236B7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E")',
                backgroundPosition: 'right 0.5rem center',
                backgroundSize: '1.25em 1.25em',
                backgroundRepeat: 'no-repeat'
              }}
            >
              <option value="Todos">Todos los Clubes</option>
              {organizaciones.map(org => (
                <option key={org.id} value={org.id}>{org.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-6xl mx-auto px-6 mt-8">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-4 animate-fade-in">
            <Loader2 className="animate-spin text-primary" size={48} />
            <p className="text-muted font-medium">Cargando torneos...</p>
          </div>
        ) : filteredTorneos.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-12 text-center animate-fade-in">
            <Trophy size={48} className="text-stone-300 dark:text-stone-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-1">Sin torneos disponibles</h3>
            <p className="text-muted text-sm max-w-sm mx-auto">
              No encontramos torneos activos que coincidan con los filtros seleccionados.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTorneos.map((t, idx) => (
              <div 
                key={t.id}
                className="group bg-surface-secondary/50 border border-border rounded-2xl overflow-hidden hover:bg-surface hover:border-primary/30 transition-all duration-300 flex flex-col justify-between hover:shadow-md animate-slide-up"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {/* Upper info */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-black text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 uppercase tracking-wider">
                      Cat {t.categoria_torneo}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 bg-surface px-2.5 py-1 rounded-md border border-border">
                      <Target size={14} className="text-primary animate-pulse" />
                      {t.deporte}
                    </div>
                  </div>

                  <h3 className="text-lg font-black group-hover:text-primary transition-colors mb-2 line-clamp-1">
                    {t.nombre_torneo}
                  </h3>
                  
                  <div className="space-y-2 mt-4 text-xs text-stone-550 dark:text-stone-400">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-stone-400 shrink-0" />
                      <span className="truncate">{t.organizaciones?.nombre || 'Club Asignado'}</span>
                    </div>
                    {t.fecha_inicio && (
                      <div className="flex items-center gap-2">
                        <CalendarDays size={14} className="text-stone-400 shrink-0" />
                        <span>Comienza: {new Date(t.fecha_inicio + 'T00:00:00').toLocaleDateString('es-AR')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer / Action */}
                <div className="px-6 py-4 bg-surface-secondary border-t border-border flex items-center justify-between">
                  {activeTab === 'inscripcion' ? (
                    <>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-stone-455">Inscripción</span>
                        <span className="text-xs font-black text-emerald-500">Abierta</span>
                      </div>
                      {user ? (
                        <Link
                          href={`/jugador/torneos/${t.id}/inscripcion`}
                          className="bg-primary hover:bg-primary-hover text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          Inscribirse
                          <ArrowRight size={14} />
                        </Link>
                      ) : (
                        <button
                          onClick={() => router.push('/login')}
                          className="bg-primary hover:bg-primary-hover text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          Inscribirse
                          <ArrowRight size={14} />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-stone-455">Fase actual</span>
                        <span className="text-xs font-black text-primary">{t.fase_actual}</span>
                      </div>
                      <button
                        onClick={() => handleOpenDraw(t)}
                        className="bg-primary hover:bg-primary-hover text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        Ver Cuadro
                        <PlayCircle size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bracket / Draw Modal */}
      {selectedTorneo && (
        <BracketModal 
          torneo={selectedTorneo} 
          user={user} 
          profile={profile} 
          onClose={() => setSelectedTorneo(null)} 
        />
      )}
    </div>
  );
}
