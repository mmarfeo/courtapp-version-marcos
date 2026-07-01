'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Calendar, Clock, MapPin, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProfesorReservarPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [canchas, setCanchas] = useState<any[]>([]);
  const [clubes, setClubes] = useState<{ id: number, nombre: string }[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  
  const [form, setForm] = useState({
    organizacion_id: null as number | null,
    cancha_id: null as number | null,
    fecha: new Date().toISOString().split('T')[0],
    hora_inicio: '10:00',
    hora_fin: '11:00',
    tipo_reserva: 'unica' as 'unica' | 'fija_semanal' | 'dias_especificos',
    dias_semana: [] as number[],
    fecha_fin_recurrencia: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchCanchas = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;
    setUser(currentUser);

    const { data: userOrgs } = await supabase
      .from('miembros_organizacion')
      .select('organizacion_id')
      .eq('usuario_id', currentUser.id);

    if (userOrgs && userOrgs.length > 0) {
      const orgIds = userOrgs.map((o: any) => o.organizacion_id);
      const { data: canchasData } = await supabase
        .from('canchas')
        .select('*, organizaciones(nombre)')
        .in('organizacion_id', orgIds)
        .eq('activa', true)
        .order('numero_cancha', { ascending: true });
      
      if (canchasData) {
        setCanchas(canchasData);
        const uniqueClubs = new Map();
        canchasData.forEach(c => {
          if (c.organizacion_id) {
            uniqueClubs.set(c.organizacion_id, {
              id: c.organizacion_id,
              nombre: (c.organizaciones as any)?.nombre || 'Sede ' + c.organizacion_id
            });
          }
        });
        const clubsArray = Array.from(uniqueClubs.values());
        setClubes(clubsArray);

        const canchasIds = canchasData.map(c => c.id);
        const [
          { data: rentalsData },
          { data: clasesData }
        ] = await Promise.all([
          supabase
            .from('alquileres_cancha')
            .select('cancha_id, hora_inicio, hora_fin, fecha, es_semanal, fecha_fin_recurrencia, usuario:perfiles_usuarios!usuario_id(nombre, rol)')
            .in('cancha_id', canchasIds)
            .in('estado_pago', ['Aprobado', 'Pendiente']),
          supabase
            .from('clases_disponibles')
            .select('cancha_id, hora_inicio, hora_fin, fecha, profesor:perfiles_usuarios!profesor_id(nombre)')
            .in('cancha_id', canchasIds)
            .eq('activa', true)
        ]);

        const combined = [
          ...(rentalsData || []).map((r: any) => ({
            ...r,
            isClase: false
          })),
          ...(clasesData || []).map((c: any) => ({
            ...c,
            es_semanal: false,
            fecha_fin_recurrencia: null,
            estado_pago: 'Aprobado',
            isClase: true
          }))
        ];
        setRentals(combined);

        if (clubsArray.length > 0) {
          const firstClubId = clubsArray[0].id;
          const firstCancha = canchasData.find(c => c.organizacion_id === firstClubId);
          setForm(prev => ({ 
            ...prev, 
            organizacion_id: firstClubId, 
            cancha_id: firstCancha ? firstCancha.id : null 
          }));
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCanchas();
  }, []);

  const getWeekdayUTC = (dateStr: string) => {
    const parts = dateStr.split('-').map(Number);
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return d.getUTCDay();
  };

  const timeToMinutes = (t: string) => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const checkOverlap = (p: any, r: any) => {
    if (r.cancha_id !== p.cancha_id) return false;

    const pStart = timeToMinutes(p.hora_inicio);
    const pEnd = timeToMinutes(p.hora_fin);
    const rStart = timeToMinutes(r.hora_inicio);
    const rEnd = timeToMinutes(r.hora_fin);
    
    if (pStart >= rEnd || pEnd <= rStart) return false;

    const pDow = getWeekdayUTC(p.fecha);
    const rDow = getWeekdayUTC(r.fecha);
    if (pDow !== rDow) {
      if (!p.es_semanal && !r.es_semanal) {
        return p.fecha === r.fecha;
      }
      return false;
    }

    const pMax = p.fecha_fin_recurrencia || '9999-12-31';
    const rMax = r.fecha_fin_recurrencia || '9999-12-31';

    if (p.es_semanal && r.es_semanal) {
      return p.fecha <= rMax && r.fecha <= pMax;
    }
    if (r.es_semanal && !p.es_semanal) {
      return p.fecha >= r.fecha && p.fecha <= rMax;
    }
    if (p.es_semanal && !r.es_semanal) {
      return r.fecha >= p.fecha && r.fecha <= pMax;
    }
    return p.fecha === r.fecha;
  };

  const getEventForSlot = (canchaId: number, hourStr: string) => {
    const [h, m] = hourStr.split(':').map(Number);
    const nextH = String((h + 1) % 24).padStart(2, '0');
    const nextM = String(m).padStart(2, '0');
    const nextHourStr = `${nextH}:${nextM}`;
    
    const slot = {
      cancha_id: canchaId,
      fecha: form.fecha,
      hora_inicio: hourStr,
      hora_fin: nextHourStr,
      es_semanal: false,
      fecha_fin_recurrencia: null
    };
    
    return rentals.find(r => checkOverlap(slot, r));
  };

  const handleSlotClick = (canchaId: number, hourStr: string) => {
    const [h, m] = hourStr.split(':').map(Number);
    const nextHourStr = `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    if (form.cancha_id !== canchaId) {
      setForm(prev => ({
        ...prev,
        cancha_id: canchaId,
        hora_inicio: hourStr,
        hora_fin: nextHourStr
      }));
      return;
    }

    const startMins = timeToMinutes(form.hora_inicio);
    const clickedMins = timeToMinutes(hourStr);

    if (clickedMins < startMins) {
      setForm(prev => ({
        ...prev,
        hora_inicio: hourStr,
        hora_fin: nextHourStr
      }));
    } else if (clickedMins === startMins) {
      setForm(prev => ({
        ...prev,
        hora_inicio: hourStr,
        hora_fin: nextHourStr
      }));
    } else {
      let hasOverlap = false;
      const startH = parseInt(form.hora_inicio.split(':')[0]);
      const clickedH = h;
      for (let hr = startH; hr <= clickedH; hr++) {
        const checkHourStr = `${String(hr).padStart(2, '0')}:00`;
        if (getEventForSlot(canchaId, checkHourStr)) {
          hasOverlap = true;
          break;
        }
      }

      if (hasOverlap) {
        setForm(prev => ({
          ...prev,
          hora_inicio: hourStr,
          hora_fin: nextHourStr
        }));
      } else {
        setForm(prev => ({
          ...prev,
          hora_fin: nextHourStr
        }));
      }
    }
  };

  const availableCanchas = canchas.filter(c => {
    if (c.organizacion_id !== form.organizacion_id) return false;
    
    const isOccupied = rentals.some(r => checkOverlap({
      cancha_id: c.id,
      fecha: form.fecha,
      hora_inicio: form.hora_inicio,
      hora_fin: form.hora_fin,
      es_semanal: false,
      fecha_fin_recurrencia: null
    }, r));
    
    return !isOccupied;
  });

  useEffect(() => {
    if (availableCanchas.length > 0) {
      if (!form.cancha_id || !availableCanchas.find(c => c.id === form.cancha_id)) {
        setForm(prev => ({ ...prev, cancha_id: availableCanchas[0].id }));
      }
    } else {
      setForm(prev => ({ ...prev, cancha_id: null }));
    }
  }, [availableCanchas, form.cancha_id]);

  const toggleDay = (dayValue: number) => {
    setForm(prev => {
      const isSelected = prev.dias_semana.includes(dayValue);
      const newDays = isSelected 
        ? prev.dias_semana.filter(d => d !== dayValue)
        : [...prev.dias_semana, dayValue];
      return { ...prev, dias_semana: newDays };
    });
  };

  const DAYS_MAP = [
    { label: 'D', value: 0 },
    { label: 'L', value: 1 },
    { label: 'M', value: 2 },
    { label: 'M', value: 3 },
    { label: 'J', value: 4 },
    { label: 'V', value: 5 },
    { label: 'S', value: 6 },
  ];

  const handleSaveReserva = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!form.cancha_id) {
      setErrorMsg('Selecciona una cancha disponible');
      return;
    }
    if (form.tipo_reserva === 'dias_especificos' && form.dias_semana.length === 0) {
      setErrorMsg('Debes seleccionar al menos un día de la semana');
      return;
    }
    if (form.hora_inicio >= form.hora_fin) {
      setErrorMsg('La hora de fin debe ser posterior a la de inicio');
      return;
    }
    
    setSaving(true);
    
    try {
      const selectedCancha = canchas.find(c => c.id === form.cancha_id);
      
      const precioProfDia = Number(selectedCancha?.precio_profesor_hora_dia) || Number(selectedCancha?.precio_hora_dia) || 0;
      const precioProfNoche = Number(selectedCancha?.precio_profesor_hora_noche) || Number(selectedCancha?.precio_hora_noche) || 0;
      
      const [hInicio, mInicio] = form.hora_inicio.split(':').map(Number);
      const [hFin, mFin] = form.hora_fin.split(':').map(Number);
      const startDecimal = hInicio + mInicio / 60;
      const endDecimal = hFin + mFin / 60;
      
      let horasDia = 0;
      let horasNoche = 0;
      const NIGHT_START = 18; 

      if (startDecimal >= NIGHT_START) {
        horasNoche = endDecimal - startDecimal;
      } else if (endDecimal <= NIGHT_START) {
        horasDia = endDecimal - startDecimal;
      } else {
        horasDia = NIGHT_START - startDecimal;
        horasNoche = endDecimal - NIGHT_START;
      }

      const montoCalculado = (horasDia * precioProfDia) + (horasNoche * precioProfNoche);
      
      const insertData = [];
      
      const parts = form.fecha.split('-');
      let currentDate = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
      
      const endParts = form.fecha_fin_recurrencia.split('-');
      const endDate = form.tipo_reserva !== 'unica' 
        ? new Date(Number(endParts[0]), Number(endParts[1])-1, Number(endParts[2])) 
        : new Date(currentDate);
      
      while (currentDate <= endDate) {
        let shouldInsert = false;
        let esFijaSemanal = false;
        
        if (form.tipo_reserva === 'unica') {
          shouldInsert = true;
        } else if (form.tipo_reserva === 'dias_especificos') {
          shouldInsert = form.dias_semana.includes(currentDate.getDay());
        } else if (form.tipo_reserva === 'fija_semanal') {
          // Si es fija semanal, verificamos que sea el mismo día de la semana que el día original de la fecha
          const originalDay = new Date(form.fecha + 'T12:00:00').getDay();
          shouldInsert = currentDate.getDay() === originalDay;
          esFijaSemanal = true;
        }

        if (shouldInsert) {
          const y = currentDate.getFullYear();
          const m = String(currentDate.getMonth() + 1).padStart(2, '0');
          const d = String(currentDate.getDate()).padStart(2, '0');
          insertData.push({
            cancha_id: form.cancha_id,
            usuario_id: user?.id,
            fecha: `${y}-${m}-${d}`,
            hora_inicio: form.hora_inicio,
            hora_fin: form.hora_fin,
            monto_total: montoCalculado, 
            comision_plataforma: 0,
            monto_neto_club: montoCalculado,
            estado_pago: 'Pendiente',
            es_semanal: esFijaSemanal,
            fecha_fin_recurrencia: form.tipo_reserva !== 'unica' ? form.fecha_fin_recurrencia : null
          });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (insertData.length === 0) {
        throw new Error("No hay fechas seleccionadas para crear la reserva");
      }

      const { error } = await supabase.from('alquileres_cancha').insert(insertData);
      if (error) throw error;
      
      setSuccessMsg(`Reserva${insertData.length > 1 ? 's' : ''} creada${insertData.length > 1 ? 's' : ''} con éxito (${insertData.length} turnos)`);
      await fetchCanchas();
      
      setTimeout(() => {
        router.push('/profesor/agenda');
      }, 2000);
      
    } catch (error: any) {
      setErrorMsg(error.message || 'Error al guardar la reserva');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-stone-400">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p>Cargando información...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 animate-fade-in pb-24">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
          <Calendar className="text-primary" size={32} />
          Reservar Cancha
        </h1>
        <p className="text-muted mt-2">
          Reserva canchas para dar tus clases. Si alquilas de forma recurrente, se crearán los turnos hasta la fecha límite.
        </p>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6 space-y-6">
        
        {errorMsg && (
          <div className="p-4 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 text-sm font-medium">
            {errorMsg}
          </div>
        )}
        
        {successMsg && (
          <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20 text-sm font-medium flex items-center gap-2">
            <CheckCircle2 size={18} />
            {successMsg}
          </div>
        )}

        {/* Sede/Club y Fecha selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {clubes.length >= 1 && (
            <div className="space-y-3 md:col-span-2">
              <label className="text-sm font-medium text-muted flex items-center gap-2">
                <MapPin size={16} /> Sede / Club
              </label>
              <div className="flex flex-wrap gap-2">
                {clubes.map(club => (
                  <button
                    key={club.id}
                    onClick={() => {
                      const firstCancha = canchas.find(c => c.organizacion_id === club.id);
                      setForm(prev => ({ 
                        ...prev, 
                        organizacion_id: club.id, 
                        cancha_id: firstCancha ? firstCancha.id : null 
                      }));
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${form.organizacion_id === club.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surface-secondary text-foreground hover:bg-surface border border-border'}`}
                  >
                    {club.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label className="text-sm font-medium text-muted flex items-center gap-2">
              <Calendar size={16} /> Fecha de Reserva
            </label>
            <input 
              type="date"
              className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            />
          </div>
        </div>

        {/* Visual Court Availability Grid */}
        {form.organizacion_id && (
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <label className="text-sm font-medium text-muted flex items-center gap-2">
                <Clock size={16} /> Disponibilidad de Canchas ({form.fecha.split('-').reverse().join('/')})
              </label>
              {form.cancha_id && form.hora_inicio && form.hora_fin && (
                <div className="text-sm font-semibold bg-primary/10 border border-primary/20 text-primary px-4 py-2 rounded-xl flex items-center gap-2 animate-fade-in shadow-lg shadow-primary/5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span>Cancha {canchas.find(c => c.id === form.cancha_id)?.numero_cancha} seleccionada:</span>
                  <span className="font-extrabold text-foreground">{form.hora_inicio} hs - {form.hora_fin} hs</span>
                </div>
              )}
            </div>
            
            {/* Leyenda */}
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted px-1 py-1">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-500/20 border-l-2 border-blue-500 inline-block" />
                <span>Clase Particular</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-purple-500/20 border-l-2 border-purple-500 inline-block" />
                <span>Reserva Profesor</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500/20 border-l-2 border-amber-500 inline-block" />
                <span>Alquiler Cliente</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500/5 border border-dashed border-emerald-500/30 inline-block" />
                <span>Disponible (Click para seleccionar)</span>
              </div>
            </div>

            {/* Grid Table */}
            <div className="overflow-x-auto border border-border rounded-xl bg-surface-secondary max-h-[350px] overflow-y-auto">
              <table className="border-collapse w-full text-left" style={{ minWidth: `${100 + canchas.filter(c => c.organizacion_id === form.organizacion_id).length * 150}px` }}>
                <thead className="sticky top-0 bg-surface z-10">
                  <tr className="border-b border-border">
                    <th className="w-24 p-3 text-xs font-bold text-muted border-r border-border text-center bg-surface">
                      Hora
                    </th>
                    {canchas.filter(c => c.organizacion_id === form.organizacion_id).map(c => (
                      <th key={c.id} className="p-3 text-center border-r border-border/60 last:border-r-0 bg-surface">
                        <div className="text-sm font-extrabold text-foreground">Cancha {c.numero_cancha}</div>
                        <div className="text-[10px] text-muted/80 font-bold uppercase tracking-wider mt-0.5">{c.deporte} · {c.superficie}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 17 }, (_, i) => {
                     const h = i + 7;
                     const hourStr = `${h.toString().padStart(2, '0')}:00`;
                     return (
                      <tr key={hourStr} className="border-b border-border/40 hover:bg-surface-secondary/50 transition-colors">
                        <td className="p-0 border-r border-border/40 text-center">
                          <div className="h-12 flex items-center justify-center text-xs font-semibold text-muted">
                            {hourStr}
                          </div>
                        </td>
                        {canchas.filter(c => c.organizacion_id === form.organizacion_id).map(cancha => {
                          const event = getEventForSlot(cancha.id, hourStr);
                          
                          if (event) {
                            const isClase = event.isClase;
                            const isProf = event.usuario?.rol?.toLowerCase() === 'profesor';
                            
                            let bgClass = 'bg-amber-500/10 border-amber-500/60 text-amber-300';
                            let label = event.usuario?.nombre || 'Reservado';
                            let subLabel = 'Alquiler Cliente';
                            
                            if (isClase) {
                              bgClass = 'bg-blue-500/10 border-blue-500/60 text-blue-300';
                              label = event.profesor?.nombre || 'Clase';
                              subLabel = 'Clase Particular';
                            } else if (isProf) {
                              bgClass = 'bg-purple-500/10 border-purple-500/60 text-purple-300';
                              label = `Prof. ${event.usuario?.nombre || ''}`;
                              subLabel = 'Reserva Profesor';
                            }
                            
                            return (
                              <td key={cancha.id} className="p-1 border-r border-border/40 last:border-r-0">
                                <div className={`h-10 flex flex-col items-start justify-center rounded-lg border-l-[3px] px-3 ${bgClass}`}>
                                  <div className="font-extrabold text-[10px] truncate w-full">
                                    {label}
                                  </div>
                                  <div className="text-[8px] opacity-80 font-bold">
                                    {subLabel}
                                  </div>
                                </div>
                              </td>
                            );
                          }
                          
                          // Slot is free (Disponible)
                          const isSelected = form.cancha_id === cancha.id && 
                            timeToMinutes(form.hora_inicio) <= timeToMinutes(hourStr) && 
                            timeToMinutes(form.hora_fin) > timeToMinutes(hourStr);
                          
                          return (
                            <td key={cancha.id} className="p-1 border-r border-border/45 last:border-r-0">
                              <button
                                type="button"
                                onClick={() => handleSlotClick(cancha.id, hourStr)}
                                className={`w-full h-10 rounded-lg flex items-center justify-center border text-[10px] font-bold tracking-wide transition-all duration-200 ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-primary to-orange-600 border-transparent text-white shadow-md shadow-primary/20 scale-[1.01]'
                                    : 'bg-emerald-500/[0.03] border-dashed border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40'
                                }`}
                              >
                                {isSelected ? 'SELECCIONADO' : 'DISPONIBLE'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Court pricing details if selected */}
        {form.cancha_id && (
          <div className="mt-4 bg-surface-secondary p-4 rounded-xl border border-border flex flex-col sm:flex-row gap-4 sm:gap-8 justify-between items-center animate-fade-in">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 w-full sm:w-auto">
              <div>
                <p className="text-sm text-muted">Precio Día (sin luz)</p>
                <p className="text-lg font-bold text-foreground">${canchas.find(c => c.id === form.cancha_id)?.precio_profesor_hora_dia || canchas.find(c => c.id === form.cancha_id)?.precio_hora_dia || 0} <span className="text-sm font-normal text-muted">/ hr</span></p>
              </div>
              <div>
                <p className="text-sm text-muted">Precio Noche (con luz)</p>
                <p className="text-lg font-bold text-foreground">${canchas.find(c => c.id === form.cancha_id)?.precio_profesor_hora_noche || canchas.find(c => c.id === form.cancha_id)?.precio_hora_noche || 0} <span className="text-sm font-normal text-muted">/ hr</span></p>
              </div>
            </div>
            <div className="text-xs text-muted italic text-right w-full sm:w-auto">
              * El precio total se calcula automáticamente al confirmar la reserva.
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-border space-y-4">
          <label className="text-sm font-medium text-muted">Tipo de Reserva</label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setForm({ ...form, tipo_reserva: 'unica' })}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all border ${
                form.tipo_reserva === 'unica'
                  ? 'bg-primary border-primary text-white'
                  : 'bg-surface-secondary border-border text-foreground hover:bg-surface'
              }`}
            >
              Una vez
            </button>
            <button
              onClick={() => setForm({ ...form, tipo_reserva: 'fija_semanal' })}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all border ${
                form.tipo_reserva === 'fija_semanal'
                  ? 'bg-primary border-primary text-white'
                  : 'bg-surface-secondary border-border text-foreground hover:bg-surface'
              }`}
            >
              Fija Semanal
            </button>
            <button
              onClick={() => setForm({ ...form, tipo_reserva: 'dias_especificos' })}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all border ${
                form.tipo_reserva === 'dias_especificos'
                  ? 'bg-primary border-primary text-white'
                  : 'bg-surface-secondary border-border text-foreground hover:bg-surface'
              }`}
            >
              Días específicos
            </button>
          </div>

          {form.tipo_reserva === 'dias_especificos' && (
            <div className="space-y-2 pt-2 animate-fade-in">
              <label className="text-sm font-medium text-muted">Días de la semana</label>
              <div className="flex justify-between max-w-md">
                {DAYS_MAP.map(d => {
                  const isSelected = form.dias_semana.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      onClick={() => toggleDay(d.value)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all border ${
                        isSelected 
                          ? 'bg-primary border-primary text-white shadow-md shadow-primary/20' 
                          : 'bg-surface-secondary border-border text-foreground hover:bg-surface'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {form.tipo_reserva !== 'unica' && (
            <div className="space-y-2 pt-2 animate-fade-in">
              <label className="text-sm font-medium text-muted">Fecha Límite</label>
              <input 
                type="date"
                className="w-full sm:w-1/2 bg-surface border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                value={form.fecha_fin_recurrencia}
                onChange={(e) => setForm({ ...form, fecha_fin_recurrencia: e.target.value })}
              />
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-border flex justify-end gap-4">
          <button
            onClick={handleSaveReserva}
            disabled={saving || !form.cancha_id}
            className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Confirmar Reserva'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
