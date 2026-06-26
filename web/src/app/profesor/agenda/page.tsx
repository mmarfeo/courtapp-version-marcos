'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon, Clock, MapPin, CheckCircle2, ArrowLeft,
  Users, TrendingUp, BookOpen, Landmark, ChevronRight, Award, Loader2, Sparkles, Plus,
  Settings, Check, X, AlertCircle, Edit2, Trash2, RefreshCw, ChevronLeft, ChevronRight as ChevronRightIcon
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function AgendaProfesorPage() {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [canchas, setCanchas] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  // Workday configurations (0 to 24) persistable
  const [startHour, setStartHour] = useState<number>(8); // 8:00 AM
  const [endHour, setEndHour] = useState<number>(20);  // 8:00 PM

  // Day Switcher state
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Quick class creator modal state
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  
  // Quick form states (Creation)
  const [deporte, setDeporte] = useState('Tenis');
  const [categoria, setCategoria] = useState('B');
  const [canchaId, setCanchaId] = useState<string>('');
  const [cupo, setCupo] = useState<number | string>(2);
  const [precio, setPrecio] = useState<number | string>(12000);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [esSemanal, setEsSemanal] = useState(false);
  
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedClassToEdit, setSelectedClassToEdit] = useState<any>(null);
  
  // Edit form states
  const [editDeporte, setEditDeporte] = useState('Tenis');
  const [editCategoria, setEditCategoria] = useState('B');
  const [editCanchaId, setEditCanchaId] = useState<string>('');
  const [editCupo, setEditCupo] = useState<number | string>(2);
  const [editPrecio, setEditPrecio] = useState<number | string>(12000);
  const [editActiva, setEditActiva] = useState(true);
  const [editEsSemanal, setEditEsSemanal] = useState(false);
  const [editHoraInicio, setEditHoraInicio] = useState('');
  const [canEditTime, setCanEditTime] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Students view modal state
  const [selectedClassForStudents, setSelectedClassForStudents] = useState<any>(null);

  // 1. Get today string in local time YYYY-MM-DD
  const todayStr = useMemo(() => {
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
  }, []);

  // Navigator start date (starting point of the 7-day horizontal view)
  const [navigatorStartDate, setNavigatorStartDate] = useState<string>('');

  // 2. Initialize selectedDate and navigatorStartDate to today on mount
  useEffect(() => {
    setSelectedDate(todayStr);
    setNavigatorStartDate(todayStr);

    // Load persisted workday configuration
    const savedStart = localStorage.getItem('courtup-teacher-start');
    const savedEnd = localStorage.getItem('courtup-teacher-end');
    if (savedStart) setStartHour(Number(savedStart));
    if (savedEnd) setEndHour(Number(savedEnd));
  }, [todayStr]);

  const handlePrevWeek = () => {
    if (!navigatorStartDate) return;
    const d = new Date(navigatorStartDate + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    const prevWeekStr = d.toISOString().split('T')[0];
    setNavigatorStartDate(prevWeekStr);
    setSelectedDate(prevWeekStr);
  };

  const handleNextWeek = () => {
    if (!navigatorStartDate) return;
    const d = new Date(navigatorStartDate + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    const nextWeekStr = d.toISOString().split('T')[0];
    setNavigatorStartDate(nextWeekStr);
    setSelectedDate(nextWeekStr);
  };

  const handleStartHourChange = (val: number) => {
    setStartHour(val);
    localStorage.setItem('courtup-teacher-start', val.toString());
    if (endHour <= val) {
      setEndHour(val + 1);
      localStorage.setItem('courtup-teacher-end', (val + 1).toString());
    }
  };

  const handleEndHourChange = (val: number) => {
    setEndHour(val);
    localStorage.setItem('courtup-teacher-end', val.toString());
  };

  const fetchTeacherData = async () => {
    try {
      setLoading(true);
      
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;
      setUser(currentUser);

      const { data: userOrgs } = await supabase
        .from('miembros_organizacion')
        .select('organizacion_id')
        .eq('usuario_id', currentUser.id);

      let orgIds = userOrgs?.map(o => o.organizacion_id) || [];
      
      if (orgIds.length === 0) orgIds.push(-1);

      const [classesRes, canchasRes] = await Promise.all([
        supabase
          .from('clases_disponibles')
          .select(`
            *,
            canchas(*),
            reservas_clases(
              *,
              alumno:perfiles_usuarios!usuario_id(*)
            )
          `)
          .eq('profesor_id', currentUser.id)
          .order('fecha', { ascending: true })
          .order('hora_inicio', { ascending: true }),
        supabase
          .from('canchas')
          .select('*')
          .eq('activa', true)
          .in('organizacion_id', orgIds)
      ]);

      if (classesRes.error) throw classesRes.error;
      if (canchasRes.error) throw canchasRes.error;

      setClasses(classesRes.data || []);
      const fetchedCanchas = canchasRes.data || [];
      setCanchas(fetchedCanchas);
      if (fetchedCanchas.length > 0 && !canchaId) {
        setCanchaId(fetchedCanchas[0].id.toString());
      }
    } catch (err) {
      console.error("Error al obtener agenda del profesor:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeacherData();
  }, []);

  // Convert "HH:MM:SS" or "HH:MM" to decimal hours (e.g. "10:30" -> 10.5)
  const timeToDecimal = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
  };

  // Generate 7 upcoming days list for navigation starting from navigatorStartDate
  const next7Days = useMemo(() => {
    if (!navigatorStartDate) return [];
    const list = [];
    const daysName = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const baseDate = new Date(navigatorStartDate + 'T00:00:00');

    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const dateString = d.toISOString().split('T')[0];
      const labelDay = daysName[d.getDay()];
      const labelNum = d.getDate();
      
      const dayOfWeek = d.getDay();
      const hasClass = classes.some(c => {
        const classDateStr = c.fecha ? c.fecha.substring(0, 10) : '';
        if (classDateStr === dateString) return true;
        if (c.es_semanal) {
          return new Date(classDateStr + 'T00:00:00').getDay() === dayOfWeek && classDateStr <= dateString;
        }
        return false;
      });

      list.push({
        dateString,
        labelDay,
        labelNum,
        hasClass
      });
    }
    return list;
  }, [classes, navigatorStartDate]);

  // Active selected day classes (including weekly recurring)
  const activeDayClasses = useMemo(() => {
    if (!selectedDate) return [];
    const targetDateObj = new Date(selectedDate + 'T00:00:00');
    const targetDay = targetDateObj.getDay();

    return classes.filter(c => {
      const classDateStr = c.fecha ? c.fecha.substring(0, 10) : '';
      if (classDateStr === selectedDate) return true;
      if (c.es_semanal) {
        const classStart = new Date(classDateStr + 'T00:00:00');
        return classStart.getDay() === targetDay && classDateStr <= selectedDate;
      }
      return false;
    });
  }, [classes, selectedDate]);

  // Fixed bug: "upcomingClasses" must show classes whose start time is in the future starting from CURRENT hour if it's today
  // It must also correctly evaluate weekly recurring classes (es_semanal) occurrences in the next 14 days.
  const upcomingClasses = useMemo(() => {
    const now = new Date();
    const currentDecimalHour = now.getHours() + now.getMinutes() / 60;
    const allOccurrences: any[] = [];

    classes.forEach(c => {
      const classDateStr = c.fecha ? c.fecha.substring(0, 10) : '';
      if (!classDateStr) return;

      if (!c.es_semanal) {
        // Single occurrences
        if (classDateStr > todayStr) {
          allOccurrences.push({ ...c, dateString: classDateStr });
        } else if (classDateStr === todayStr) {
          if (timeToDecimal(c.hora_inicio) >= currentDecimalHour) {
            allOccurrences.push({ ...c, dateString: classDateStr });
          }
        }
      } else {
        // Weekly recurring occurrences over the next 14 days (today + 13 days)
        const classStartDay = new Date(classDateStr + 'T00:00:00').getDay();
        for (let i = 0; i < 14; i++) {
          const d = new Date();
          d.setDate(d.getDate() + i);
          const dateString = d.toISOString().split('T')[0];

          if (dateString >= classDateStr) {
            if (d.getDay() === classStartDay) {
              if (dateString > todayStr) {
                allOccurrences.push({ ...c, dateString });
              } else if (dateString === todayStr) {
                if (timeToDecimal(c.hora_inicio) >= currentDecimalHour) {
                  allOccurrences.push({ ...c, dateString });
                }
              }
            }
          }
        }
      }
    });

    // Sort by date, then by start time
    return allOccurrences.sort((a, b) => {
      if (a.dateString !== b.dateString) {
        return a.dateString.localeCompare(b.dateString);
      }
      return timeToDecimal(a.hora_inicio) - timeToDecimal(b.hora_inicio);
    });
  }, [classes, todayStr]);

  // Calculations for selected active day
  const teacherStats = useMemo(() => {
    const classesTodayCount = activeDayClasses.length;

    const activeBookingsToday = activeDayClasses.reduce((acc, curr) => {
      const approvedReservations = (curr.reservas_clases || []).filter((r: any) => r.estado_pago === 'Aprobado');
      return acc + approvedReservations.length;
    }, 0);

    const maxCapacityToday = activeDayClasses.reduce((acc, curr) => acc + (curr.cupo_maximo || 1), 0);
    const occupancyRate = maxCapacityToday > 0 ? (activeBookingsToday / maxCapacityToday) * 100 : 0;

    const netRevenueToday = activeDayClasses.reduce((acc, curr) => {
      const approved = (curr.reservas_clases || []).filter((r: any) => r.estado_pago === 'Aprobado');
      return acc + approved.reduce((sum: number, r: any) => sum + Number(r.monto_neto_club || 0), 0);
    }, 0);

    return {
      classesTodayCount,
      activeBookingsToday,
      maxCapacityToday,
      occupancyRate,
      netRevenueToday
    };
  }, [activeDayClasses]);

  // Timeline Hour/Half-hour by Half-hour Generator
  const workdayTimeline = useMemo(() => {
    const slots = [];
    
    // Create 30-minute interval slots
    for (let hour = startHour; hour < endHour; hour += 0.5) {
      const hStr = Math.floor(hour).toString().padStart(2, '0');
      const mStr = (hour % 1 === 0) ? '00' : '30';
      const timeString = `${hStr}:${mStr}`;
      
      const nextHour = hour + 0.5;
      const nextHStr = Math.floor(nextHour).toString().padStart(2, '0');
      const nextMStr = (nextHour % 1 === 0) ? '00' : '30';
      const endString = `${nextHStr}:${nextMStr}`;

      const startClass = activeDayClasses.find(c => {
        const classStart = timeToDecimal(c.hora_inicio);
        return Math.abs(classStart - hour) < 0.01;
      });

      const ongoingClass = activeDayClasses.find(c => {
        const classStart = timeToDecimal(c.hora_inicio);
        const classEnd = timeToDecimal(c.hora_fin);
        return hour >= classStart - 0.01 && hour < classEnd - 0.01;
      });

      slots.push({
        hour,
        timeString,
        endString,
        isStartOfClass: !!startClass,
        isOccupied: !!ongoingClass,
        clase: startClass || ongoingClass || null
      });
    }
    return slots;
  }, [activeDayClasses, startHour, endHour]);

  // Find Contiguous Gaps/Free hours between classes
  const freeHourGaps = useMemo(() => {
    const gaps = [];
    let gapStart: number | null = null;
    
    for (let hour = startHour; hour < endHour; hour += 0.5) {
      const isOccupied = activeDayClasses.some(c => {
        const start = timeToDecimal(c.hora_inicio);
        const end = timeToDecimal(c.hora_fin);
        return hour >= start - 0.01 && hour < end - 0.01;
      });

      if (!isOccupied) {
        if (gapStart === null) {
          gapStart = hour;
        }
      } else {
        if (gapStart !== null) {
          gaps.push({
            start: gapStart,
            end: hour,
            duration: hour - gapStart
          });
          gapStart = null;
        }
      }
    }

    if (gapStart !== null) {
      gaps.push({
        start: gapStart,
        end: endHour,
        duration: endHour - gapStart
      });
    }

    return gaps.map(g => {
      const startH = Math.floor(g.start);
      const startM = (g.start % 1 === 0) ? '00' : '30';
      const endH = Math.floor(g.end);
      const endM = (g.end % 1 === 0) ? '00' : '30';
      
      let durationLabel = '';
      if (g.duration === 0.5) durationLabel = '30 min';
      else if (g.duration === 1.0) durationLabel = '1 h';
      else if (g.duration === 1.5) durationLabel = '1.5 h';
      else durationLabel = `${g.duration} hs`;

      return {
        start: g.start,
        startLabel: `${startH.toString().padStart(2, '0')}:${startM}`,
        duration: g.duration,
        durationLabel,
        timeLabel: `${startH.toString().padStart(2, '0')}:${startM} - ${endH.toString().padStart(2, '0')}:${endM}`
      };
    });
  }, [activeDayClasses, startHour, endHour]);

  const handleOpenQuickCreate = (hourString: string) => {
    setSelectedTimeSlot(hourString);
    setEsSemanal(false);
    setCreateError(null);
    setQuickCreateOpen(true);
  };

  const handleOpenEdit = (clase: any) => {
    setSelectedClassToEdit(clase);
    setEditDeporte(clase.deporte);
    setEditCategoria(clase.categoria_target);
    setEditCanchaId(clase.cancha_id ? clase.cancha_id.toString() : '');
    setEditCupo(clase.cupo_maximo);
    setEditPrecio(clase.precio_clase);
    setEditActiva(clase.activa !== false);
    setEditEsSemanal(clase.es_semanal === true);
    setSaveError(null);
    setEditHoraInicio(clase.hora_inicio.slice(0, 5));
    const now = new Date();
    const classDate = new Date(`${clase.fecha}T${clase.hora_inicio}`);
    setCanEditTime(classDate.getTime() - now.getTime() > 5 * 60 * 1000);
    setEditModalOpen(true);
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreating(true);
    setCreateError(null);

    const [h, m] = selectedTimeSlot.split(':');
    let startHourInt = parseInt(h);
    let startMinInt = parseInt(m);

    let endMinInt = startMinInt + durationMinutes;
    if (endMinInt >= 60) {
      startHourInt += Math.floor(endMinInt / 60);
      endMinInt = endMinInt % 60;
    }

    const startHourStr = `${selectedTimeSlot}:00`;
    const endHourStr = `${startHourInt.toString().padStart(2, '0')}:${endMinInt.toString().padStart(2, '0')}:00`;

    try {
      const { error } = await supabase
        .from('clases_disponibles')
        .insert([{
          profesor_id: user.id,
          organizacion_id: canchas.find(c => c.id.toString() === canchaId)?.organizacion_id || null,
          cancha_id: canchaId ? parseInt(canchaId) : null,
          deporte,
          categoria_target: categoria,
          fecha: selectedDate,
          hora_inicio: startHourStr,
          hora_fin: endHourStr,
          cupo_maximo: cupo,
          precio_clase: precio,
          activa: true,
          es_semanal: esSemanal
        }]);

      if (error) throw error;
      
      setQuickCreateOpen(false);
      fetchTeacherData();
    } catch (err: any) {
      console.error(err);
      setCreateError(err.message || "No se pudo publicar la clase.");
    } finally {
      setCreating(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassToEdit) return;
    
    const hasActiveStudents = selectedClassToEdit.reservas_clases && selectedClassToEdit.reservas_clases.some((r: any) => r.estado_pago !== 'Rechazado' && r.estado_pago !== 'Reembolsado');
    if (hasActiveStudents) {
      setSaveError('No puedes modificar una clase que ya tiene alumnos inscriptos. El alumno debe darse de baja primero.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      let finalHoraInicio = selectedClassToEdit.hora_inicio;
      let finalHoraFin = selectedClassToEdit.hora_fin;

      if (canEditTime && editHoraInicio && editHoraInicio !== selectedClassToEdit.hora_inicio.slice(0, 5)) {
        const [h, m] = editHoraInicio.split(':').map(Number);
        const newStart = h + m / 60;
        const originalStart = parseInt(selectedClassToEdit.hora_inicio.split(':')[0]) + parseInt(selectedClassToEdit.hora_inicio.split(':')[1]) / 60;
        const originalEnd = parseInt(selectedClassToEdit.hora_fin.split(':')[0]) + parseInt(selectedClassToEdit.hora_fin.split(':')[1]) / 60;
        const dur = originalEnd - originalStart;
        const newEnd = newStart + dur;

        const targetDateObj = new Date(selectedClassToEdit.fecha + 'T00:00:00');
        const targetDay = targetDateObj.getDay();

        const hasOverlap = classes.some(c => {
          if (c.id === selectedClassToEdit.id) return false;
          const classDateStr = c.fecha ? c.fecha.substring(0, 10) : '';
          let isSameDay = false;
          if (classDateStr === selectedClassToEdit.fecha) isSameDay = true;
          else if (c.es_semanal) {
            const classStartDay = new Date(classDateStr + 'T00:00:00').getDay();
            if (classStartDay === targetDay && classDateStr <= selectedClassToEdit.fecha) isSameDay = true;
          }

          if (isSameDay) {
            const [c_h, c_m] = c.hora_inicio.split(':').map(Number);
            const [c_eh, c_em] = c.hora_fin.split(':').map(Number);
            const classStart = c_h + c_m / 60;
            const classEnd = c_eh + c_em / 60;
            return newStart < classEnd && newEnd > classStart;
          }
          return false;
        });

        if (hasOverlap) {
          throw new Error('Ya tienes otra clase en este horario, no puedes superponerla.');
        }

        finalHoraInicio = `${editHoraInicio}:00`;
        const endHStr = Math.floor(newEnd).toString().padStart(2, '0');
        const endMStr = Math.round((newEnd % 1) * 60).toString().padStart(2, '0');
        finalHoraFin = `${endHStr}:${endMStr}:00`;
      }

      const { error } = await supabase
        .from('clases_disponibles')
        .update({
          deporte: editDeporte,
          categoria_target: editCategoria,
          cancha_id: editCanchaId ? parseInt(editCanchaId) : null,
          organizacion_id: canchas.find(c => c.id.toString() === editCanchaId)?.organizacion_id || selectedClassToEdit.organizacion_id,
          cupo_maximo: editCupo,
          precio_clase: editPrecio,
          activa: editActiva,
          es_semanal: editEsSemanal,
          hora_inicio: finalHoraInicio,
          hora_fin: finalHoraFin
        })
        .eq('id', selectedClassToEdit.id);

      if (error) throw error;

      setEditModalOpen(false);
      fetchTeacherData();
    } catch (err: any) {
      console.error(err);
      setSaveError(err.message || "No se pudo guardar la clase.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClass = async () => {
    if (!selectedClassToEdit) return;
    if (!canEditTime) {
      setSaveError("No puedes eliminar la clase porque faltan menos de 5 minutos para su inicio.");
      return;
    }

    const hasActiveStudents = selectedClassToEdit.reservas_clases && selectedClassToEdit.reservas_clases.some((r: any) => r.estado_pago !== 'Rechazado' && r.estado_pago !== 'Reembolsado');
    if (hasActiveStudents) {
      setSaveError('No puedes eliminar una clase que ya tiene alumnos inscriptos. El alumno debe darse de baja primero.');
      return;
    }

    if (!confirm("¿Estás seguro de que deseas eliminar esta clase? Esto borrará el horario y cancelará cualquier reserva asociada.")) return;
    
    setSaving(true);
    setSaveError(null);

    try {
      const { error } = await supabase
        .from('clases_disponibles')
        .delete()
        .eq('id', selectedClassToEdit.id);

      if (error) throw error;

      setEditModalOpen(false);
      fetchTeacherData();
    } catch (err: any) {
      console.error(err);
      setSaveError(err.message || "No se pudo eliminar la clase.");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const activeDayLabel = useMemo(() => {
    if (!selectedDate) return '';
    return new Intl.DateTimeFormat('es-AR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    }).format(new Date(selectedDate + 'T00:00:00'));
  }, [selectedDate]);

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4 md:px-8 font-sans transition-colors duration-300 animate-fade-in">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-6 animate-fade-in">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-3 border border-primary/20">
              <Sparkles size={12} className="animate-spin-slow" />
              Profesor Terminal
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight">Mi Dashboard</h1>
            <p className="text-stone-500 dark:text-stone-400 mt-2 flex items-center gap-2 capitalize">
              <CalendarIcon size={16} className="text-primary" />
              {activeDayLabel}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Workday Config Controls with LocalStorage handlers */}
            <div className="flex items-center gap-2 bg-surface border border-border px-3 py-1.5 rounded-xl shadow-sm text-foreground">
              <Settings size={14} className="text-stone-400" />
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Jornada:</span>
              <select 
                value={startHour} 
                onChange={(e) => handleStartHourChange(Number(e.target.value))}
                className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer text-foreground"
              >
                {Array.from({ length: 24 }).map((_, h) => (
                  <option key={h} value={h} className="bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100">{h}:00</option>
                ))}
              </select>
              <span className="text-stone-400 text-xs font-bold">a</span>
              <select 
                value={endHour} 
                onChange={(e) => handleEndHourChange(Number(e.target.value))}
                className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer text-foreground"
              >
                {Array.from({ length: 25 - (startHour + 1) }).map((_, i) => {
                  const h = startHour + 1 + i;
                  return (
                    <option key={h} value={h} className="bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100">{h}:00</option>
                  );
                })}
              </select>
            </div>
          </div>
        </header>

        {/* Day Switcher Container */}
        <div className="mb-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 animate-fade-in">
          <button
            onClick={handlePrevWeek}
            className="p-3 bg-surface border border-border hover:border-primary/50 text-stone-500 hover:text-primary rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0"
            title="Semana anterior"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="flex-1 bg-surface border border-border p-2 rounded-2xl shadow-sm flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
            {next7Days.map((day) => {
              const isSelected = selectedDate === day.dateString;
              return (
                <button
                  key={day.dateString}
                  onClick={() => setSelectedDate(day.dateString)}
                  className={`flex-1 min-w-[60px] py-2 px-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-300 relative ${
                    isSelected 
                      ? 'bg-primary text-white shadow-md scale-105' 
                      : 'bg-surface-secondary/30 text-stone-500 dark:text-stone-400 hover:bg-surface-secondary/80'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider">{day.labelDay}</span>
                  <span className="text-lg font-black">{day.labelNum}</span>
                  {day.hasClass && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-primary'} absolute bottom-1.5`} />
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleNextWeek}
            className="p-3 bg-surface border border-border hover:border-primary/50 text-stone-500 hover:text-primary rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0"
            title="Semana siguiente"
          >
            <ChevronRightIcon size={20} />
          </button>

          {/* Date Picker Input */}
          <div className="relative bg-surface border border-border px-3 py-2 rounded-xl shadow-sm flex items-center gap-2 text-foreground min-w-[140px] shrink-0">
            <CalendarIcon size={14} className="text-stone-400 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value);
                  setNavigatorStartDate(e.target.value);
                }
              }}
              className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer text-foreground w-full [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin text-primary" size={48} />
            <p className="text-stone-500 font-medium text-sm animate-pulse">Obteniendo tus clases desde CourtUp...</p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* KPI Metrics Dashboard Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <div className="bg-surface border border-border rounded-2xl p-5 hover:border-primary/30 transition-all duration-300 group shadow-sm flex items-center gap-4">
                <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:scale-105 transition-transform">
                  <CalendarIcon size={22} />
                </div>
                <div>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">Clases</p>
                  <p className="text-2xl font-bold mt-0.5">{teacherStats.classesTodayCount}</p>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5 hover:border-primary/30 transition-all duration-300 group shadow-sm flex items-center gap-4">
                <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:scale-105 transition-transform">
                  <Users size={22} />
                </div>
                <div>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">Alumnos</p>
                  <p className="text-2xl font-bold mt-0.5">
                    {teacherStats.activeBookingsToday} <span className="text-xs text-stone-400 font-normal">/ {teacherStats.maxCapacityToday}</span>
                  </p>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5 hover:border-primary/30 transition-all duration-300 group shadow-sm flex items-center gap-4">
                <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:scale-105 transition-transform">
                  <TrendingUp size={22} />
                </div>
                <div>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">Ocupación</p>
                  <p className="text-2xl font-bold mt-0.5">
                    {teacherStats.occupancyRate.toFixed(0)}%
                  </p>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5 hover:border-primary/30 transition-all duration-300 group shadow-sm flex items-center gap-4">
                <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:scale-105 transition-transform">
                  <Landmark size={22} />
                </div>
                <div>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">Ganancia</p>
                  <p className="text-2xl font-bold mt-0.5 text-emerald-500">
                    {formatCurrency(teacherStats.netRevenueToday)}
                  </p>
                </div>
              </div>
            </div>

            {/* Workday Gaps / Free Hours Alerts */}
            {freeHourGaps.length > 0 && activeDayClasses.length > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Horas Libres Detectadas</h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      Tienes {freeHourGaps.length} espacio(s) libre(s) en esta jornada.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {freeHourGaps.map((gap, i) => (
                    <button
                      key={i}
                      onClick={() => handleOpenQuickCreate(gap.startLabel)}
                      className="bg-surface border border-border hover:border-primary text-[10px] font-bold px-3 py-1.5 rounded-lg text-foreground hover:text-primary transition-all whitespace-nowrap shadow-sm"
                    >
                      Meter clase {gap.startLabel} ({gap.durationLabel} libre)
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline Scheduler Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Daily Timeline */}
              <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm lg:col-span-2 space-y-4">
                <h3 className="text-sm font-bold text-stone-550 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <CalendarIcon size={16} className="text-primary" /> Cronograma de Actividades
                </h3>

                <div className="relative border-l border-border pl-6 ml-3 space-y-4">
                  {workdayTimeline.map((slot) => (
                    <div key={slot.timeString} className="relative group">
                      
                      <span className={`absolute -left-[31px] top-4 w-2.5 h-2.5 rounded-full border-2 border-background transition-colors z-10 ${
                        slot.isOccupied ? 'bg-primary' : 'bg-stone-300 dark:bg-stone-750 group-hover:bg-primary/45'
                      }`} />

                      {slot.isOccupied && !slot.isStartOfClass ? (
                        <div className="flex items-center gap-4 p-2 pl-4 bg-surface-secondary/20 border-l-2 border-primary/50 text-stone-400 text-xs font-semibold rounded-r-xl">
                          <span className="w-10 text-[10px] text-stone-450">{slot.timeString}</span>
                          <span className="italic font-normal">Clase en curso...</span>
                        </div>
                      ) : (
                        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-2xl hover:shadow-sm transition-all duration-300 ${
                          slot.isStartOfClass 
                            ? 'bg-surface-secondary/60 border-primary/30 hover:border-primary/50' 
                            : 'bg-surface-secondary/35 border-border hover:bg-surface'
                        }`}>
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-bold text-stone-500 w-10">{slot.timeString}</span>
                            
                            {slot.isStartOfClass ? (
                              <div>
                                <p className="text-sm font-bold text-foreground flex flex-wrap items-center gap-2">
                                  Clase {slot.clase.deporte} 
                                  <span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md">
                                    Cat {slot.clase.categoria_target}
                                  </span>
                                  {slot.clase.es_semanal && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                                      <RefreshCw size={10} className="animate-spin-slow" />
                                      Fija Semanal
                                    </span>
                                  )}
                                </p>
                                {slot.clase.canchas && (
                                  <p className="text-xs text-stone-500 mt-1 flex items-center gap-1.5 font-medium">
                                    <MapPin size={12} className="text-stone-400" />
                                    Cancha {slot.clase.canchas.numero_cancha} • {slot.clase.reservas_clases?.filter((r: any) => r.estado_pago === 'Aprobado').length || 0}/{slot.clase.cupo_maximo} Alumnos
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm font-bold text-stone-400 italic">Hora Libre disponible</p>
                                <p className="text-[10px] text-stone-450">Espacio disponible para agendar clase</p>
                              </div>
                            )}
                          </div>

                          {slot.isStartOfClass ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedClassForStudents(slot.clase)}
                                className="inline-flex items-center justify-center gap-1.5 bg-surface border border-border hover:border-primary/30 text-[10px] font-bold text-stone-500 hover:text-primary px-3 py-1.5 rounded-lg transition-all shadow-sm self-start sm:self-center"
                              >
                                <Users size={12} />
                                Alumnos
                              </button>
                              <button
                                onClick={() => handleOpenEdit(slot.clase)}
                                className="inline-flex items-center justify-center gap-1.5 bg-surface border border-border hover:border-primary/30 text-[10px] font-bold text-stone-500 hover:text-primary px-3 py-1.5 rounded-lg transition-all shadow-sm self-start sm:self-center"
                              >
                                <Edit2 size={12} />
                                Editar
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleOpenQuickCreate(slot.timeString)}
                              className="inline-flex items-center justify-center gap-1.5 bg-surface border border-border hover:border-primary/30 text-[10px] font-bold text-stone-500 hover:text-primary px-3 py-1.5 rounded-lg transition-all shadow-sm self-start sm:self-center"
                            >
                              <Plus size={12} />
                              Agendar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sidebar Resumen */}
              <div className="space-y-6">
                <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Award size={16} className="text-primary" /> Resumen de Actividad
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 rounded-xl bg-stone-50 dark:bg-stone-850 border border-border">
                      <span className="text-xs font-semibold text-stone-500">Clases Ocupadas</span>
                      <span className="text-xs font-bold text-foreground">{teacherStats.classesTodayCount}</span>
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-xl bg-stone-50 dark:bg-stone-850 border border-border">
                      <span className="text-xs font-semibold text-stone-500">Horas Libres</span>
                      <span className="text-xs font-bold text-primary">{freeHourGaps.reduce((acc, curr) => acc + curr.duration, 0)} horas</span>
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-xl bg-stone-50 dark:bg-stone-850 border border-border">
                      <span className="text-xs font-semibold text-stone-500">Ganancia Estimada</span>
                      <span className="text-xs font-bold text-emerald-500">{formatCurrency(teacherStats.netRevenueToday)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <BookOpen size={16} className="text-primary" /> Mis Próximas Clases
                  </h3>
                  <div className="space-y-3">
                    {upcomingClasses.slice(0, 5).map((clase, i) => (
                      <div key={i} className="p-3 border border-border text-xs rounded-xl flex items-center justify-between hover:border-primary/25 transition-all bg-surface shadow-sm">
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex flex-wrap items-center gap-1.5 font-bold">
                            <span className="truncate">Clase {clase.deporte}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">Cat {clase.categoria_target}</span>
                            {clase.es_semanal && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/15 font-bold shrink-0">Fija</span>
                            )}
                          </div>
                          <p className="text-[10px] text-stone-400 mt-1">
                            {new Date(clase.dateString + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} • {clase.hora_inicio.substring(0,5)} - {clase.hora_fin.substring(0,5)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleOpenEdit(clase)}
                          className="p-1.5 rounded-lg border border-border hover:border-primary hover:text-primary transition-all text-stone-400 shrink-0 shadow-sm"
                          title="Editar clase"
                        >
                          <Edit2 size={12} />
                        </button>
                      </div>
                    ))}
                    {upcomingClasses.length === 0 && (
                      <p className="text-stone-400 italic text-xs text-center py-4">No tienes clases futuras agendadas.</p>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* Quick Create Class Modal Backdrop */}
      {quickCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          
          <div className="bg-surface border border-border rounded-3xl w-full max-w-md p-6 shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center pb-4 border-b border-border">
              <div>
                <h3 className="text-lg font-black text-foreground">Agendar Clase</h3>
                <p className="text-xs text-stone-400 mt-0.5">Publicar horario para el día {selectedDate} a las {selectedTimeSlot}</p>
              </div>
              <button 
                onClick={() => setQuickCreateOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:bg-surface-secondary transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {createError && (
              <div className="mt-4 p-3 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 text-xs flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleQuickSubmit} className="mt-4 space-y-4">
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Fecha</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-primary transition-all text-foreground"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                
                {/* Deporte */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Deporte</label>
                  <select 
                    value={deporte}
                    onChange={(e) => setDeporte(e.target.value)}
                    className="w-full bg-surface-secondary border border-border text-foreground text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-primary outline-none transition-all"
                  >
                    <option value="Tenis">Tenis</option>
                    <option value="Padel">Pádel</option>
                  </select>
                </div>

                {/* Categoría Target */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Nivel Target</label>
                  <select 
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full bg-surface-secondary border border-border text-foreground text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-primary outline-none transition-all"
                  >
                    {['SuperA', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D'].map(cat => (
                      <option key={cat} value={cat}>Cat {cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Canchas Dropdown */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Cancha</label>
                <select 
                  value={canchaId}
                  onChange={(e) => setCanchaId(e.target.value)}
                  className="w-full bg-surface-secondary border border-border text-foreground text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-primary outline-none transition-all"
                >
                  {canchas.map(c => (
                    <option key={c.id} value={c.id.toString()}>Cancha {c.numero_cancha} ({c.superficie})</option>
                  ))}
                  {canchas.length === 0 && <option value="">No hay canchas disponibles</option>}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Duración */}
                <div className="space-y-1 col-span-1">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider font-sans">Duración</label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full bg-surface-secondary border border-border text-foreground text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-primary outline-none transition-all"
                  >
                    <option value={30}>30 min</option>
                    <option value={60}>1 hora</option>
                    <option value={90}>1.5 hs</option>
                    <option value={120}>2 hs</option>
                  </select>
                </div>

                {/* Cupo */}
                <div className="space-y-1 col-span-1">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Alumnos</label>
                  <input 
                    type="number"
                    min="1"
                    max="10"
                    value={cupo}
                    onChange={(e) => setCupo(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                    className="w-full bg-surface-secondary border border-border text-foreground text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-primary outline-none transition-all font-semibold"
                  />
                </div>

                {/* Precio */}
                <div className="space-y-1 col-span-1">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Precio ARS</label>
                  <input 
                    type="number"
                    min="0"
                    step="500"
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                    className="w-full bg-surface-secondary border border-border text-foreground text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-primary outline-none transition-all font-bold font-mono"
                  />
                </div>
              </div>

              {/* Weekly Recurring Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="esSemanal"
                  checked={esSemanal}
                  onChange={(e) => setEsSemanal(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4 bg-surface-secondary cursor-pointer"
                />
                <label htmlFor="esSemanal" className="text-xs font-semibold text-stone-600 dark:text-stone-300 cursor-pointer">
                  Clase Semanal Fija (Se repite todas las semanas)
                </label>
              </div>

              <div className="pt-4 border-t border-border flex justify-end gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setQuickCreateOpen(false)}
                  className="px-4 py-2 border border-border rounded-xl text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-850 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  {creating ? <Loader2 size={12} className="animate-spin" /> : <Check size={14} />}
                  Publicar Clase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Class Modal Backdrop */}
      {editModalOpen && selectedClassToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          
          <div className="bg-surface border border-border rounded-3xl w-full max-w-md p-6 shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center pb-4 border-b border-border">
              <div>
                <h3 className="text-lg font-black text-foreground">Editar Clase</h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Fecha: {selectedClassToEdit.fecha} • Horario: {selectedClassToEdit.hora_inicio.substring(0, 5)} - {selectedClassToEdit.hora_fin.substring(0, 5)}
                </p>
              </div>
              <button 
                onClick={() => setEditModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:bg-surface-secondary transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {saveError && (
              <div className="mt-4 p-3 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 text-xs flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{saveError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                
                {/* Hora Inicio */}
                {canEditTime ? (
                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Hora Inicio</label>
                    <input 
                      type="time"
                      value={editHoraInicio}
                      onChange={(e) => setEditHoraInicio(e.target.value)}
                      className="w-full bg-surface-secondary border border-border text-foreground text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-primary outline-none transition-all font-semibold"
                    />
                  </div>
                ) : (
                  <div className="space-y-1 col-span-2">
                    <p className="text-xs text-stone-500 italic">El horario no se puede modificar porque faltan menos de 5 minutos para la clase.</p>
                  </div>
                )}

                {/* Deporte */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Deporte</label>
                  <select 
                    value={editDeporte}
                    onChange={(e) => setEditDeporte(e.target.value)}
                    className="w-full bg-surface-secondary border border-border text-foreground text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-primary outline-none transition-all"
                  >
                    <option value="Tenis">Tenis</option>
                    <option value="Padel">Pádel</option>
                  </select>
                </div>

                {/* Categoría Target */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Nivel Target</label>
                  <select 
                    value={editCategoria}
                    onChange={(e) => setEditCategoria(e.target.value)}
                    className="w-full bg-surface-secondary border border-border text-foreground text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-primary outline-none transition-all"
                  >
                    {['SuperA', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D'].map(cat => (
                      <option key={cat} value={cat}>Cat {cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Canchas Dropdown */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Cancha</label>
                <select 
                  value={editCanchaId}
                  onChange={(e) => setEditCanchaId(e.target.value)}
                  className="w-full bg-surface-secondary border border-border text-foreground text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-primary outline-none transition-all"
                >
                  {canchas.map(c => (
                    <option key={c.id} value={c.id.toString()}>Cancha {c.numero_cancha} ({c.superficie})</option>
                  ))}
                  {canchas.length === 0 && <option value="">No hay canchas disponibles</option>}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Cupo */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Cupo Alumnos</label>
                  <input 
                    type="number"
                    min="1"
                    max="10"
                    value={editCupo}
                    onChange={(e) => setEditCupo(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                    className="w-full bg-surface-secondary border border-border text-foreground text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-primary outline-none transition-all font-semibold"
                  />
                </div>

                {/* Precio */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Precio ARS</label>
                  <input 
                    type="number"
                    min="0"
                    step="500"
                    value={editPrecio}
                    onChange={(e) => setEditPrecio(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                    className="w-full bg-surface-secondary border border-border text-foreground text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-primary outline-none transition-all font-bold font-mono"
                  />
                </div>
              </div>

              {/* Weekly Recurring Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editEsSemanal"
                  checked={editEsSemanal}
                  onChange={(e) => setEditEsSemanal(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4 bg-surface-secondary cursor-pointer"
                />
                <label htmlFor="editEsSemanal" className="text-xs font-semibold text-stone-600 dark:text-stone-300 cursor-pointer">
                  Clase Semanal Fija (Se repite todas las semanas)
                </label>
              </div>

              {/* Estado Activo Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editActiva"
                  checked={editActiva}
                  onChange={(e) => setEditActiva(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4 bg-surface-secondary cursor-pointer"
                />
                <label htmlFor="editActiva" className="text-xs font-semibold text-stone-600 dark:text-stone-300 cursor-pointer">
                  Clase Activa (Visible para alumnos)
                </label>
              </div>

              <div className="pt-4 border-t border-border flex justify-between gap-2 text-xs font-bold">
                {/* Delete button */}
                <button
                  type="button"
                  onClick={handleDeleteClass}
                  disabled={!canEditTime}
                  className={`px-3 py-2 border rounded-xl transition-colors flex items-center gap-1.5 ${canEditTime ? 'bg-red-500/10 hover:bg-red-500/20 text-red-550 border-red-500/20' : 'bg-surface-secondary text-stone-400 border-border cursor-not-allowed opacity-50'}`}
                  title={canEditTime ? "Eliminar clase" : "No se puede eliminar porque faltan menos de 5 minutos"}
                >
                  <Trash2 size={14} />
                  Eliminar
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="px-4 py-2 border border-border rounded-xl text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-850 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={14} />}
                    Guardar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ver Alumnos */}
      {selectedClassForStudents && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border w-full max-w-lg rounded-2xl p-6 shadow-xl relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setSelectedClassForStudents(null)}
              className="absolute top-4 right-4 p-2 bg-surface hover:bg-surface-secondary text-stone-500 rounded-full transition-colors cursor-pointer border border-border"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
              <Users size={22} className="text-primary" /> Alumnos Inscriptos
            </h2>
            <p className="text-sm text-stone-500 mb-6">
              {selectedClassForStudents.deporte} - Categoría {selectedClassForStudents.categoria_target}
            </p>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {(!selectedClassForStudents.reservas_clases || selectedClassForStudents.reservas_clases.filter((r:any) => r.estado !== 'cancelada').length === 0) ? (
                <div className="text-center py-10 bg-surface-secondary/30 rounded-xl border border-border border-dashed">
                  <p className="text-stone-500">Aún no hay alumnos inscriptos en esta clase.</p>
                </div>
              ) : (
                selectedClassForStudents.reservas_clases.filter((r:any) => r.estado !== 'cancelada').map((reserva: any) => (
                  <div key={reserva.id} className="flex items-center gap-4 p-3 border border-border bg-surface-secondary/20 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {reserva.alumno?.nombre?.charAt(0)}{reserva.alumno?.apellido?.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-foreground text-sm">{reserva.alumno?.nombre} {reserva.alumno?.apellido}</p>
                      <p className="text-xs text-stone-500">{reserva.alumno?.telefono ? `📞 ${reserva.alumno.telefono}` : '📞 Sin teléfono'}</p>
                    </div>
                    <div className={`text-xs font-bold px-2 py-1 rounded-md ${reserva.estado_pago === 'Aprobado' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                      {reserva.estado_pago || reserva.estado}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
