'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Trophy, MapPin, Calendar, Clock, User, DollarSign, Award, CheckCircle2, AlertCircle, Loader2, ArrowLeft, Plus, Search } from 'lucide-react';
import Link from 'next/link';

interface ClaseDisponible {
  id: number;
  organizacion_id: number;
  profesor_id: string;
  cancha_id: number | null;
  deporte: 'Tenis' | 'Padel';
  categoria_target: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  cupo_maximo: number;
  precio_clase: number;
  activa: boolean;
  profesor: {
    nombre: string;
    foto_url?: string;
  };
  organizacion: {
    nombre: string;
  };
}

export default function ClasesPage() {
  const router = useRouter();
  
  // Auth State
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Data States
  const [clases, setClases] = useState<ClaseDisponible[]>([]);
  const [clubes, setClubes] = useState<any[]>([]);
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [bookingClaseId, setBookingClaseId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters State
  const [selectedClub, setSelectedClub] = useState('');
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Load Session and Data
  useEffect(() => {
    const initPage = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);

        if (session?.user) {
          const { data: profile } = await supabase
            .from('perfiles_usuarios')
            .select('rol')
            .eq('id', session.user.id)
            .single();
            
          if (profile) {
            setUserRole(profile.rol);
          }
        }

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        // Fetch active classes
        const { data: clasesData, error: clasesError } = await supabase
          .from('clases_disponibles')
          .select('*, profesor:perfiles_usuarios(nombre, foto_url), organizacion:organizaciones(nombre)')
          .eq('activa', true)
          .gte('fecha', todayStr)
          .order('fecha', { ascending: true })
          .order('hora_inicio', { ascending: true });

        if (clasesError) throw clasesError;
        setClases(clasesData as ClaseDisponible[]);

        // Fetch clubs for filtering
        const { data: clubesData } = await supabase
          .from('organizaciones')
          .select('id, nombre')
          .eq('activa', true);

        if (clubesData) {
          setClubes(clubesData);
        }
      } catch (err: any) {
        console.error('Error loading classes details:', err);
        setError('Ocurrió un error al cargar las clases.');
      } finally {
        setLoading(false);
      }
    };

    initPage();
  }, []);

  const handleReservar = async (clase: ClaseDisponible) => {
    setError(null);
    setSuccess(null);

    // If user is not logged in, redirect immediately to login
    if (!user) {
      router.push('/login');
      return;
    }

    setBookingClaseId(clase.id);

    try {
      // Create reservation
      const { error: insertError } = await supabase
        .from('reservas_clases')
        .insert({
          clase_id: clase.id,
          alumno_id: user.id,
          monto_total_pagado: clase.precio_clase,
          comision_plataforma: 0,
          monto_neto_club: clase.precio_clase,
          estado_pago: 'Aprobado',
          fecha_pago: new Date().toISOString()
        });

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('Ya tienes una reserva para esta clase.');
        }
        throw insertError;
      }

      setSuccess(`¡Tu reserva para la clase de ${clase.deporte} con ${clase.profesor.nombre} ha sido confirmada con éxito!`);
      
    } catch (err: any) {
      setError(err.message || 'Error al procesar la reserva.');
    } finally {
      setBookingClaseId(null);
    }
  };

  const formatHora = (timeStr: string) => {
    return timeStr.substring(0, 5);
  };

  const formatFecha = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' });
  };

  // Apply filters
  const filteredClases = clases.filter(c => {
    // Time filter for today
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (c.fecha === todayStr) {
      const nowH = today.getHours();
      const nowM = today.getMinutes();
      const [cH, cM] = c.hora_inicio.split(':').map(Number);
      if (cH < nowH || (cH === nowH && cM <= nowM)) {
        return false;
      }
    }

    const matchesClub = selectedClub ? c.organizacion_id === Number(selectedClub) : true;
    const matchesSport = selectedSport ? c.deporte === selectedSport : true;
    const matchesLevel = selectedLevel ? c.categoria_target === selectedLevel : true;
    const matchesSearch = searchTerm
      ? (c.profesor?.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.organizacion?.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.deporte || '').toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    return matchesClub && matchesSport && matchesLevel && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10 font-sans relative overflow-hidden transition-colors duration-300 animate-fade-in">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-24 w-96 h-96 bg-accent/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto z-10 relative">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 animate-fade-in">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-3 bg-surface-secondary border border-border rounded-xl hover:bg-surface transition-colors">
              <ArrowLeft size={20} className="text-foreground" />
            </Link>
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                Clases Disponibles
              </h1>
              <p className="text-stone-500 dark:text-stone-400 text-sm mt-1">
                Reserva bloques de entrenamiento y clases de perfeccionamiento con los profesores del club.
              </p>
            </div>
          </div>
          
          {(userRole === 'Profesor' || userRole === 'Organizador' || userRole === 'Ambos') && (
            <Link href="/profesor/clases/nueva" className="bg-primary text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 hover:bg-primary-hover transition-colors shadow-sm shadow-primary/20">
              <Plus size={20} />
              Agregar Clase
            </Link>
          )}
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 text-sm flex items-start gap-3 animate-shake">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm flex items-start gap-3 animate-fade-in">
            <CheckCircle2 className="shrink-0 mt-0.5" size={18} />
            <span>{success}</span>
          </div>
        )}

        {/* Filters Section */}
        <div className="bg-surface border border-border rounded-2xl p-6 mb-8 flex flex-wrap gap-4 items-center animate-fade-in">
          <div className="flex-grow min-w-[250px]">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-2">Buscar</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input
                type="text"
                placeholder="Buscar profesor o club..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface-secondary border border-border focus:border-primary text-foreground rounded-xl py-3 pl-11 pr-4 outline-none text-sm"
              />
            </div>
          </div>

          <div className="min-w-[200px]">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-2">Club / Organización</label>
            <select
              value={selectedClub}
              onChange={(e) => setSelectedClub(e.target.value)}
              className="w-full bg-surface-secondary border border-border focus:border-primary text-foreground rounded-xl p-3 outline-none text-sm cursor-pointer"
            >
              <option value="">Todos los clubes</option>
              {clubes.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[150px]">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-2">Deporte</label>
            <select
              value={selectedSport}
              onChange={(e) => setSelectedSport(e.target.value)}
              className="w-full bg-surface-secondary border border-border focus:border-primary text-foreground rounded-xl p-3 outline-none text-sm"
            >
              <option value="">Todos</option>
              <option value="Tenis">Tenis</option>
              <option value="Padel">Pádel</option>
            </select>
          </div>

          <div className="min-w-[150px]">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-2">Nivel Recomendado</label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full bg-surface-secondary border border-border focus:border-primary text-foreground rounded-xl p-3 outline-none text-sm"
            >
              <option value="">Todos los niveles</option>
              {['SuperA', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D'].map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Classes Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 animate-fade-in">
            <Loader2 className="animate-spin text-primary" size={40} />
            <p className="text-stone-500 text-sm">Cargando clases disponibles...</p>
          </div>
        ) : filteredClases.length === 0 ? (
          <div className="text-center py-20 bg-surface border border-border rounded-2xl animate-fade-in">
            <p className="text-stone-500 text-lg">No se encontraron clases con los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClases.map((clase, idx) => (
              <div 
                key={clase.id} 
                className="bg-surface-secondary/40 border border-border rounded-2xl p-6 flex flex-col hover:bg-surface hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-md group animate-slide-up"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {/* Top Badge header */}
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    clase.deporte === 'Tenis' 
                      ? 'bg-primary/10 text-primary border border-primary/20' 
                      : 'bg-accent/15 text-stone-700 dark:text-accent border border-accent/30'
                  }`}>
                    {clase.deporte === 'Padel' ? 'Pádel' : clase.deporte}
                  </span>
                  
                  <span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Nivel {clase.categoria_target}
                  </span>
                </div>

                {/* Class time details */}
                <h3 className="text-base font-bold mb-2 flex items-center gap-2">
                  <Calendar size={16} className="text-primary shrink-0" />
                  <span className="capitalize">{formatFecha(clase.fecha)}</span>
                </h3>

                <div className="text-stone-550 dark:text-stone-400 text-sm space-y-2.5 mb-6 flex-grow">
                  <p className="flex items-center gap-2">
                    <Clock size={16} className="text-stone-400 shrink-0" />
                    <span>{formatHora(clase.hora_inicio)} - {formatHora(clase.hora_fin)} hs</span>
                  </p>
                  
                  <p className="flex items-center gap-2">
                    <MapPin size={16} className="text-stone-400 shrink-0" />
                    <span className="truncate">{clase.organizacion.nombre}</span>
                  </p>

                  <div className="border-t border-border my-3"></div>

                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0 border border-primary/20">
                      {clase.profesor.nombre[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs text-stone-400 font-bold uppercase tracking-wider">Profesor</p>
                      <p className="text-sm font-semibold">{clase.profesor.nombre}</p>
                    </div>
                  </div>
                </div>

                {/* Price and Book Action */}
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
                  <div>
                    <p className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">Costo</p>
                    <p className="text-lg font-black">${clase.precio_clase.toLocaleString('es-AR')}</p>
                  </div>

                  <button
                    onClick={() => handleReservar(clase)}
                    disabled={bookingClaseId === clase.id}
                    className="bg-primary hover:bg-primary-hover text-white font-bold py-2.5 px-4 rounded-xl text-xs active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
                  >
                    {bookingClaseId === clase.id ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      'Reservar Clase'
                    )}
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
