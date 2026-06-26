'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Users, DollarSign, Trophy, ArrowLeft, Repeat, Bell, MapPin } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { sendNotificationToAll, sendNotificationToNivel } from '@/lib/push-notifications';

export default function NuevaClasePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [canchas, setCanchas] = useState<any[]>([]);
  const [clubes, setClubes] = useState<{ id: number, nombre: string }[]>([]);
  const [horasDisponibles, setHorasDisponibles] = useState<string[]>([]);
  
  const [enviarNotificacion, setEnviarNotificacion] = useState(true);

  const [form, setForm] = useState({
    deporte: 'Tenis',
    categoria_target: 'Todas',
    organizacion_id: null as number | null,
    cancha_id: null as number | null,
    fecha: (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })(),
    hora_inicio: '10:00',
    duracion_horas: 1.5,
    cupo_maximo: '4',
    precio_clase: '10000',
    es_semanal: false,
  });

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) setUser(session.user);
    };
    init();
  }, []);

  useEffect(() => {
    const fetchCanchas = async () => {
      if (!user) return;

      const { data: userOrgs } = await supabase
        .from('miembros_organizacion')
        .select('organizacion_id')
        .eq('usuario_id', user.id);

      const orgIds = userOrgs?.map(o => o.organizacion_id) || [];

      let query = supabase
        .from('canchas')
        .select('id, numero_cancha, superficie, organizacion_id, organizaciones(nombre)')
        .order('numero_cancha');

      if (orgIds.length > 0) {
        query = query.in('organizacion_id', orgIds);
      } else {
        query = query.in('organizacion_id', [-1]);
      }

      const { data, error } = await query;
      
      if (data) {
        setCanchas(data);
        const uniqueClubs = new Map();
        data.forEach(c => {
          if (c.organizacion_id) {
            uniqueClubs.set(c.organizacion_id, {
              id: c.organizacion_id,
              nombre: (c.organizaciones as any)?.nombre || 'Sede ' + c.organizacion_id
            });
          }
        });
        const clubsArray = Array.from(uniqueClubs.values());
        setClubes(clubsArray);

        if (clubsArray.length > 0) {
          const firstClubId = clubsArray[0].id;
          const firstCancha = data.find(c => c.organizacion_id === firstClubId);
          setForm(prev => ({ 
            ...prev, 
            organizacion_id: firstClubId,
            cancha_id: firstCancha ? firstCancha.id : null 
          }));
        }
      }
    };
    fetchCanchas();
  }, [user]);

  useEffect(() => {
    const fetchHorasDisponibles = async () => {
      if (!user) return;
      
      const targetDateObj = new Date(form.fecha + 'T12:00:00');
      const targetDay = targetDateObj.getDay();
      
      const { data } = await supabase
        .from('alquileres_cancha')
        .select('hora_inicio, hora_fin, fecha, es_semanal, fecha_fin_recurrencia')
        .eq('usuario_id', user.id);
      
      if (data && data.length > 0) {
        const allowed: string[] = [];
        data.forEach(alquiler => {
          let applies = false;
          if (alquiler.fecha === form.fecha) {
            applies = true;
          } else if (alquiler.es_semanal) {
            const alqDate = new Date(alquiler.fecha + 'T12:00:00');
            const alqEnd = alquiler.fecha_fin_recurrencia ? new Date(alquiler.fecha_fin_recurrencia + 'T12:00:00') : new Date('2099-01-01');
            if (alqDate.getDay() === targetDay && targetDateObj >= alqDate && targetDateObj <= alqEnd) {
              applies = true;
            }
          }

          if (applies) {
            const startH = parseInt(alquiler.hora_inicio.split(':')[0]);
            const endH = parseInt(alquiler.hora_fin.split(':')[0]);
            for (let i = startH; i < endH; i++) {
              const hStr = `${String(i).padStart(2, '0')}:00`;
              if (!allowed.includes(hStr)) allowed.push(hStr);
            }
          }
        });
        
        setHorasDisponibles(allowed.sort());
        if (allowed.length > 0 && !allowed.includes(form.hora_inicio)) {
          setForm(f => ({ ...f, hora_inicio: allowed[0] }));
        }
      } else {
        setHorasDisponibles([]);
      }
    };
    fetchHorasDisponibles();
  }, [user, form.fecha]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cancha_id || !form.cupo_maximo || !form.precio_clase || !form.organizacion_id) {
      setErrorMsg('Por favor completa todos los campos requeridos.');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    const [h, m] = form.hora_inicio.split(':').map(Number);
    const totalMinutes = h * 60 + m + (form.duracion_horas * 60);
    const endH = Math.floor(totalMinutes / 60);
    const endM = totalMinutes % 60;
    const hora_fin = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;
    const hora_inicio_full = `${form.hora_inicio}:00`;

    try {
      // 1. Overlap check
      const targetDateObj = new Date(form.fecha + 'T00:00:00');
      const targetDay = targetDateObj.getDay();

      const { data: existingClasses } = await supabase
        .from('clases_disponibles')
        .select('hora_inicio, hora_fin, fecha, es_semanal')
        .eq('profesor_id', user?.id);

      if (existingClasses) {
        const newStart = parseInt(h.toString()) + parseInt(m.toString()) / 60;
        const newEnd = newStart + form.duracion_horas;

        const hasOverlap = existingClasses.some(c => {
          const classDateStr = c.fecha ? c.fecha.substring(0, 10) : '';
          let isSameDay = false;
          
          if (classDateStr === form.fecha) {
            isSameDay = true;
          } else if (c.es_semanal) {
            const classStartDay = new Date(classDateStr + 'T00:00:00').getDay();
            if (classStartDay === targetDay && classDateStr <= form.fecha) {
              isSameDay = true;
            }
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
          setErrorMsg('Ya tienes una clase en este horario, no puedes superponerla.');
          setLoading(false);
          return;
        }
      }

      // 2. Insert
      const { data, error } = await supabase
        .from('clases_disponibles')
        .insert([{
          profesor_id: user?.id,
          organizacion_id: form.organizacion_id,
          cancha_id: form.cancha_id,
          deporte: form.deporte,
          categoria_target: form.categoria_target,
          fecha: form.fecha,
          hora_inicio: hora_inicio_full,
          hora_fin: hora_fin,
          cupo_maximo: parseInt(form.cupo_maximo),
          precio_clase: parseFloat(form.precio_clase),
          es_semanal: form.es_semanal,
          activa: true
        }])
        .select('id')
        .single();

      if (error) throw error;
      
      // 3. Notificaciones push
      if (enviarNotificacion && data) {
        const title = `Nueva clase de ${form.deporte} disponible`;
        const clubSeleccionado = clubes.find(c => c.id === form.organizacion_id);
        const nombreClub = clubSeleccionado ? clubSeleccionado.nombre : 'el club';
        
        // Obtenemos el nombre del profesor para la notificación
        const { data: profData } = await supabase.from('perfiles_usuarios').select('nombre').eq('id', user.id).single();
        const profName = profData?.nombre || 'tu profesor';
        
        const body = `El profesor ${profName} ha publicado una clase en ${nombreClub} para el nivel ${form.categoria_target} el día ${form.fecha} a las ${form.hora_inicio} hs.`;
        
        if (form.categoria_target === 'Todas') {
          await sendNotificationToAll(title, body, { type: 'nueva_clase', claseId: data.id });
        } else {
          await sendNotificationToNivel(form.categoria_target, title, body, { type: 'nueva_clase', claseId: data.id });
        }
      }
      
      setSuccess(true);
      setTimeout(() => {
        router.push('/profesor/agenda');
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error al guardar la clase.');
    } finally {
      setLoading(false);
    }
  };

  const filteredCanchas = canchas.filter(c => c.organizacion_id === form.organizacion_id);

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8 font-sans text-foreground transition-colors duration-300 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <button onClick={() => router.back()} className="inline-flex items-center gap-2 px-4 py-2 bg-surface-secondary border border-border rounded-xl hover:bg-surface transition-colors text-foreground text-sm font-medium w-fit">
            <ArrowLeft size={18} />
            Volver
          </button>
        </div>
        
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black tracking-tight">Publicar Nueva Clase</h1>
          <p className="text-stone-500 dark:text-stone-400 mt-2 text-lg">Configura un nuevo bloque horario para tus alumnos.</p>
        </div>

        <div className="bg-surface-secondary/40 backdrop-blur-sm rounded-3xl border border-border p-8 shadow-sm">
          {success && (
            <div className="mb-6 p-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-500/20 flex items-center">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></div>
              Clase publicada exitosamente en el club. Redirigiendo a tu agenda...
            </div>
          )}
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20 flex items-center">
              {errorMsg}
            </div>
          )}

          {horasDisponibles.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl bg-surface">
              <Calendar size={48} className="mx-auto text-stone-400 mb-4" />
              <h3 className="text-lg font-bold mb-2">Sin reservas activas</h3>
              <p className="text-stone-500 text-sm max-w-sm mx-auto">
                No tienes canchas reservadas para la fecha {form.fecha}. Selecciona otro día o alquila una cancha primero para poder publicar tu clase.
              </p>
              <div className="mt-6">
                <input 
                  type="date" 
                  value={form.fecha}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setForm({...form, fecha: e.target.value})}
                  className="bg-surface-secondary border border-border text-foreground rounded-xl p-3 focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Organización */}
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <MapPin size={16} className="text-primary" />
                    Sede / Club
                  </label>
                  <select 
                    value={form.organizacion_id || ''}
                    onChange={(e) => {
                      const orgId = Number(e.target.value);
                      const firstCancha = canchas.find(c => c.organizacion_id === orgId);
                      setForm({...form, organizacion_id: orgId, cancha_id: firstCancha ? firstCancha.id : null});
                    }}
                    className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:ring-2 focus:ring-primary outline-none transition-all"
                  >
                    {clubes.map(club => (
                      <option key={club.id} value={club.id}>{club.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Cancha */}
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <Trophy size={16} className="text-primary" />
                    Cancha Asignada
                  </label>
                  <select 
                    value={form.cancha_id || ''}
                    onChange={(e) => setForm({...form, cancha_id: Number(e.target.value)})}
                    className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:ring-2 focus:ring-primary outline-none transition-all"
                  >
                    {filteredCanchas.map(c => (
                      <option key={c.id} value={c.id}>Cancha {c.numero_cancha} ({c.superficie})</option>
                    ))}
                  </select>
                </div>

                {/* Deporte */}
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <Trophy size={16} className="text-primary" />
                    Deporte
                  </label>
                  <select 
                    value={form.deporte}
                    onChange={(e) => setForm({...form, deporte: e.target.value})}
                    className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:ring-2 focus:ring-primary outline-none transition-all"
                  >
                    <option value="Tenis">Tenis</option>
                    <option value="Padel">Pádel</option>
                  </select>
                </div>

                {/* Categoría Target */}
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <Users size={16} className="text-primary" />
                    Nivel Requerido
                  </label>
                  <select 
                    value={form.categoria_target}
                    onChange={(e) => setForm({...form, categoria_target: e.target.value})}
                    className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:ring-2 focus:ring-primary outline-none transition-all"
                  >
                    <option value="Todas">Todas</option>
                    <option value="SuperA">Super A</option>
                    <option value="A+">A+</option>
                    <option value="A">A</option>
                    <option value="B+">B+</option>
                    <option value="B">B</option>
                    <option value="C+">C+</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>

                {/* Fecha */}
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <Calendar size={16} className="text-primary" />
                    Fecha
                  </label>
                  <input 
                    type="date" 
                    value={form.fecha}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setForm({...form, fecha: e.target.value})}
                    required 
                    className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:ring-2 focus:ring-primary outline-none transition-all" 
                  />
                </div>

                {/* Horarios */}
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <Clock size={16} className="text-primary" />
                    Horario de Inicio (hs reservadas)
                  </label>
                  <div className="flex gap-2">
                    <select 
                      value={form.hora_inicio}
                      onChange={(e) => setForm({...form, hora_inicio: e.target.value})}
                      className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:ring-2 focus:ring-primary outline-none transition-all"
                    >
                      {horasDisponibles.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Cupo */}
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <Users size={16} className="text-primary" />
                    Cupo Máximo
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    value={form.cupo_maximo}
                    onChange={(e) => setForm({...form, cupo_maximo: e.target.value})}
                    required 
                    className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:ring-2 focus:ring-primary outline-none transition-all" 
                  />
                  <p className="text-xs text-stone-500">1 para clase particular, mayor a 1 para grupales.</p>
                </div>

                {/* Tarifa */}
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <DollarSign size={16} className="text-primary" />
                    Tarifa Total (ARS)
                  </label>
                  <input 
                    type="number" 
                    min="0" 
                    step="100" 
                    value={form.precio_clase}
                    onChange={(e) => setForm({...form, precio_clase: e.target.value})}
                    required 
                    className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:ring-2 focus:ring-primary outline-none transition-all font-mono" 
                  />
                </div>

                {/* Enviar Notificaciones */}
                <div className="col-span-1 md:col-span-2">
                  <label className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl cursor-pointer hover:border-primary transition-all">
                    <input 
                      type="checkbox" 
                      checked={enviarNotificacion}
                      onChange={(e) => setEnviarNotificacion(e.target.checked)}
                      className="w-5 h-5 accent-primary rounded cursor-pointer" 
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold flex items-center gap-2 text-foreground">
                        <Bell size={16} className="text-primary" />
                        Enviar notificaciones
                      </span>
                      <span className="text-xs text-stone-500 mt-1">Se enviará una alerta push a los jugadores del nivel que hayas seleccionado.</span>
                    </div>
                  </label>
                </div>

                {/* Repetir Semanalmente */}
                <div className="col-span-1 md:col-span-2">
                  <label className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl cursor-pointer hover:border-primary transition-all">
                    <input 
                      type="checkbox" 
                      checked={form.es_semanal}
                      onChange={(e) => setForm({...form, es_semanal: e.target.checked})}
                      className="w-5 h-5 accent-primary rounded cursor-pointer" 
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold flex items-center gap-2 text-foreground">
                        <Repeat size={16} className="text-primary" />
                        Repetir semanalmente
                      </span>
                      <span className="text-xs text-stone-500 mt-1">La clase se publicará automáticamente todas las semanas en este mismo día y horario.</span>
                    </div>
                  </label>
                </div>

              </div>

              <div className="pt-6 border-t border-border">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-sm"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Publicar Clase'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
