'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { MapPin, Calendar, Clock, Loader2, ArrowLeft, Grid3X3, Search, Filter } from 'lucide-react';
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

  // Date/Time Selection
  const [dates, setDates] = useState<{ label: string; dateStr: string; dayName: string }[]>([]);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedDuration, setSelectedDuration] = useState(90);

  // Modals / Actions
  const [bookingCanchaId, setBookingCanchaId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [esSemanal, setEsSemanal] = useState(false);

  // Parse time string 'HH:mm:ss' to minutes from midnight
  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const minutesToTime = (m: number) => {
    const h = Math.floor(m / 60);
    const mins = m % 60;
    return `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
  };

  const calculatePriceForTime = (cancha: Cancha, startTime: string) => {
    const startMins = timeToMinutes(startTime);
    const endMins = startMins + selectedDuration;
    const nightStartMins = timeToMinutes(cancha.hora_inicio_noche);

    let dayMins = 0;
    let nightMins = 0;

    if (endMins <= nightStartMins) {
      dayMins = selectedDuration;
    } else if (startMins >= nightStartMins) {
      nightMins = selectedDuration;
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
        .select('*, organizacion:organizaciones(nombre)')
        .eq('activa', true);

      if (canchasError) throw canchasError;

      const { data: rentalsData, error: rentalsError } = await supabase
        .from('alquileres_cancha')
        .select('cancha_id, hora_inicio, hora_fin, fecha, es_semanal, fecha_fin_recurrencia')
        .or(`fecha.eq.${activeDate},es_semanal.eq.true`)
        .in('estado_pago', ['Aprobado', 'Pendiente']);

      if (rentalsError) throw rentalsError;

      setCanchas(canchasData || []);
      setRentals(rentalsData || []);
    } catch (e) {
      console.error('Error fetching courts/rentals:', e);
    } finally {
      setLoading(false);
    }
  }, [dates, selectedDateIndex]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const groupedCanchas = useMemo(() => {
    const activeDateStr = dates[selectedDateIndex]?.dateStr;
    if (!activeDateStr) return [];

    const filtered = canchas.filter((cancha) => {
      const clubName = cancha.organizacion?.nombre || cancha.nombre_club || '';
      const matchesSearch =
        clubName.toLowerCase().includes(search.toLowerCase()) ||
        cancha.superficie?.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;
      if (selectedSport && cancha.deporte.toLowerCase() !== selectedSport.toLowerCase()) return false;
      return true;
    });

    const groups: { [key: string]: { clubName: string; canchas: any[] } } = {};
    
    filtered.forEach(cancha => {
      const clubName = cancha.organizacion?.nombre || cancha.nombre_club || 'Sin Club';
      if (!groups[clubName]) {
        groups[clubName] = { clubName, canchas: [] };
      }
      
      const availableSlots = START_TIMES.filter(time => {
        const startMins = timeToMinutes(time);
        const endMins = startMins + selectedDuration;
        return !isTimeSlotRented(cancha.id, startMins, endMins, activeDateStr);
      });

      if (availableSlots.length > 0) {
        groups[clubName].canchas.push({ ...cancha, availableSlots });
      }
    });

    const result = Object.values(groups).filter(g => g.canchas.length > 0);
    result.forEach(g => {
      g.canchas.sort((a, b) => a.numero_cancha - b.numero_cancha);
    });
    return result;
  }, [canchas, search, selectedSport, selectedDuration, dates, selectedDateIndex, rentals]);

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
      const res = await fetch('/api/pagos/alquiler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 text-sm flex items-start gap-3 animate-shake">
            <span>{error}</span>
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
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 animate-fade-in">
            <Loader2 className="animate-spin text-primary" size={40} />
            <p className="text-stone-500 text-sm">Buscando disponibilidad...</p>
          </div>
        ) : groupedCanchas.length === 0 ? (
          <div className="text-center py-20 bg-surface border border-border rounded-2xl animate-fade-in">
            <Calendar size={48} className="mx-auto text-stone-300 dark:text-stone-700 mb-4" />
            <p className="text-stone-500 text-lg">No hay canchas disponibles para los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedCanchas.map((group, gIdx) => (
              <div key={group.clubName} className="animate-slide-up" style={{ animationDelay: `${gIdx * 50}ms` }}>
                <h2 className="text-xl font-bold mb-4 ml-1 flex items-center gap-2">
                  🏢 {group.clubName}
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {group.canchas.map((cancha) => (
                    <div 
                      key={cancha.id} 
                      className="bg-surface border border-border rounded-2xl p-6 flex flex-col hover:border-primary/30 transition-all duration-300 shadow-sm hover:shadow-md"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-foreground">
                            Cancha {cancha.numero_cancha}
                          </h3>
                          <p className="flex items-center gap-2 text-xs text-stone-500 mt-1">
                            <MapPin size={12} className="text-stone-400" />
                            Superficie: {cancha.superficie || 'Standard'}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                          cancha.deporte === 'Tenis' 
                            ? 'bg-primary/10 text-primary border border-primary/20' 
                            : 'bg-accent/15 text-stone-700 dark:text-accent border border-accent/30'
                        }`}>
                          {cancha.deporte === 'Padel' ? 'Pádel' : cancha.deporte}
                        </span>
                      </div>

                      <div className="mt-2 border-t border-border pt-4">
                        <p className="text-[10px] text-stone-400 uppercase font-bold tracking-wider mb-3">Horarios Disponibles</p>
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                          {cancha.availableSlots.map((time: string) => {
                            const price = calculatePriceForTime(cancha, time);
                            return (
                              <button
                                key={time}
                                onClick={() => handleReservarYPagar(cancha, time)}
                                disabled={bookingCanchaId === cancha.id}
                                className="min-w-[70px] bg-surface-secondary hover:bg-primary/10 border border-border hover:border-primary/30 rounded-xl p-2 flex flex-col items-center justify-center transition-all group shrink-0"
                              >
                                <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                  {time.substring(0, 5)}
                                </span>
                                <span className="text-[10px] font-bold text-primary mt-1">
                                  ${price.toLocaleString('es-AR')}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      
                      {bookingCanchaId === cancha.id && (
                        <div className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-primary bg-primary/10 py-2 rounded-xl border border-primary/20">
                          <Loader2 className="animate-spin" size={16} />
                          Procesando reserva...
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
