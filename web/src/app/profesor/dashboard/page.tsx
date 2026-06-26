'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, CalendarDays, Wallet, Activity, Users, BookOpen, AlertCircle, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ProfesorDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [monthOffset, setMonthOffset] = useState(0);

  const [metrics, setMetrics] = useState({
    totalEarnings: 0,
    occupancyPercentage: 0,
    activeStudents: 0,
    emptyClassesCount: 0,
    fixedClassesCount: 0,
    totalDebt: 0,
    weeklyDebt: [] as { weekNumber: number, amount: number, label: string }[],
    monthName: ''
  });

  useEffect(() => {
    const fetchDashboard = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);

      try {
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() + monthOffset);
        
        const firstDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

        const startStr = firstDayOfMonth.toISOString().split('T')[0];
        const endStr = lastDayOfMonth.toISOString().split('T')[0];
        
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const monthName = monthNames[targetDate.getMonth()];

        // 1. Fetch Alquileres (Deuda)
        const { data: alquileresData } = await supabase
          .from('alquileres_cancha')
          .select('monto_total, fecha, hora_inicio, hora_fin, cancha:canchas(precio_profesor_hora_dia, precio_hora_dia, precio_profesor_hora_noche, precio_hora_noche)')
          .eq('usuario_id', session.user.id)
          .gte('fecha', startStr)
          .lte('fecha', endStr)
          .in('estado_pago', ['Pendiente', 'Aprobado']); 

        let debtTotal = 0;
        const weeks: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        if (alquileresData) {
          alquileresData.forEach(alquiler => {
            let amount = Number(alquiler.monto_total) || 0;
            
            // Recálculo en vuelo en caso de que monto_total sea 0 por error antiguo
            if (amount === 0 && alquiler.cancha) {
               const canchaInfo = alquiler.cancha as any;
               const precioProfDia = Number(canchaInfo.precio_profesor_hora_dia) || Number(canchaInfo.precio_hora_dia) || 0;
               const precioProfNoche = Number(canchaInfo.precio_profesor_hora_noche) || Number(canchaInfo.precio_hora_noche) || 0;
               
               const [hInicio, mInicio] = (alquiler.hora_inicio || '00:00').split(':').map(Number);
               const [hFin, mFin] = (alquiler.hora_fin || '00:00').split(':').map(Number);
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
               amount = (horasDia * precioProfDia) + (horasNoche * precioProfNoche);
            }

            const [y, m, d] = alquiler.fecha.split('-').map(Number);
            const weekNumber = Math.ceil(d / 7);
            const boundedWeek = Math.min(Math.max(1, weekNumber), 5);
            weeks[boundedWeek] += amount;
            debtTotal += amount;
          });
        }


        // 2. Fetch Clases Disponibles
        const { data: clasesData } = await supabase
          .from('clases_disponibles')
          .select(`
            id,
            fecha,
            hora_inicio,
            hora_fin,
            cupo_maximo,
            precio_clase,
            cancha:canchas(precio_profesor_hora_dia, precio_hora_dia, precio_profesor_hora_noche, precio_hora_noche),
            reservas_clases (id, estado_pago)
          `)
          .eq('profesor_id', session.user.id)
          .gte('fecha', startStr)
          .lte('fecha', endStr);

        let totalEarnings = 0;
        let totalOccupancyCount = 0;
        let totalMaxCapacity = 0;
        let activeStudents = 0;
        let emptyClassesCount = 0;
        let fixedClassesCount = 0;

        if (clasesData) {
          fixedClassesCount = clasesData.length;
          clasesData.forEach(clase => {
            totalMaxCapacity += clase.cupo_maximo || 0;
            const validBookings = clase.reservas_clases?.filter((r: any) => r.estado_pago !== 'Rechazado' && r.estado_pago !== 'Reembolsado') || [];
            const bookingCount = validBookings.length;
            
            if (bookingCount === 0) emptyClassesCount++;
            
            activeStudents += bookingCount;
            totalOccupancyCount += bookingCount;
            totalEarnings += bookingCount * (clase.precio_clase || 0);

            // --- Calcular deuda implícita de la cancha por esta clase ---
            const canchaInfo = clase.cancha as any;
            if (canchaInfo) {
              const precioProfDia = Number(canchaInfo.precio_profesor_hora_dia) || Number(canchaInfo.precio_hora_dia) || 0;
              const precioProfNoche = Number(canchaInfo.precio_profesor_hora_noche) || Number(canchaInfo.precio_hora_noche) || 0;
              
              const [hInicio, mInicio] = (clase.hora_inicio || '00:00').split(':').map(Number);
              const [hFin, mFin] = (clase.hora_fin || '00:00').split(':').map(Number);
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

              const montoCancha = (horasDia * precioProfDia) + (horasNoche * precioProfNoche);
              
              if (montoCancha > 0 && clase.fecha) {
                const [y, m, d] = clase.fecha.split('-').map(Number);
                const weekNumber = Math.ceil(d / 7);
                const boundedWeek = Math.min(Math.max(1, weekNumber), 5);
                weeks[boundedWeek] += montoCancha;
                debtTotal += montoCancha;
              }
            }
          });
        }
        
        // Re-formatear weeks en caso de que se haya actualizado por las clases
        const updatedFormattedWeeks = Object.keys(weeks)
          .map(w => parseInt(w))
          .filter(weekNum => {
             if (weekNum === 5 && lastDayOfMonth.getDate() <= 28) return false;
             return true;
          })
          .map(weekNum => {
            const isLastWeek = weekNum === 5 || (weekNum === 4 && lastDayOfMonth.getDate() === 28);
            const startDay = (weekNum - 1) * 7 + 1;
            const endDay = isLastWeek ? lastDayOfMonth.getDate() : weekNum * 7;
            return {
              weekNumber: weekNum,
              label: `Semana ${weekNum} (Días ${startDay} al ${endDay})`,
              amount: weeks[weekNum]
            };
          }).sort((a, b) => a.weekNumber - b.weekNumber);

        const occupancyPercentage = totalMaxCapacity > 0 ? Math.round((totalOccupancyCount / totalMaxCapacity) * 100) : 0;

        setMetrics({
          totalEarnings,
          occupancyPercentage,
          activeStudents,
          emptyClassesCount,
          fixedClassesCount,
          totalDebt: debtTotal,
          weeklyDebt: updatedFormattedWeeks,
          monthName
        });

      } catch (err) {
        console.error('Error fetching dashboard', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboard();
  }, [router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 font-sans text-foreground animate-fade-in">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <Activity className="text-primary" size={32} />
            Dashboard ({metrics.monthName})
          </h1>
          <p className="text-muted mt-2">
            Métricas de tu rendimiento general para el mes de {metrics.monthName.toLowerCase()}.
          </p>
        </div>

        {/* Top KPIs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Ingresos */}
          <div className="bg-surface-secondary border border-border rounded-3xl p-6 shadow-sm hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="text-green-500" size={20} />
              </div>
              <h2 className="text-sm font-bold text-muted">Ganancias Estimadas</h2>
            </div>
            <p className="text-3xl font-black text-foreground tracking-tighter">
              ${metrics.totalEarnings.toLocaleString('es-AR')}
            </p>
            <p className="text-xs text-muted mt-2">Ingresos proyectados este mes</p>
          </div>

          {/* Ocupación */}
          <div className="bg-surface-secondary border border-border rounded-3xl p-6 shadow-sm hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="text-blue-500" size={20} />
              </div>
              <h2 className="text-sm font-bold text-muted">Ocupación General</h2>
            </div>
            <p className="text-3xl font-black text-foreground tracking-tighter">
              {metrics.occupancyPercentage}%
            </p>
            <div className="w-full bg-border rounded-full h-1.5 mt-3 overflow-hidden">
              <div 
                className="bg-blue-500 h-1.5 rounded-full"
                style={{ width: `${metrics.occupancyPercentage}%` }}
              ></div>
            </div>
          </div>

          {/* Alumnos Activos */}
          <div className="bg-surface-secondary border border-border rounded-3xl p-6 shadow-sm hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Activity className="text-purple-500" size={20} />
              </div>
              <h2 className="text-sm font-bold text-muted">Alumnos Activos</h2>
            </div>
            <p className="text-3xl font-black text-foreground tracking-tighter">
              {metrics.activeStudents}
            </p>
            <p className="text-xs text-muted mt-2">Total de inscripciones</p>
          </div>

          {/* Deuda Mensual */}
          <div className="bg-primary/10 border border-primary/20 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Wallet className="text-primary" size={20} />
                </div>
                <h2 className="text-sm font-bold text-primary">Deuda Canchas</h2>
              </div>
              <div className="flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-full">
                <button onClick={() => setMonthOffset(prev => prev - 1)} className="hover:text-primary/70 text-primary transition-colors">
                  <ChevronLeft size={18} />
                </button>
                <span className="text-xs font-bold text-primary w-16 text-center capitalize">{metrics.monthName}</span>
                <button onClick={() => setMonthOffset(prev => prev + 1)} className="hover:text-primary/70 text-primary transition-colors">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            <p className="text-3xl font-black text-foreground tracking-tighter">
              ${metrics.totalDebt.toLocaleString('es-AR')}
            </p>
            <p className="text-xs text-muted mt-2">Costo acumulado mensual</p>
          </div>
        </div>

        {/* Bottom Section: Classes & Debt Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Detalles de Clases */}
          <div className="bg-surface-secondary border border-border rounded-3xl overflow-hidden shadow-sm">
             <div className="p-6 border-b border-border flex items-center gap-3">
                <BookOpen className="text-foreground" size={20} />
                <h2 className="text-lg font-bold text-foreground">Estado de tus Clases</h2>
             </div>
             <div className="p-6 space-y-4">
               <div className="flex justify-between items-center p-4 bg-surface rounded-2xl border border-border">
                 <div>
                   <p className="font-bold text-foreground">Clases Programadas</p>
                   <p className="text-sm text-muted">Total de clases fijas en {metrics.monthName.toLowerCase()}</p>
                 </div>
                 <div className="text-2xl font-black text-foreground bg-surface-secondary px-4 py-2 rounded-xl">
                   {metrics.fixedClassesCount}
                 </div>
               </div>

               <div className="flex justify-between items-center p-4 bg-red-500/5 rounded-2xl border border-red-500/20">
                 <div>
                   <p className="font-bold text-red-500 flex items-center gap-2">
                     <AlertCircle size={16} />
                     Clases Vacías
                   </p>
                   <p className="text-sm text-red-500/80">Clases sin alumnos inscriptos</p>
                 </div>
                 <div className="text-2xl font-black text-red-500 bg-white/50 px-4 py-2 rounded-xl dark:bg-black/50">
                   {metrics.emptyClassesCount}
                 </div>
               </div>
             </div>
          </div>

          {/* Desglose Semanal Deuda */}
          <div className="bg-surface-secondary border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CalendarDays className="text-primary" size={20} />
                <h2 className="text-lg font-bold text-foreground">Desglose Deuda ({metrics.monthName})</h2>
              </div>
            </div>
            
            <div className="p-6">
              {metrics.weeklyDebt.length === 0 ? (
                <div className="text-center py-8 bg-surface rounded-2xl border border-dashed border-border">
                  <p className="text-foreground font-semibold">Todo al día</p>
                  <p className="text-muted text-sm mt-1">No tienes gastos de canchas registrados.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {metrics.weeklyDebt.map((week, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 px-4 bg-surface rounded-2xl border border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {week.weekNumber}
                        </div>
                        <p className="font-semibold text-sm text-foreground">{week.label}</p>
                      </div>
                      <p className="text-base font-bold text-foreground">
                        ${week.amount.toLocaleString('es-AR')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
