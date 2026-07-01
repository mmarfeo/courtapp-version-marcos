'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { MapPin, Calendar, Clock, Loader2, ArrowLeft, Grid3X3, Search, Filter, X, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface Cancha {
  id: number;
  organizacion_id: number;
  nombre_club: string;
  numero_cancha: number;
  superficie: string;
  deporte: string;
  activa: boolean;
  precio_hora_dia: number;
  precio_hora_noche: number;
  precio_profesor_hora_dia: number | null;
  precio_profesor_hora_noche: number | null;
  hora_inicio_noche: string;
  organizacion?: {
    nombre: string;
  };
}

interface Alquiler {
  cancha_id: number;
  hora_inicio: string;
  hora_fin: string;
  fecha: string;
  es_semanal?: boolean;
  fecha_fin_recurrencia?: string | null;
}

const getWeekdayUTC = (dateStr: string) => {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return d.getUTCDay();
};

const START_TIMES = [
  '08:00:00', '08:30:00', '09:00:00', '09:30:00', '10:00:00', '10:30:00', '11:00:00', '11:30:00',
  '12:00:00', '12:30:00', '14:00:00', '14:30:00', '15:00:00', '15:30:00', '16:00:00', '16:30:00',
  '17:00:00', '17:30:00', '18:00:00', '18:30:00', '19:00:00', '19:30:00', '20:00:00', '20:30:00',
  '21:00:00', '21:30:00', '22:00:00'
];

const DURATIONS = [
  { label: '60 min', value: 60 },
  { label: '90 min', value: 90 },
  { label: '120 min', value: 120 },
];

export default function AlquilerPage() {
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('Jugador');
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [rentals, setRentals] = useState<Alquiler[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [selectedSport, setSelectedSport] = useState<string>('');
  const [selectedClub, setSelectedClub] = useState<string>('');

  // Date/Time Selection
  const [dates, setDates] = useState<{ label: string; dateStr: string; dayName: string }[]>([]);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedDuration, setSelectedDuration] = useState(90);
  const [selectedCancha, setSelectedCancha] = useState<Cancha | null>(null);
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(null);

  // Modals / Actions
  const [bookingCanchaId, setBookingCanchaId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [esSemanal, setEsSemanal] = useState(false);

  // Parse time string 'HH:mm:ss' to minutes from midnight
  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const isCellSelected = (canchaId: number, hourStr: string) => {
    if (!selectedCancha || selectedCancha.id !== canchaId || !selectedStartTime) return false;
    const startMins = timeToMinutes(selectedStartTime);
    const endMins = startMins + selectedDuration;
    const cellMins = timeToMinutes(hourStr);
    return cellMins >= startMins && cellMins < endMins;
  };

  const getCellSelectionStatus = (canchaId: number, hourStr: string) => {
    if (!selectedCancha || selectedCancha.id !== canchaId || !selectedStartTime) return null;
    const startMins = timeToMinutes(selectedStartTime);
    const endMins = startMins + selectedDuration;
    const cellMins = timeToMinutes(hourStr);
    
    if (cellMins < startMins || cellMins >= endMins) return null;
    
    if (hourStr === selectedStartTime) {
      return {
        isStart: true,
        label: 'INICIO',
        timeRange: `${selectedStartTime.substring(0, 5)} - ${minutesToTime(endMins)}`,
      };
    } else {
      const remainingMins = endMins - cellMins;
      return {
        isStart: false,
        label: `+${remainingMins} min`,
        timeRange: `hasta ${minutesToTime(endMins)}`,
      };
    }
  };

  const checkSlotAvailabilityForDuration = (canchaId: number, hourStr: string) => {
    const startMins = timeToMinutes(hourStr);
    const endMins = startMins + selectedDuration;
    const activeDateStr = dates[selectedDateIndex]?.dateStr;
    if (!activeDateStr) return false;
    return !isTimeSlotRented(canchaId, startMins, endMins, activeDateStr);
  };

  const getEventForCell = (canchaId: number, hourStr: string) => {
    const cellDec = timeToMinutes(hourStr) / 60;
    const activeDateStr = dates[selectedDateIndex]?.dateStr;
    if (!activeDateStr) return null;
    const activeDay = getWeekdayUTC(activeDateStr);
    
    return rentals.find(rental => {
      if (rental.cancha_id !== canchaId) return false;
      let matchesDate = false;
      if (rental.es_semanal) {
        const rentalDay = getWeekdayUTC(rental.fecha);
        const withinRecurrence = (
          activeDateStr >= rental.fecha &&
          (!rental.fecha_fin_recurrencia || activeDateStr <= rental.fecha_fin_recurrencia)
        );
        matchesDate = (activeDay === rentalDay && withinRecurrence);
      } else {
        matchesDate = (rental.fecha === activeDateStr);
      }
      if (!matchesDate) return false;
      const rStart = timeToMinutes(rental.hora_inicio) / 60;
      const rEnd = timeToMinutes(rental.hora_fin) / 60;
      return (cellDec >= rStart && cellDec < rEnd);
    });
  };

  const minutesToTime = (m: number) => {
    const h = Math.floor(m / 60);
    const mins = m % 60;
    return `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
  };

  const calculatePriceForTime = (cancha: Cancha, startTime: string, duration: number = selectedDuration) => {
    const startMins = timeToMinutes(startTime);
    const endMins = startMins + duration;
    const nightStartMins = timeToMinutes(cancha.hora_inicio_noche);

    let dayMins = 0;
    let nightMins = 0;

    if (endMins <= nightStartMins) {
      dayMins = duration;
    } else if (startMins >= nightStartMins) {
      nightMins = duration;
    } else {
      dayMins = nightStartMins - startMins;
      nightMins = endMins - nightStartMins;
    }

    const priceDay = userRole === 'Profesor' && cancha.precio_profesor_hora_dia !== null ? cancha.precio_profesor_hora_dia : cancha.precio_hora_dia;
    const priceNight = userRole === 'Profesor' && cancha.precio_profesor_hora_noche !== null ? cancha.precio_profesor_hora_noche : cancha.precio_hora_noche;

    const price = (dayMins / 60) * priceDay + (nightMins / 60) * priceNight;
    return price;
  };

  useEffect(() => {
    const days = [];
    const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dayName = i === 0 ? 'Hoy' : weekdays[d.getDay()];
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = `${d.getDate()} ${d.toLocaleString('es-AR', { month: 'short' }).replace('.', '')}`;
      days.push({ label, dateStr, dayName });
    }
    setDates(days);
  }, []);

  const fetchData = useCallback(async () => {
    if (dates.length === 0) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);

      if (session?.user) {
        const { data: profile } = await supabase
          .from('perfiles_usuarios')
          .select('roles')
          .eq('id', session.user.id)
          .single();
        if (profile?.roles?.includes('Profesor')) {
          setUserRole('Profesor');
        } else {
          setUserRole('Jugador');
        }
      }

      const activeDate = dates[selectedDateIndex].dateStr;
      
      const { data: canchasData, error: canchasError } = await supabase
        .from('canchas')
        .select('*, organizaciones(nombre)')
        .eq('activa', true);

      if (canchasError) throw canchasError;

      const [
        { data: rentalsData, error: rentalsError },
        { data: clasesData, error: clasesError }
      ] = await Promise.all([
        supabase
          .from('alquileres_cancha')
          .select('cancha_id, hora_inicio, hora_fin, fecha, es_semanal, fecha_fin_recurrencia')
          .or(`fecha.eq.${activeDate},es_semanal.eq.true`)
          .in('estado_pago', ['Aprobado', 'Pendiente']),
        supabase
          .from('clases_disponibles')
          .select('cancha_id, hora_inicio, hora_fin, fecha')
          .eq('fecha', activeDate)
          .eq('activa', true)
      ]);

      if (rentalsError) throw rentalsError;
      if (clasesError) throw clasesError;

      const combined = [
        ...(rentalsData || []),
        ...(clasesData || []).map((c: any) => ({
          ...c,
          es_semanal: false,
          fecha_fin_recurrencia: null,
          estado_pago: 'Aprobado'
        }))
      ];

      setCanchas(canchasData || []);
      setRentals(combined);
    } catch (e: any) {
      console.error('Error fetching courts/rentals:', e);
      setError(e.message || 'Error al obtener la disponibilidad de las canchas.');
    } finally {
      setLoading(false);
    }
  }, [dates, selectedDateIndex]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setSelectedCancha(null);
    setSelectedStartTime(null);
  }, [selectedDateIndex, selectedDuration, selectedClub]);

  const isTimeSlotRented = (canchaId: number, startMins: number, endMins: number, activeDateStr: string) => {
    const activeDay = getWeekdayUTC(activeDateStr);
    return rentals.some((rental) => {
      if (rental.cancha_id !== canchaId) return false;
      let matchesDate = false;
      if (rental.es_semanal) {
        const rentalDay = getWeekdayUTC(rental.fecha);
        const withinRecurrence = (
          activeDateStr >= rental.fecha &&
          (!rental.fecha_fin_recurrencia || activeDateStr <= rental.fecha_fin_recurrencia)
        );
        matchesDate = (activeDay === rentalDay && withinRecurrence);
      } else {
        matchesDate = (rental.fecha === activeDateStr);
      }
      if (!matchesDate) return false;
      const rStart = timeToMinutes(rental.hora_inicio);
      const rEnd = timeToMinutes(rental.hora_fin);
      return (startMins < rEnd && endMins > rStart);
    });
  };

  const handleReservarYPagar = async (cancha: Cancha, startTime: string) => {
    setError(null);

    if (!user) {
      router.push('/login');
      return;
    }

    setBookingCanchaId(cancha.id);
    const activeDate = dates[selectedDateIndex];
    const startTimeMins = timeToMinutes(startTime);
    
    const horaInicio = minutesToTime(startTimeMins);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/pagos/alquiler', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          cancha_id: cancha.id,
          fecha: activeDate.dateStr,
          hora_inicio: horaInicio,
          duracion_minutos: selectedDuration,
          usuario_id: user.id,
          webhook_url: window.location.origin + '/api/webhooks/mercadopago',
          success_url: window.location.origin + '/jugador/dashboard?alquiler_success=true',
          es_semanal: esSemanal,
        }),
      });

      const paymentData = await res.json();
      
      if (!res.ok) {
        throw new Error(paymentData.error || 'Error procesando el pago y reserva en el servidor.');
      }
      
      if (paymentData.init_point) {
        window.location.href = paymentData.init_point;
      } else {
        throw new Error('El servidor no devolvió el enlace de pago de Mercado Pago.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al procesar el alquiler.');
      setBookingCanchaId(null);
    }
  };

  const handleSlotClick = (cancha: Cancha, hourTime: string) => {
    if (selectedCancha?.id === cancha.id && selectedStartTime === hourTime) {
      setSelectedCancha(null);
      setSelectedStartTime(null);
    } else {
      setSelectedCancha(cancha);
      setSelectedStartTime(hourTime);
    }
  };

  const allFilteredCanchas = useMemo(() => {
    return canchas.filter((cancha) => {
      const clubName = cancha.organizaciones?.nombre || cancha.nombre_club || '';
      const matchesSearch =
        clubName.toLowerCase().includes(search.toLowerCase()) ||
        (cancha.superficie || '').toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;
      if (selectedSport && cancha.deporte.toLowerCase() !== selectedSport.toLowerCase()) return false;
      if (selectedClub && clubName !== selectedClub) return false;
      return true;
    }).sort((a, b) => {
      const clubA = a.organizaciones?.nombre || a.nombre_club || '';
      const clubB = b.organizaciones?.nombre || b.nombre_club || '';
      if (clubA !== clubB) return clubA.localeCompare(clubB);
      return a.numero_cancha - b.numero_cancha;
    });
  }, [canchas, search, selectedSport, selectedClub]);

  const uniqueClubs = useMemo(() => {
    const clubs = new Set<string>();
    canchas.forEach(c => {
      const name = c.organizaciones?.nombre || c.nombre_club;
      if (name) clubs.add(name);
    });
    return Array.from(clubs).sort();
  }, [canchas]);

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10 font-sans relative overflow-hidden transition-colors duration-300 animate-fade-in">
      <div className="absolute top-1/4 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-24 w-96 h-96 bg-accent/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto z-10 relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 animate-fade-in">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-3 bg-surface-secondary border border-border rounded-xl hover:bg-surface transition-colors">
              <ArrowLeft size={20} className="text-foreground" />
            </Link>
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                Alquilar Cancha
              </h1>
              <p className="text-stone-500 dark:text-stone-400 text-sm mt-1">
                Busca disponibilidad, elige el tiempo que quieras jugar y paga tu reserva.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-scale-up">
              <button 
                onClick={() => setError(null)}
                className="absolute top-4 right-4 text-stone-400 hover:text-foreground p-1 rounded-lg hover:bg-surface-secondary transition-colors"
              >
                <X size={18} />
              </button>
              
              <div className="flex flex-col items-center text-center py-2">
                <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle size={28} />
                </div>
                <h3 className="text-lg font-bold text-foreground">Error de Reserva</h3>
                <p className="text-stone-500 dark:text-stone-400 text-sm mt-2 leading-relaxed">
                  {error}
                </p>
                <button
                  onClick={() => setError(null)}
                  className="mt-6 w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-xl shadow-md transition-colors"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-surface border border-border rounded-2xl p-6 mb-6 animate-fade-in space-y-6">
          <div>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Calendar size={16} className="text-primary" /> Fecha
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {dates.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedDateIndex(idx)}
                  className={`min-w-[80px] py-3 px-4 rounded-xl text-center border transition-all ${
                    selectedDateIndex === idx 
                      ? 'bg-primary border-primary text-white shadow-md shadow-primary/20 scale-[1.02]' 
                      : 'bg-surface-secondary border-border hover:border-primary/50 text-foreground hover:bg-surface'
                  }`}
                >
                  <div className={`text-xs font-bold uppercase mb-1 ${selectedDateIndex === idx ? 'text-white/90' : 'text-stone-500'}`}>
                    {item.dayName}
                  </div>
                  <div className={`text-sm font-black ${selectedDateIndex === idx ? 'text-white' : 'text-foreground'}`}>
                    {item.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Clock size={16} className="text-primary" /> Duración
            </h3>
            <div className="flex gap-2">
              {DURATIONS.map((dur) => (
                <button
                  key={dur.value}
                  onClick={() => setSelectedDuration(dur.value)}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all border ${
                    selectedDuration === dur.value
                      ? 'bg-primary border-primary text-white'
                      : 'bg-surface-secondary border-border hover:border-primary/50 text-stone-500'
                  }`}
                >
                  {dur.label}
                </button>
              ))}
            </div>
          </div>

          {userRole === 'Profesor' && (
            <div className="pt-4 border-t border-border flex items-center">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={esSemanal}
                  onChange={(e) => setEsSemanal(e.target.checked)}
                  className="w-5 h-5 rounded border-stone-300 dark:border-stone-700 text-primary focus:ring-primary focus:ring-offset-background"
                />
                <div>
                  <span className="text-sm font-bold text-foreground block">
                    Alquiler Semanal Fijo
                  </span>
                  <span className="text-xs text-stone-500 dark:text-stone-400 block">
                    Reservar este día y horario recurrentemente todas las semanas.
                  </span>
                </div>
              </label>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-8 animate-fade-in">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por club, superficie..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors text-foreground"
            />
          </div>
          <div className="w-full sm:w-48 relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <select
              value={selectedSport}
              onChange={(e) => setSelectedSport(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors appearance-none text-foreground"
            >
              <option value="">Todos los deportes</option>
              <option value="Tenis">Tenis</option>
              <option value="Padel">Pádel</option>
            </select>
          </div>

          <div className="w-full sm:w-60 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <select
              value={selectedClub}
              onChange={(e) => setSelectedClub(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors appearance-none text-foreground"
            >
              <option value="">Todos los clubes</option>
              {uniqueClubs.map(club => (
                <option key={club} value={club}>{club}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 animate-fade-in">
            <Loader2 className="animate-spin text-primary" size={40} />
            <p className="text-stone-500 text-sm">Buscando disponibilidad...</p>
          </div>
        ) : allFilteredCanchas.length === 0 ? (
          <div className="text-center py-20 bg-surface border border-border rounded-2xl animate-fade-in">
            <Calendar size={48} className="mx-auto text-stone-300 dark:text-stone-700 mb-4" />
            <p className="text-stone-500 text-lg">No hay canchas disponibles para los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-2xl p-6 mb-6 animate-fade-in space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">Status de Disponibilidad</h2>
                <p className="text-xs text-stone-500 mt-1">Selecciona una hora disponible para la duración de {selectedDuration} minutos.</p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[10px] text-stone-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-500/10 border border-amber-500/20 inline-block" />
                  <span>Ocupado / Reservado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500/[0.04] border border-dashed border-emerald-500/30 inline-block" />
                  <span>Disponible ({selectedDuration} min)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-stone-500/[0.04] border border-stone-500/20 inline-block" />
                  <span>Duración Insuficiente</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-border rounded-xl bg-surface-secondary/15 max-h-[500px] overflow-y-auto">
              <table className="border-collapse w-full text-left" style={{ minWidth: `${100 + allFilteredCanchas.length * 160}px` }}>
                <thead className="sticky top-0 bg-surface-secondary z-10">
                  <tr className="border-b border-border">
                    <th className="w-24 p-3 text-xs font-bold text-stone-400 border-r border-border text-center bg-surface-secondary">
                      Hora
                    </th>
                    {allFilteredCanchas.map(c => (
                      <th key={c.id} className="p-3 text-center border-r border-border/60 last:border-r-0 bg-surface-secondary">
                        <div className="text-[10px] text-primary font-bold truncate max-w-[155px] mx-auto">{c.organizaciones?.nombre || c.nombre_club}</div>
                        <div className="text-sm font-extrabold text-foreground mt-0.5">Cancha {c.numero_cancha}</div>
                        <div className="text-[9px] text-stone-500 font-bold uppercase tracking-wider">{c.deporte} · {c.superficie}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'].map(hourStr => {
                    const hourTime = `${hourStr}:00`;
                    return (
                      <tr key={hourStr} className="border-b border-border/40 hover:bg-surface-secondary/20 transition-colors">
                        <td className="p-0 border-r border-border/40 text-center">
                          <div className="h-12 flex items-center justify-center text-xs font-semibold text-stone-400 font-mono">
                            {hourStr} hs
                          </div>
                        </td>
                        {allFilteredCanchas.map(cancha => {
                          const event = getEventForCell(cancha.id, hourTime);
                          
                          if (event) {
                            return (
                              <td key={cancha.id} className="p-1 border-r border-border/40 last:border-r-0">
                                <div className="h-10 flex flex-col items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-stone-500 font-bold text-[10px] uppercase cursor-not-allowed">
                                  Ocupado
                                </div>
                              </td>
                            );
                          }
                          const price = calculatePriceForTime(cancha, hourTime, 60);
                          const isSelected = isCellSelected(cancha.id, hourTime);
                          
                          if (isSelected) {
                            return (
                              <td key={cancha.id} className="p-1 border-r border-border/40 last:border-r-0">
                                <button
                                  type="button"
                                  onClick={() => handleSlotClick(cancha, selectedStartTime!)}
                                  className="w-full h-10 rounded-lg flex flex-col items-center justify-center bg-gradient-to-r from-primary to-orange-600 border border-primary text-white font-black shadow-md shadow-primary/20 transition-all duration-200"
                                >
                                  <span className="text-[9px] font-extrabold uppercase">Seleccionado</span>
                                  <span className="text-[10px] mt-0.5">${price.toLocaleString('es-AR')}</span>
                                </button>
                              </td>
                            );
                          }
                          
                          const isAvailableForDuration = checkSlotAvailabilityForDuration(cancha.id, hourTime);
                          
                          return (
                            <td key={cancha.id} className="p-1 border-r border-border/40 last:border-r-0">
                              {isAvailableForDuration ? (
                                <button
                                  type="button"
                                  onClick={() => handleSlotClick(cancha, hourTime)}
                                  className="w-full h-10 rounded-lg flex flex-col items-center justify-center border border-dashed border-emerald-500/20 bg-emerald-500/[0.03] hover:bg-primary/10 hover:border-primary/40 text-emerald-500 hover:text-primary transition-all duration-200"
                                >
                                  <span className="text-[9px] font-extrabold uppercase">Reservar</span>
                                  <span className="text-[10px] font-black mt-0.5">${price.toLocaleString('es-AR')}</span>
                                </button>
                              ) : (
                                <div className="w-full h-10 rounded-lg flex items-center justify-center bg-stone-500/[0.04] border border-stone-500/15 text-stone-500 text-[8px] font-bold text-center leading-tight">
                                  Sin espacio<br />para {selectedDuration}m
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {selectedCancha && selectedStartTime && (
              <div className="bg-surface-secondary border border-primary/30 p-5 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4 animate-slide-up shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 text-primary rounded-xl">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Reserva Seleccionada</h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      Cancha {selectedCancha.numero_cancha} ({selectedCancha.deporte}) en <strong className="text-primary">{selectedCancha.organizaciones?.nombre || selectedCancha.nombre_club}</strong>
                    </p>
                    <p className="text-xs text-primary font-bold mt-0.5">
                      {dates[selectedDateIndex]?.label} · {selectedStartTime.substring(0, 5)} hs ({selectedDuration} min)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
                  <div className="text-right hidden sm:block">
                    <span className="text-[10px] text-stone-400 uppercase font-bold tracking-wider block">Total a Pagar</span>
                    <span className="text-lg font-black text-primary">${calculatePriceForTime(selectedCancha, selectedStartTime).toLocaleString('es-AR')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleReservarYPagar(selectedCancha, selectedStartTime)}
                    disabled={bookingCanchaId === selectedCancha.id}
                    className="w-full sm:w-auto bg-primary hover:bg-primary-hover text-white font-bold px-6 py-3 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
                  >
                    {bookingCanchaId === selectedCancha.id ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Procesando...
                      </>
                    ) : (
                      'Alquilar y Pagar'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
