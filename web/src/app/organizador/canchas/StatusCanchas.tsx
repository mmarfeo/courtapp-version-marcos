import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, User, BookOpen, Briefcase } from 'lucide-react';

interface StatusCanchasProps {
  canchas: any[];
  courtAvailability: { [key: string]: boolean };
  agendaClases: any[];
  agendaAlquileres: any[];
}

const HOURS = Array.from({ length: 17 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`);

export default function StatusCanchas({ canchas, courtAvailability, agendaClases, agendaAlquileres }: StatusCanchasProps) {
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    const localISODate = new Date(Date.now() - tzOffset).toISOString().split('T')[0];
    setSelectedDate(localISODate);
  }, []);

  const timeToDecimal = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
  };

  const handlePrevDay = () => {
    if (!selectedDate) return;
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    if (!selectedDate) return;
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const getDayOfWeekStr = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    return days[d.getDay()];
  };

  if (!selectedDate) return null;
  const dayOfWeek = getDayOfWeekStr(selectedDate);
  const dayIndex = new Date(selectedDate + 'T12:00:00').getDay();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between bg-surface border border-border p-3 rounded-xl shadow-sm">
        <button onClick={handlePrevDay} className="p-2 hover:bg-surface-secondary rounded-lg text-stone-500 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2 font-black text-lg text-foreground">
          <Calendar size={20} className="text-primary" />
          {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        <button onClick={handleNextDay} className="p-2 hover:bg-surface-secondary rounded-lg text-stone-500 transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="overflow-x-auto border border-border rounded-2xl bg-surface shadow-sm">
        <div className="min-w-[800px]">
          {/* Header de Canchas */}
          <div className="grid border-b border-border bg-surface/80 p-2 text-center text-xs font-bold text-stone-400"
               style={{ gridTemplateColumns: `80px repeat(${canchas.length}, minmax(120px, 1fr))` }}>
            <div className="text-left pl-3 flex items-center">Hora</div>
            {canchas.map(c => (
              <div key={c.id} className="border-l border-border/40 py-2 text-foreground font-black text-sm">
                Cancha {c.numero_cancha}
                <div className="text-[10px] text-stone-500 font-medium">{c.deporte}</div>
              </div>
            ))}
          </div>

          {/* Grilla de Horarios */}
          <div className="bg-surface">
            {HOURS.map(hour => {
              const cellDec = timeToDecimal(hour);

              return (
                <div key={hour} className="grid border-b border-border/50 hover:bg-surface-secondary/20 transition-colors"
                     style={{ gridTemplateColumns: `80px repeat(${canchas.length}, minmax(120px, 1fr))` }}>
                  <div className="border-r border-border/40 p-3 text-xs font-bold text-stone-500 flex items-center justify-center">
                    {hour}
                  </div>
                  
                  {canchas.map(cancha => {
                    const isGloballyOpen = courtAvailability[`${cancha.id}_${dayOfWeek}_${hour}`];
                    
                    // Buscar si hay clase
                    const clase = agendaClases.find(c => {
                      if (c.cancha_id !== cancha.id) return false;
                      const startDec = timeToDecimal(c.hora_inicio);
                      const endDec = timeToDecimal(c.hora_fin);
                      if (cellDec < startDec || cellDec >= endDec) return false;
                      
                      const classDateStr = c.fecha ? c.fecha.substring(0, 10) : '';
                      if (c.es_semanal) {
                        const classStart = new Date(classDateStr + 'T12:00:00');
                        return classStart.getDay() === dayIndex && classDateStr <= selectedDate;
                      }
                      return classDateStr === selectedDate;
                    });

                    // Buscar si hay alquiler
                    const alquiler = agendaAlquileres.find(a => {
                      if (a.cancha_id !== cancha.id) return false;
                      const startDec = timeToDecimal(a.hora_inicio);
                      const endDec = timeToDecimal(a.hora_fin);
                      if (cellDec < startDec || cellDec >= endDec) return false;
                      
                      const alqDateStr = a.fecha ? a.fecha.substring(0, 10) : '';
                      if (a.es_semanal) {
                        const alqStart = new Date(alqDateStr + 'T12:00:00');
                        return alqStart.getDay() === dayIndex && alqDateStr <= selectedDate;
                      }
                      return alqDateStr === selectedDate;
                    });

                    return (
                      <div key={cancha.id} className="border-r border-border/40 p-1.5 flex flex-col gap-1">
                        {clase ? (
                          <div className="bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 p-2 rounded-lg text-xs font-bold h-full flex flex-col justify-center shadow-sm">
                            <div className="flex items-center gap-1 mb-1">
                              <BookOpen size={12} /> Clase
                            </div>
                            <span className="text-[10px] text-blue-500 truncate">{clase.profesor?.nombre}</span>
                          </div>
                        ) : alquiler && alquiler.usuario?.rol === 'profesor' ? (
                          <div className="bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 p-2 rounded-lg text-xs font-bold h-full flex flex-col justify-center shadow-sm">
                            <div className="flex items-center gap-1 mb-1">
                              <Briefcase size={12} /> Prof. {alquiler.usuario?.nombre}
                            </div>
                            <span className="text-[10px] text-purple-500 truncate">Ocupado</span>
                          </div>
                        ) : alquiler ? (
                          <div className="bg-primary/10 border border-primary/20 text-primary p-2 rounded-lg text-xs font-bold h-full flex flex-col justify-center shadow-sm">
                            <div className="flex items-center gap-1 mb-1">
                              <User size={12} /> Alquiler
                            </div>
                            <span className="text-[10px] text-primary/70 truncate">{alquiler.usuario?.nombre || 'Reserva'}</span>
                          </div>
                        ) : !isGloballyOpen ? (
                          <div className="bg-surface-secondary/50 text-stone-400 p-2 rounded-lg text-[10px] h-full flex items-center justify-center font-medium opacity-50">
                            Cerrado
                          </div>
                        ) : (
                          <div className="text-emerald-500/60 p-2 text-[10px] h-full flex items-center justify-center font-medium border border-dashed border-emerald-500/20 rounded-lg">
                            Libre
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
