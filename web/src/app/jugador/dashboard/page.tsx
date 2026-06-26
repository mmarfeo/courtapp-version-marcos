'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Loader2, TrendingUp, Calendar, Trophy, GraduationCap, ArrowRight, Wallet, MapPin, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import BracketModal from '@/components/BracketModal';

export default function JugadorDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gastos, setGastos] = useState({
    torneos: 0,
    clases: 0,
    alquileres: 0,
    totalMes: 0
  });
  const [misTorneos, setMisTorneos] = useState<any[]>([]);
  const [misClases, setMisClases] = useState<any[]>([]);
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [selectedTorneo, setSelectedTorneo] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);

      const { data: profileData } = await supabase
        .from('perfiles_usuarios')
        .select('rol')
        .eq('id', session.user.id)
        .single();
      setProfile(profileData);

      const userId = session.user.id;
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      try {
        // Fetch Gastos Torneos del mes
        const { data: torneosData } = await supabase
          .from('inscripciones_torneo')
          .select('monto_total_pagado, fecha_pago, torneos(nombre_torneo, deporte, fase_actual)')
          .eq('usuario_id', userId)
          .gte('fecha_pago', startOfMonth.toISOString());
        
        // Fetch Gastos Clases del mes
        const { data: clasesData } = await supabase
          .from('reservas_clases')
          .select('monto_total_pagado, fecha_pago, clases_disponibles(fecha, hora_inicio, deporte, perfiles_usuarios(nombre))')
          .eq('alumno_id', userId)
          .gte('fecha_pago', startOfMonth.toISOString());

        // Fetch Gastos Alquileres del mes
        const { data: alquileresData } = await supabase
          .from('alquileres_cancha')
          .select('monto_total, fecha_pago')
          .eq('usuario_id', userId)
          .gte('fecha_pago', startOfMonth.toISOString());

        let gTorneos = 0;
        let gClases = 0;
        let gAlquileres = 0;

        torneosData?.forEach(t => gTorneos += Number(t.monto_total_pagado));
        clasesData?.forEach(c => gClases += Number(c.monto_total_pagado));
        alquileresData?.forEach(a => gAlquileres += Number(a.monto_total));

        setGastos({
          torneos: gTorneos,
          clases: gClases,
          alquileres: gAlquileres,
          totalMes: gTorneos + gClases + gAlquileres
        });

        // Próximos Eventos
        const { data: torneosActivos } = await supabase
          .from('inscripciones_torneo')
          .select('id, modalidad, torneos!inner(id, nombre_torneo, deporte, fase_actual, categoria_torneo, formato_sets, organizaciones(nombre))')
          .eq('usuario_id', userId)
          .neq('torneos.fase_actual', 'Final')
          .limit(3);
          
        setMisTorneos(torneosActivos?.filter(t => t.torneos) || []);

        const today = new Date().toISOString().split('T')[0];
        const { data: proximasClases } = await supabase
          .from('reservas_clases')
          .select('id, clases_disponibles!inner(id, fecha, hora_inicio, deporte, perfiles_usuarios(nombre))')
          .eq('alumno_id', userId)
          .gte('clases_disponibles.fecha', today)
          .order('clases_disponibles(fecha)', { ascending: true })
          .limit(3);

        setMisClases(proximasClases?.filter(c => c.clases_disponibles) || []);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-background">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 font-sans text-foreground animate-fade-in">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Mi Dashboard</h1>
            <p className="text-muted text-sm mt-1">Resumen de tu actividad y gastos en CourtUp.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/torneos" className="px-4 py-2 bg-surface-secondary border border-border rounded-xl text-xs font-bold hover:bg-surface transition-colors flex items-center gap-2">
              <Trophy size={14} /> Buscar Torneos
            </Link>
            <Link href="/clases" className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-hover transition-colors shadow-md shadow-primary/20 flex items-center gap-2">
              <GraduationCap size={14} /> Buscar Clases
            </Link>
          </div>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-primary/30 transition-all">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-primary/5 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
            <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Total del Mes</p>
            <h3 className="text-3xl font-black text-foreground">${gastos.totalMes.toLocaleString()}</h3>
            <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-green-500 bg-green-500/10 w-max px-2 py-1 rounded-md">
              <TrendingUp size={12} /> Mes Actual
            </div>
          </div>
          
          <div className="bg-surface-secondary/50 border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-bold text-muted uppercase tracking-wider">Torneos</p>
              <Trophy size={16} className="text-primary" />
            </div>
            <h3 className="text-2xl font-bold">${gastos.torneos.toLocaleString()}</h3>
          </div>

          <div className="bg-surface-secondary/50 border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-bold text-muted uppercase tracking-wider">Clases</p>
              <GraduationCap size={16} className="text-primary" />
            </div>
            <h3 className="text-2xl font-bold">${gastos.clases.toLocaleString()}</h3>
          </div>

          <div className="bg-surface-secondary/50 border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-bold text-muted uppercase tracking-wider">Alquileres</p>
              <MapPin size={16} className="text-primary" />
            </div>
            <h3 className="text-2xl font-bold">${gastos.alquileres.toLocaleString()}</h3>
          </div>
        </div>

        {/* Activity Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Mis Torneos */}
          <div className="bg-surface border border-border rounded-3xl p-6 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Trophy size={20} className="text-primary" /> Mis Torneos Activos
              </h3>
              <Link href="/jugador/torneos" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                Ver todos <ArrowRight size={12} />
              </Link>
            </div>
            
            <div className="space-y-3">
              {misTorneos.length === 0 ? (
                <p className="text-sm text-muted text-center py-6 bg-surface-secondary/50 rounded-xl border border-dashed border-border">
                  No estás inscripto en torneos activos.
                </p>
              ) : (
                misTorneos.map((inscripcion) => (
                  <div key={inscripcion.id} className="flex items-center justify-between p-4 bg-surface-secondary/40 rounded-2xl border border-border hover:border-primary/30 transition-colors">
                    <div>
                      <h4 className="font-bold text-sm">{inscripcion.torneos?.nombre_torneo}</h4>
                      <p className="text-xs text-muted mt-0.5">{inscripcion.torneos?.deporte} • Modalidad {inscripcion.modalidad}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase rounded-md border border-primary/20 hidden sm:inline-block">
                        {inscripcion.torneos?.fase_actual}
                      </span>
                      <button 
                        onClick={() => setSelectedTorneo(inscripcion.torneos)}
                        className="p-2 bg-surface hover:bg-primary hover:text-white border border-border hover:border-primary text-primary rounded-xl transition-all shadow-sm"
                        title="Ver Cuadro"
                      >
                        <PlayCircle size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Mis Clases */}
          <div className="bg-surface border border-border rounded-3xl p-6 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Calendar size={20} className="text-primary" /> Próximas Clases
              </h3>
              <Link href="/jugador/clases" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                Ver agenda <ArrowRight size={12} />
              </Link>
            </div>
            
            <div className="space-y-3">
              {misClases.length === 0 ? (
                <p className="text-sm text-muted text-center py-6 bg-surface-secondary/50 rounded-xl border border-dashed border-border">
                  No tienes clases programadas.
                </p>
              ) : (
                misClases.map((reserva) => {
                  const clase = reserva.clases_disponibles;
                  return (
                    <div key={reserva.id} className="flex items-center gap-4 p-4 bg-surface-secondary/40 rounded-2xl border border-border hover:border-primary/30 transition-colors">
                      <div className="w-12 h-12 rounded-xl bg-surface border border-border flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-muted uppercase">{new Date(clase.fecha).toLocaleDateString('es-AR', { month: 'short' })}</span>
                        <span className="text-lg font-black leading-none">{new Date(clase.fecha).getDate()}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">Clase de {clase.deporte}</h4>
                        <p className="text-xs text-muted mt-0.5">Prof. {clase.perfiles_usuarios?.nombre} • {clase.hora_inicio.substring(0,5)} hs</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>

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
