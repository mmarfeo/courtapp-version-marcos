'use client';
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, User, BookOpen, Briefcase } from 'lucide-react';

interface StatusCanchasProps {
  canchas: any[];
  courtAvailability: { [key: string]: boolean };
  agendaClases: any[];
  agendaAlquileres: any[];
}

const HOUR_START = 7;
const HOUR_END = 24;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => {
  const h = i + HOUR_START;
  return `${h.toString().padStart(2, '0')}:00`;
});

const toDecimal = (t: string) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
};

export default function StatusCanchas({ canchas, agendaClases, agendaAlquileres }: StatusCanchasProps) {
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    const tz = new Date().getTimezoneOffset() * 60000;
    setSelectedDate(new Date(Date.now() - tz).toISOString().split('T')[0]);
  }, []);

  const shiftWeek = (weeks: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + (weeks * 7));
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const selectDay = (d: Date) => {
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  if (!selectedDate) return null;

  const dayObj = new Date(selectedDate + 'T12:00:00');
  const dayIdx = dayObj.getDay();

  const getWeekDays = (dateStr: string) => {
    const baseDate = new Date(dateStr + 'T12:00:00');
    const day = baseDate.getDay();
    const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(baseDate.setDate(diff));
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const weekDays = getWeekDays(selectedDate);
  const monthYearStr = dayObj.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const monthYearFormatted = monthYearStr.charAt(0).toUpperCase() + monthYearStr.slice(1);

  const daysShort = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

  const findEvent = (list: any[], canchaId: number, cellDec: number) => {
    return list.find(item => {
      if (item.cancha_id !== canchaId) return false;
      const start = toDecimal(item.hora_inicio);
      const end   = toDecimal(item.hora_fin);
      if (cellDec < start || cellDec >= end) return false;
      const fechaStr = item.fecha?.substring(0, 10) ?? '';
      if (item.es_semanal) {
        return new Date(fechaStr + 'T12:00:00').getDay() === dayIdx && fechaStr <= selectedDate;
      }
      return fechaStr === selectedDate;
    });
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Date Header: Month + Navigation */}
      <div className="flex items-center justify-between bg-surface border border-border p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-xl text-foreground">{monthYearFormatted}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => shiftWeek(-1)} className="p-2 hover:bg-surface-secondary rounded-lg text-stone-500 transition-colors border border-border">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => shiftWeek(1)} className="p-2 hover:bg-surface-secondary rounded-lg text-stone-500 transition-colors border border-border">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Week Calendar Strip Selector */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((d, index) => {
          const dateStr = d.toISOString().split('T')[0];
          const isSelected = dateStr === selectedDate;
          const dayName = daysShort[d.getDay()];
          const dayNum = d.getDate();

          return (
            <button
              key={index}
              onClick={() => selectDay(d)}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200
                ${isSelected 
                  ? 'bg-primary border-transparent text-white shadow-md shadow-primary/20 scale-[1.02]' 
                  : 'bg-surface border-border text-foreground hover:bg-surface-secondary'}`}
            >
              <span className={`text-[10px] font-bold tracking-wider ${isSelected ? 'text-white/80' : 'text-stone-400'}`}>
                {dayName}
              </span>
              <span className="text-lg font-extrabold mt-1">{dayNum}</span>
            </button>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500 px-1 py-1">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500/20 border-l-2 border-blue-500 inline-block" /><span>Clase</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-500/20 border-l-2 border-purple-500 inline-block" /><span>Reserva Profesor</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500/20 border-l-2 border-amber-500 inline-block" /><span>Alquiler Cliente</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-dashed border-emerald-500/40 inline-block" /><span>Libre</span></div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto border border-border rounded-2xl shadow-sm bg-surface">
        <table className="border-collapse w-full" style={{ minWidth: `${80 + canchas.length * 130}px` }}>
          <thead>
            <tr className="border-b border-border bg-stone-50/50 dark:bg-stone-900/10">
              <th className="w-20 p-3 text-xs font-bold text-stone-400 border-r border-border text-center">
                <Calendar size={14} className="mx-auto" />
              </th>
              {canchas.map(c => (
                <th key={c.id} className="p-3 text-center border-l border-border/60 min-w-[130px]">
                  <div className="text-sm font-extrabold text-foreground">{c.numero_cancha}</div>
                  <div className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mt-0.5">{c.deporte}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map(hour => {
              const cellDec = toDecimal(hour);
              return (
                <tr key={hour} className="border-b border-border/40 hover:bg-stone-50/20 dark:hover:bg-stone-800/10 transition-colors">
                  <td className="w-20 p-0 border-r border-border/40">
                    <div className="h-[52px] flex items-center justify-center text-xs font-semibold text-stone-400">
                      {hour}
                    </div>
                  </td>
                  {canchas.map(cancha => {
                    const clase    = findEvent(agendaClases, cancha.id, cellDec);
                    const alquiler = findEvent(agendaAlquileres, cancha.id, cellDec);

                    const isClaseFirst    = clase    && cellDec === toDecimal(clase.hora_inicio);
                    const isAlquilerFirst = alquiler && cellDec === toDecimal(alquiler.hora_inicio);

                    if (clase) {
                      return (
                        <td key={cancha.id} className="p-1 border-l border-border/40 bg-blue-500/[0.04]">
                          <div className="h-[44px] flex flex-col items-start justify-center rounded-lg border-l-[3px] border-blue-500 bg-blue-500/10 px-3">
                            {isClaseFirst && (
                              <>
                                <div className="text-blue-900 dark:text-blue-200 font-extrabold text-[11px] truncate w-full">
                                  {clase.profesor?.nombre || 'Clase'}
                                </div>
                                <div className="text-[9px] text-blue-500/80 font-bold mt-0.5">
                                  Clase Particular
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      );
                    }

                    if (alquiler) {
                      const isProf = alquiler.usuario?.rol?.toLowerCase() === 'profesor';
                      const colorClass = isProf
                        ? 'border-purple-500 bg-purple-500/10 text-purple-900 dark:text-purple-200'
                        : 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200';
                      const subClass = isProf ? 'text-purple-600/80' : 'text-amber-600/80';
                      const label = isProf
                        ? `Prof. ${alquiler.usuario?.nombre || ''}`
                        : (alquiler.usuario?.nombre || 'Alquiler');
                      const subLabel = isProf ? 'Entrenamiento' : 'Alquiler';
                      
                      return (
                        <td key={cancha.id} className={`p-1 border-l border-border/40 ${isProf ? 'bg-purple-500/[0.03]' : 'bg-amber-500/[0.03]'}`}>
                          <div className={`h-[44px] flex flex-col items-start justify-center rounded-lg border-l-[3px] px-3 ${colorClass}`}>
                            {isAlquilerFirst && (
                              <>
                                <div className="font-extrabold text-[11px] truncate w-full">
                                  {label}
                                </div>
                                <div className={`text-[9px] font-bold mt-0.5 ${subClass}`}>
                                  {subLabel}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      );
                    }

                    // Disponible
                    return (
                      <td key={cancha.id} className="p-1 border-l border-border/40">
                        <div className="h-[44px] flex items-center justify-center rounded-lg border border-dashed border-emerald-500/20 text-emerald-500 text-[10px] font-bold tracking-wide">
                          DISPONIBLE
                        </div>
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
  );
}
