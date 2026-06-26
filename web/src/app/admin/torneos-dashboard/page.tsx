'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, Users, Target, Loader2, ArrowLeft, ArrowUpRight, BarChart2, ShieldAlert, Award, Clock, Search } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface TournamentStat {
  id: number;
  nombre_torneo: string;
  categoria_torneo: string;
  deporte: string;
  fase_actual: string;
  activo: boolean;
  club_nombre: string;
  total_inscriptos: number;
  total_partidos: number;
  partidos_pendientes: number;
  fecha_inicio?: string;
  creado_at?: string;
}

export default function TorneosDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [torneosStats, setTorneosStats] = useState<TournamentStat[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSport, setSelectedSport] = useState<string>('Todos');

  // Dynamically calculate unique months present in data (based on tournament start date or creation date)
  const uniqueMonths = React.useMemo(() => {
    const monthsSet = new Set<string>();
    torneosStats.forEach(t => {
      const date = t.fecha_inicio || t.creado_at;
      if (date) {
        monthsSet.add(date.substring(0, 7)); // YYYY-MM
      }
    });
    return Array.from(monthsSet).sort().reverse(); // Show latest months first
  }, [torneosStats]);

  const getMonthLabel = (yearMonth: string) => {
    const [year, month] = yearMonth.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  };

  // Filter stats by selected month, search term, and sport
  const filteredTorneosStats = React.useMemo(() => {
    return torneosStats.filter(t => {
      const matchesMonth = selectedMonth === 'Todos' ? true : (t.fecha_inicio || t.creado_at)?.startsWith(selectedMonth);
      const matchesSearch = searchTerm
        ? t.nombre_torneo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.club_nombre.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchesSport = selectedSport === 'Todos' ? true : t.deporte.toLowerCase() === selectedSport.toLowerCase();
      return matchesMonth && matchesSearch && matchesSport;
    });
  }, [torneosStats, selectedMonth, searchTerm, selectedSport]);

  // Overall metrics computed reactively based on filtered tournaments
  const metrics = React.useMemo(() => {
    const totalTorneos = filteredTorneosStats.length;
    const torneosAbiertos = filteredTorneosStats.filter(s => s.fase_actual === 'Inscripcion').length;
    const totalJugadores = filteredTorneosStats.reduce((acc, curr) => acc + curr.total_inscriptos, 0);
    const partidosPendientes = filteredTorneosStats.reduce((acc, curr) => acc + curr.partidos_pendientes, 0);
    
    return {
      totalTorneos,
      torneosAbiertos,
      totalJugadores,
      partidosPendientes,
    };
  }, [filteredTorneosStats]);

  // Category breakdown computed reactively based on filtered tournaments
  const categoryBreakdown = React.useMemo(() => {
    const catMap: { [key: string]: number } = {};
    filteredTorneosStats.forEach(s => {
      catMap[s.categoria_torneo] = (catMap[s.categoria_torneo] || 0) + s.total_inscriptos;
    });
    return catMap;
  }, [filteredTorneosStats]);
  
  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
 
       // 1. Fetch tournaments and their organizations
       const { data: torneosData, error: tError } = await supabase
         .from('torneos')
         .select('*, organizaciones(nombre)')
         .order('creado_at', { ascending: false });
 
       if (tError) throw tError;
 
       // 2. Fetch all registrations to aggregate
       const { data: inscripcionesData, error: iError } = await supabase
         .from('inscripciones_torneo')
         .select('torneo_id, estado_pago');
 
       if (iError) throw iError;
 
       // 3. Fetch all matches to calculate pending count
       const { data: partidosData, error: pError } = await supabase
         .from('partidos')
         .select('torneo_id, ganador_pareja, estado');
 
       if (pError) throw pError;
 
       // Process and map stats
       const stats: TournamentStat[] = (torneosData || []).map(t => {
         const torneoInscripciones = (inscripcionesData || []).filter(ins => ins.torneo_id === t.id && ins.estado_pago === 'Aprobado');
         const torneoPartidos = (partidosData || []).filter(part => part.torneo_id === t.id);
         const pendientes = torneoPartidos.filter(part => part.ganador_pareja === null && part.estado !== 'jugado');
 
         return {
           id: t.id,
           nombre_torneo: t.nombre_torneo,
           categoria_torneo: t.categoria_torneo,
           deporte: t.deporte,
           fase_actual: t.fase_actual,
           activo: t.activo,
           club_nombre: t.organizaciones?.nombre || 'Sin Club',
           total_inscriptos: torneoInscripciones.length,
           total_partidos: torneoPartidos.length,
           partidos_pendientes: pendientes.length,
           fecha_inicio: t.fecha_inicio,
           creado_at: t.creado_at,
         };
       });
 
       setTorneosStats(stats);
     } catch (err) {
       console.error("Error al cargar estadísticas:", err);
     } finally {
       setLoading(false);
     }
   };
 
   return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10 font-sans transition-colors duration-300 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-3 bg-surface-secondary border border-border rounded-xl hover:bg-surface transition-colors">
              <ArrowLeft size={20} className="text-foreground" />
            </Link>
            <div>
              <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                <Trophy className="text-primary" /> Dashboard de Torneos
              </h1>
              <p className="text-stone-500 dark:text-stone-400 text-sm mt-1">Monitoreo global de inscripciones, categorías y estado de fixtures.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Month Filter Selector */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-surface border border-border text-foreground rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary outline-none transition-all text-xs font-bold appearance-none pr-10 relative cursor-pointer"
              style={{
                backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%236B7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E")',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1.25em 1.25em',
                backgroundRepeat: 'no-repeat'
              }}
            >
              <option value="Todos">Todos los Meses</option>
              {uniqueMonths.map(month => (
                <option key={month} value={month}>
                  {getMonthLabel(month)}
                </option>
              ))}
            </select>

            <button 
              onClick={cargarDatos}
              className="px-5 py-2.5 bg-surface-secondary hover:bg-surface border border-border text-xs font-bold rounded-xl transition-all whitespace-nowrap"
            >
              Refrescar Datos
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-primary" size={48} />
            <p className="text-stone-500 font-medium">Cargando métricas globales...</p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Filters Area */}
            <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-center shadow-sm animate-fade-in">
              <div className="relative w-full md:flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar torneo o club..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-surface-secondary border border-border text-foreground rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-primary outline-none transition-all placeholder-stone-500 text-sm"
                />
              </div>

              <div className="flex gap-4 w-full md:w-auto">
                <div className="flex bg-surface border border-border rounded-xl p-1 shrink-0">
                  {(['Todos', 'Tenis', 'Padel'] as const).map(sport => (
                    <button
                      key={sport}
                      type="button"
                      onClick={() => setSelectedSport(sport)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedSport === sport 
                          ? 'bg-primary/15 text-primary shadow-sm' 
                          : 'text-stone-500 hover:text-foreground'
                      }`}
                    >
                      {sport === 'Padel' ? 'Pádel' : sport}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <div className="bg-surface border border-border rounded-2xl p-6 flex items-center justify-between shadow-sm">
                <div className="space-y-2">
                  <p className="text-xs text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">Total Torneos</p>
                  <p className="text-3xl font-black">{metrics.totalTorneos}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Trophy size={24} />
                </div>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-6 flex items-center justify-between shadow-sm">
                <div className="space-y-2">
                  <p className="text-xs text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">Torneos Abiertos</p>
                  <p className="text-3xl font-black text-emerald-500">{metrics.torneosAbiertos}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Calendar size={24} />
                </div>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-6 flex items-center justify-between shadow-sm">
                <div className="space-y-2">
                  <p className="text-xs text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">Jugadores Inscriptos</p>
                  <p className="text-3xl font-black">{metrics.totalJugadores}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Users size={24} />
                </div>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-6 flex items-center justify-between shadow-sm">
                <div className="space-y-2">
                  <p className="text-xs text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">Partidos Pendientes</p>
                  <p className="text-3xl font-black text-primary">{metrics.partidosPendientes}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Clock size={24} />
                </div>
              </div>

            </div>

            {/* Category Breakdown Panel */}
            <div className="bg-surface-secondary/40 border border-border rounded-3xl p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <BarChart2 className="text-primary" size={24} />
                <div>
                  <h2 className="text-xl font-bold">Inscriptos por Categoría</h2>
                  <p className="text-stone-500 dark:text-stone-400 text-xs mt-0.5">Distribución total de jugadores registrados por categoría deportiva.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
                {['SuperA', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D'].map(cat => {
                  const count = categoryBreakdown[cat] || 0;
                  const maxCount = Math.max(...Object.values(categoryBreakdown), 1);
                  const percentage = (count / maxCount) * 100;
                  return (
                    <div key={cat} className="bg-surface border border-border rounded-xl p-4 flex flex-col items-center justify-between text-center relative overflow-hidden shadow-sm">
                      <span className="text-xs text-stone-500 dark:text-stone-400 font-bold">{cat}</span>
                      <span className="text-2xl font-black my-2">{count}</span>
                      <span className="text-[9px] text-stone-400 uppercase tracking-tight">Jugadores</span>
                      {count > 0 && (
                        <div 
                          className="absolute bottom-0 left-0 right-0 h-1 bg-primary" 
                          style={{ width: `${percentage}%` }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tournaments List Table */}
            <div className="bg-surface-secondary/40 border border-border rounded-3xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-border bg-surface-secondary/70 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">Listado de Torneos Activos</h2>
                  <p className="text-stone-500 dark:text-stone-400 text-xs mt-1">Estatus y cantidad de partidos programados/pendientes.</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider border-b border-border">
                      <th className="px-6 py-4 font-bold">Torneo / Club</th>
                      <th className="px-6 py-4 font-bold">Deporte</th>
                      <th className="px-6 py-4 font-bold">Categoría</th>
                      <th className="px-6 py-4 font-bold">Inscriptos</th>
                      <th className="px-6 py-4 font-bold">Estatus de Llave / Fixture</th>
                      <th className="px-6 py-4 font-bold text-center">Partidos Pendientes</th>
                      <th className="px-6 py-4 font-bold text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTorneosStats.map((t) => {
                      const isOpen = t.fase_actual === 'Inscripcion';
                      return (
                        <tr key={t.id} className="hover:bg-surface/70 transition-colors">
                          <td className="px-6 py-5">
                            <div>
                              <p className="font-bold text-sm hover:text-primary transition-colors">
                                <Link href={`/organizador/torneos/editar/${t.id}?hideSettings=true`}>{t.nombre_torneo}</Link>
                              </p>
                              <p className="text-xs text-stone-400 mt-1">{t.club_nombre}</p>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-sm text-stone-500 dark:text-stone-400">{t.deporte}</td>
                          <td className="px-6 py-5">
                            <span className="px-2.5 py-0.5 text-xs bg-surface border border-border text-primary font-bold rounded-full">
                              {t.categoria_torneo}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-sm font-semibold">{t.total_inscriptos}</td>
                          <td className="px-6 py-5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              isOpen 
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                                : 'bg-primary/15 text-primary border-primary/20'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-primary'}`} />
                              {isOpen ? 'Abierto (Inscripción)' : `En Juego (${t.fase_actual})`}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-center">
                            {t.total_partidos > 0 ? (
                              <span className={`text-sm font-bold ${t.partidos_pendientes > 0 ? 'text-primary' : 'text-stone-400'}`}>
                                {t.partidos_pendientes} / {t.total_partidos}
                              </span>
                            ) : (
                              <span className="text-xs text-stone-400 italic">Sin partidos creados</span>
                            )}
                          </td>
                          <td className="px-6 py-5 text-right">
                            <Link
                                href={`/organizador/torneos/editar/${t.id}?hideSettings=true`}
                                className="inline-flex items-center gap-1 text-xs text-primary font-bold"
                            >
                              Administrar <ArrowUpRight size={14} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredTorneosStats.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-stone-400 italic text-sm">
                          {searchTerm || selectedSport !== 'Todos' || selectedMonth !== 'Todos'
                            ? 'No se encontraron torneos que coincidan con la búsqueda y filtros.'
                            : 'No hay torneos registrados.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
