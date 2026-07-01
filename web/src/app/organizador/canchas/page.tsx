'use client';

import React, { useState, useEffect } from 'react';
import { LayoutGrid, Trophy, Plus, Settings2, Trash2, Edit2, Play, Pause, Save, Loader2, Check, Calendar, DollarSign, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import StatusCanchas from './StatusCanchas';

const DAYS_EN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DAYS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const HOURS = Array.from({ length: 17 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`);

export default function GestionCanchasPage() {
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [canchas, setCanchas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizacionId, setOrganizacionId] = useState<number | null>(null);
  const [misClubes, setMisClubes] = useState<{id: number, nombre: string}[]>([]);

  // Form states
  const [editingCanchaId, setEditingCanchaId] = useState<number | null>(null);
  const [numeroCancha, setNumeroCancha] = useState('');
  const [deporte, setDeporte] = useState('Tenis');
  const [superficie, setSuperficie] = useState('Polvo de Ladrillo');
  const [precioDia, setPrecioDia] = useState('14000');
  const [precioNoche, setPrecioNoche] = useState('18000');
  const [precioProfesorDia, setPrecioProfesorDia] = useState('10000');
  const [precioProfesorNoche, setPrecioProfesorNoche] = useState('14000');
  const [horaNoche, setHoraNoche] = useState('18:00');
  const [savingCancha, setSavingCancha] = useState(false);

  // Availability states
  const [selectedCanchaId, setSelectedCanchaId] = useState<number | null>(null);
  const [courtAvailability, setCourtAvailability] = useState<{ [key: string]: boolean }>({});
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [availSuccess, setAvailSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mainTab, setMainTab] = useState<'gestion' | 'status'>('gestion');
  const [activeTab, setActiveTab] = useState<'agenda' | 'config'>('agenda');
  const [navigatorStartDate, setNavigatorStartDate] = useState<string>('');
  const [agendaClases, setAgendaClases] = useState<any[]>([]);
  const [agendaAlquileres, setAgendaAlquileres] = useState<any[]>([]);

  const getLocalISODate = (date: Date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().split('T')[0];
  };

  const getMondayStr = (d: Date) => {
    const date = new Date(d.getTime());
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    return getLocalISODate(date);
  };

  useEffect(() => {
    setNavigatorStartDate(getMondayStr(new Date()));

    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: miembros } = await supabase
            .from('miembros_organizacion')
            .select('organizacion_id, organizaciones(id, nombre)')
            .eq('usuario_id', user.id);

          if (miembros && miembros.length > 0) {
            const clubes = miembros.map((m: any) => m.organizaciones).filter(Boolean);
            setMisClubes(clubes);
            setOrganizacionId(clubes[0].id);
            await cargarDatos(clubes.map((c: any) => c.id));
          } else {
            const { data: orgs } = await supabase
              .from('organizaciones')
              .select('id, nombre')
              .limit(1);
            if (orgs && orgs.length > 0) {
              setMisClubes(orgs);
              setOrganizacionId(orgs[0].id);
              await cargarDatos([orgs[0].id]);
            }
          }
        }
      } catch (err) {
        console.error("Error al inicializar:", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const cargarDatos = async (orgIds: number[]) => {
    try {
      const { data: canchasData, error: cError } = await supabase
        .from('canchas')
        .select('*, organizaciones(nombre)')
        .in('organizacion_id', orgIds)
        .order('numero_cancha', { ascending: true });

      if (cError) throw cError;
      const list = canchasData || [];
      setCanchas(list);

      if (list.length > 0) {
        setSelectedCanchaId(list[0].id);
        
        // Cargar disponibilidad semanal
        const { data: availData, error: aError } = await supabase
          .from('disponibilidad_cancha_semanal')
          .select('*')
          .in('cancha_id', list.map(c => c.id));

        if (aError) throw aError;

        const initialAvail: { [key: string]: boolean } = {};
        availData?.forEach((av: any) => {
          const hourStr = av.hora_inicio.substring(0, 5);
          initialAvail[`${av.cancha_id}_${av.dia_semana.toLowerCase()}_${hourStr}`] = true;
        });
        setCourtAvailability(initialAvail);

        const canchasIds = list.map(c => c.id);
        const { data: clases } = await supabase
          .from('clases_disponibles')
          .select('id, fecha, hora_inicio, hora_fin, cancha_id, profesor:perfiles_usuarios!profesor_id(nombre)')
          .in('cancha_id', canchasIds);
        setAgendaClases(clases || []);

        const tzOffset = new Date().getTimezoneOffset() * 60000;
        const sevenDaysAgo = new Date(Date.now() - tzOffset - 7 * 24 * 60 * 60 * 1000);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

        const { data: alqRecientes, error: alqErr } = await supabase
          .from('alquileres_cancha')
          .select('id, fecha, hora_inicio, hora_fin, cancha_id, es_semanal, usuario:perfiles_usuarios!usuario_id(nombre, rol)')
          .in('cancha_id', canchasIds)
          .in('estado_pago', ['Aprobado', 'Pendiente'])
          .gte('fecha', sevenDaysAgoStr);
          
        const { data: alqSemanales } = await supabase
          .from('alquileres_cancha')
          .select('id, fecha, hora_inicio, hora_fin, cancha_id, es_semanal, usuario:perfiles_usuarios!usuario_id(nombre, rol)')
          .in('cancha_id', canchasIds)
          .in('estado_pago', ['Aprobado', 'Pendiente'])
          .eq('es_semanal', true)
          .lt('fecha', sevenDaysAgoStr);

        const alquileres = [...(alqRecientes || []), ...(alqSemanales || [])];
        setAgendaAlquileres(alquileres);
        setDebugInfo(`Canchas: ${canchasIds.join(',')}, Alq count: ${alquileres.length}, Err: ${alqErr?.message || 'none'}`);
      }
    } catch (err) {
      console.error("Error cargando datos:", err);
    }
  };

  const handlePrevWeek = () => {
    if (!navigatorStartDate) return;
    const d = new Date(navigatorStartDate + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    setNavigatorStartDate(d.toISOString().split('T')[0]);
  };

  const handleNextWeek = () => {
    if (!navigatorStartDate) return;
    const d = new Date(navigatorStartDate + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    setNavigatorStartDate(d.toISOString().split('T')[0]);
  };

  const timeToDecimal = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
  };

  const handleToggleEstado = async (id: number, currentStatus: boolean) => {
    try {
      const { error: err } = await supabase
        .from('canchas')
        .update({ activa: !currentStatus })
        .eq('id', id);
      if (err) throw err;
      setCanchas(canchas.map(c => c.id === id ? { ...c, activa: !c.activa } : c));
    } catch (err) {
      console.error(err);
    }
  };

  const handleEliminarCancha = async (id: number) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar esta cancha? Esta acción no se puede deshacer.")) return;
    try {
      const { error: err } = await supabase
        .from('canchas')
        .delete()
        .eq('id', id);
      if (err) throw err;
      setCanchas(canchas.filter(c => c.id !== id));
      if (selectedCanchaId === id) {
        setSelectedCanchaId(canchas.find(c => c.id !== id)?.id || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openNewCanchaModal = () => {
    setEditingCanchaId(null);
    setNumeroCancha('');
    setDeporte('Tenis');
    setSuperficie('Polvo de Ladrillo');
    setPrecioDia('14000');
    setPrecioNoche('18000');
    setPrecioProfesorDia('10000');
    setPrecioProfesorNoche('14000');
    setHoraNoche('18:00');
    setError(null);
    setShowModal(true);
  };

  const openEditCanchaModal = (cancha: any) => {
    setEditingCanchaId(cancha.id);
    setOrganizacionId(cancha.organizacion_id);
    setNumeroCancha(cancha.numero_cancha.toString());
    setDeporte(cancha.deporte);
    setSuperficie(cancha.superficie || 'Polvo de Ladrillo');
    setPrecioDia(cancha.precio_hora_dia?.toString() || '14000');
    setPrecioNoche(cancha.precio_hora_noche?.toString() || '18000');
    setPrecioProfesorDia(cancha.precio_profesor_hora_dia?.toString() || '10000');
    setPrecioProfesorNoche(cancha.precio_profesor_hora_noche?.toString() || '14000');
    setHoraNoche(cancha.hora_inicio_noche?.substring(0, 5) || '18:00');
    setError(null);
    setShowModal(true);
  };

  const handleSaveCancha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizacionId || !numeroCancha) return;
    setSavingCancha(true);
    setError(null);
    try {
      const dataToSave = {
        organizacion_id: organizacionId,
        nombre_club: misClubes.find(c => c.id === organizacionId)?.nombre || 'Club CourtUp',
        numero_cancha: parseInt(numeroCancha),
        superficie: superficie,
        deporte: deporte,
        precio_hora_dia: parseFloat(precioDia),
        precio_hora_noche: parseFloat(precioNoche),
        precio_profesor_hora_dia: parseFloat(precioProfesorDia),
        precio_profesor_hora_noche: parseFloat(precioProfesorNoche),
        hora_inicio_noche: horaNoche + ':00',
        activa: true
      };

      if (editingCanchaId) {
        const { data, error: updateError } = await supabase
          .from('canchas')
          .update(dataToSave)
          .eq('id', editingCanchaId)
          .select()
          .single();

        if (updateError) throw updateError;
        const completeData = { ...data, organizaciones: misClubes.find(c => c.id === data.organizacion_id) };
        setCanchas(canchas.map(c => c.id === editingCanchaId ? completeData : c));
      } else {
        const { data, error: insertError } = await supabase
          .from('canchas')
          .insert([dataToSave])
          .select()
          .single();

        if (insertError) throw insertError;
        const completeData = { ...data, organizaciones: misClubes.find(c => c.id === data.organizacion_id) };
        setCanchas([...canchas, completeData].sort((a, b) => a.numero_cancha - b.numero_cancha));
        if (!selectedCanchaId) setSelectedCanchaId(data.id);
      }

      setShowModal(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al guardar la cancha.");
    } finally {
      setSavingCancha(false);
    }
  };

  const copyCanchaAvailabilityToAll = () => {
    if (!selectedCanchaId) return;
    setCourtAvailability(prev => {
      const updated = { ...prev };
      canchas.forEach(c => {
        if (c.id !== selectedCanchaId) {
          DAYS_EN.forEach(day => {
            HOURS.forEach(hour => {
              const sourceKey = `${selectedCanchaId}_${day}_${hour}`;
              const targetKey = `${c.id}_${day}_${hour}`;
              updated[targetKey] = prev[sourceKey] || false;
            });
          });
        }
      });
      return updated;
    });
  };

  const copyDayAvailabilityForCancha = (sourceDay: string) => {
    if (!selectedCanchaId) return;
    setCourtAvailability(prev => {
      const updated = { ...prev };
      DAYS_EN.forEach(targetDay => {
        if (targetDay !== sourceDay) {
          HOURS.forEach(hour => {
            const sourceKey = `${selectedCanchaId}_${sourceDay}_${hour}`;
            const targetKey = `${selectedCanchaId}_${targetDay}_${hour}`;
            updated[targetKey] = prev[sourceKey] || false;
          });
        }
      });
      return updated;
    });
  };

  const handleGuardarDisponibilidadCanchas = async () => {
    if (!selectedCanchaId) return;
    setSavingAvailability(true);
    setError(null);
    setAvailSuccess(false);

    try {
      const selectedSlots = Object.entries(courtAvailability)
        .filter(([_, isSelected]) => isSelected)
        .map(([key]) => key);

      const proposals = selectedSlots.map(slotKey => {
        const [canchaIdStr, dayName, hourStr] = slotKey.split('_');
        const [h, m] = hourStr.split(':');
        const horaInicio = `${h}:${m}:00`;
        const horaFin = `${(parseInt(h) + 1).toString().padStart(2, '0')}:${m}:00`;

        return {
          cancha_id: Number(canchaIdStr),
          dia_semana: dayName,
          hora_inicio: horaInicio,
          hora_fin: horaFin
        };
      });

      // Limpiar disponibilidades existentes para las canchas del club
      const canchasIds = canchas.map(c => c.id);
      if (canchasIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('disponibilidad_cancha_semanal')
          .delete()
          .in('cancha_id', canchasIds);

        if (deleteError) throw deleteError;
      }

      if (proposals.length > 0) {
        const { error: insertError } = await supabase
          .from('disponibilidad_cancha_semanal')
          .insert(proposals);

        if (insertError) throw insertError;
      }

      setAvailSuccess(true);
      setTimeout(() => setAvailSuccess(false), 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al guardar la disponibilidad semanal.");
    } finally {
      setSavingAvailability(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary" size={48} />
          <p className="text-stone-500 font-medium">Cargando instalaciones del club...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 font-sans text-foreground transition-colors duration-300 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        
        {/* Header y Acciones */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Canchas</h1>
            <p className="text-sm text-muted-foreground">{canchas.length} canchas</p>
            <p className="text-xs text-red-500 font-mono mt-1">{`Alquileres: ${agendaAlquileres.length}, CanchasIds: ${canchas.map(c => c.id).length}`}</p>
            <p className="text-stone-500 dark:text-stone-400 mt-2">Administra el inventario, precios y disponibilidad horaria de tu club.</p>
          </div>
          {mainTab === 'gestion' && (
            <button 
              onClick={openNewCanchaModal}
              className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Plus size={20} />
              Nueva Cancha
            </button>
          )}
        </div>

        {/* Top-Level Tabs */}
        <div className="flex gap-2 mb-8 border-b border-border pb-1">
          <button
            onClick={() => setMainTab('gestion')}
            className={`px-6 py-2.5 font-bold text-sm transition-all border-b-2 rounded-t-lg ${mainTab === 'gestion' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-stone-500 hover:text-foreground hover:bg-surface-secondary'}`}
          >
            Crear y Gestionar Canchas
          </button>
          <button
            onClick={() => setMainTab('status')}
            className={`px-6 py-2.5 font-bold text-sm transition-all border-b-2 rounded-t-lg ${mainTab === 'status' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-stone-500 hover:text-foreground hover:bg-surface-secondary'}`}
          >
            Status de Canchas (Hoy)
          </button>
        </div>

        {mainTab === 'status' && (
          <StatusCanchas 
            canchas={canchas} 
            courtAvailability={courtAvailability} 
            agendaClases={agendaClases} 
            agendaAlquileres={agendaAlquileres} 
          />
        )}

        {mainTab === 'gestion' && (
          <div className="animate-in fade-in duration-300">
            {/* Grid de Canchas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12 animate-fade-in">
          {canchas.map((cancha, idx) => (
            <div 
              key={cancha.id} 
              className={`relative bg-surface-secondary/40 backdrop-blur-sm rounded-2xl p-6 border transition-all duration-300 hover:bg-surface hover:shadow-md animate-slide-up ${
                cancha.activa ? 'border-border' : 'border-border opacity-75 grayscale-[0.2]'
              }`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {/* Etiqueta de Estado */}
              <div className={`absolute top-4 right-4 px-3 py-1 text-xs font-bold rounded-full border ${
                cancha.activa 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                  : 'bg-surface border-border text-stone-500'
              }`}>
                {cancha.activa ? 'Operativa' : 'Mantenimiento'}
              </div>

              {/* Botón Editar */}
              <button
                onClick={() => openEditCanchaModal(cancha)}
                className="absolute top-4 right-24 p-1.5 text-stone-400 hover:text-primary transition-colors cursor-pointer"
                title="Editar Cancha"
              >
                <Edit2 size={16} />
              </button>

              {/* Icono de Deporte */}
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-sm ${
                cancha.deporte === 'Tenis' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-accent/15 text-stone-700 dark:text-accent border border-accent/30'
              }`}>
                <Trophy size={28} />
              </div>

              <h2 className="text-2xl font-black">Cancha {cancha.numero_cancha}</h2>
              <p className="text-stone-500 font-medium text-sm mt-1">{cancha.organizaciones?.nombre || cancha.nombre_club}</p>
              
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3 text-sm font-medium">
                  <div className="w-8 h-8 rounded bg-surface flex items-center justify-center text-stone-400 border border-border">
                    <LayoutGrid size={16} />
                  </div>
                  {cancha.superficie}
                </div>
                <div className="flex items-start gap-3 text-sm font-medium">
                  <div className="w-8 h-8 rounded bg-surface flex items-center justify-center text-stone-400 border border-border mt-1 shrink-0">
                    <DollarSign size={16} />
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground">Precio Jugadores</span>
                      <span className="text-stone-500 text-xs">Día: ${cancha.precio_hora_dia?.toLocaleString('es-AR') || '14.000'} | Noche: ${cancha.precio_hora_noche?.toLocaleString('es-AR') || '18.000'}</span>
                    </div>
                    <div className="flex flex-col border-t border-border/50 pt-1">
                      <span className="font-bold text-primary">Precio Profesores</span>
                      <span className="text-stone-500 text-xs">Día: ${cancha.precio_profesor_hora_dia?.toLocaleString('es-AR') || '10.000'} | Noche: ${cancha.precio_profesor_hora_noche?.toLocaleString('es-AR') || '14.000'}</span>
                    </div>
                    <span className="text-stone-400 text-[10px] italic">Tarifa noche a partir de {cancha.hora_inicio_noche?.substring(0,5) || '18:00'}</span>
                  </div>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="mt-8 pt-6 border-t border-border flex gap-2">
                <button 
                  onClick={() => handleToggleEstado(cancha.id, cancha.activa)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer border ${
                    cancha.activa 
                      ? 'bg-surface border-border text-stone-600 dark:text-stone-300 hover:bg-surface-secondary' 
                      : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20'
                  }`}
                >
                  {cancha.activa ? <Pause size={16} /> : <Play size={16} />}
                  {cancha.activa ? 'Pausar' : 'Activar'}
                </button>
                <button 
                  onClick={() => handleEliminarCancha(cancha.id)}
                  className="px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors border border-red-500/20 cursor-pointer" 
                  title="Eliminar Cancha"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}

          {canchas.length === 0 && (
            <div className="col-span-full py-20 text-center bg-surface-secondary/40 border border-border border-dashed rounded-3xl animate-fade-in">
              <LayoutGrid size={48} className="mx-auto text-stone-400 mb-4" />
              <h3 className="text-xl font-bold">No hay canchas registradas</h3>
              <p className="text-stone-500 mt-2">Comienza agregando las instalaciones de tu club para habilitar alquileres y disponibilidad para torneos.</p>
            </div>
          )}
        </div>

        {/* Sección: Agenda y Disponibilidad */}
        {canchas.length > 0 && (
          <div className="bg-surface-secondary/40 border border-border rounded-3xl p-8 shadow-sm space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Calendar className="text-primary" size={22} /> Agenda y Horarios
                </h2>
                <p className="text-stone-500 dark:text-stone-400 text-xs mt-1">
                  Visualiza las reservas o configura los horarios de apertura globales.
                </p>
              </div>
              <div className="flex bg-surface border border-border p-1 rounded-xl shadow-sm">
                <button
                  onClick={() => setActiveTab('agenda')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'agenda' ? 'bg-primary text-white shadow-sm' : 'text-stone-500 hover:text-foreground'}`}
                >
                  Agenda Semanal
                </button>
                <button
                  onClick={() => setActiveTab('config')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'config' ? 'bg-primary text-white shadow-sm' : 'text-stone-500 hover:text-foreground'}`}
                >
                  Configuración Global
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {/* Selector de Canchas */}
              <div className="flex flex-wrap gap-2 p-1 bg-surface rounded-xl border border-border shadow-sm">
                {canchas.map((cancha) => {
                  const isActive = selectedCanchaId === cancha.id;
                  const numSlots = Object.keys(courtAvailability).filter(k => k.startsWith(`${cancha.id}_`) && courtAvailability[k]).length;
                  return (
                    <button
                      key={cancha.id}
                      type="button"
                      onClick={() => setSelectedCanchaId(cancha.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-stone-500 hover:text-foreground hover:bg-surface-secondary'
                      }`}
                    >
                      <LayoutGrid size={14} />
                      Cancha {cancha.numero_cancha} ({cancha.organizaciones?.nombre || 'Club'})
                      {numSlots > 0 && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                          isActive ? 'bg-primary-hover text-white' : 'bg-surface-secondary text-stone-400'
                        }`}>
                          {numSlots} slots
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Contenedor Agenda Semanal */}
              {activeTab === 'agenda' && selectedCanchaId && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center bg-surface border border-border rounded-xl p-2">
                    <button onClick={handlePrevWeek} className="p-2 hover:bg-surface-secondary rounded-lg text-stone-500 transition-colors"><ChevronLeft size={20} /></button>
                    <span className="font-bold text-sm">Semana del {new Date(navigatorStartDate + 'T00:00:00').toLocaleDateString('es-AR')}</span>
                    <button onClick={handleNextWeek} className="p-2 hover:bg-surface-secondary rounded-lg text-stone-500 transition-colors"><ChevronRight size={20} /></button>
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-border bg-surface/40">
                    <div className="min-w-[700px]">
                      <div className="grid grid-cols-8 border-b border-border bg-surface/80 p-2 text-center text-xs font-bold text-stone-400">
                        <div className="col-span-1 text-left pl-3 flex items-center text-stone-550">Hora</div>
                        {DAYS_ES.map((day, idx) => {
                          const d = new Date(navigatorStartDate + 'T00:00:00');
                          d.setDate(d.getDate() + idx);
                          return (
                            <div key={day} className="flex flex-col items-center justify-center gap-1 border-l border-border/40 py-2">
                              <span className="text-foreground">{day}</span>
                              <span className="text-[10px] text-stone-500">{d.getDate()}/{d.getMonth()+1}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="bg-surface">
                        {HOURS.map((hour) => (
                          <div key={hour} className="grid grid-cols-8 border-b border-border/50 hover:bg-surface-secondary/30 transition-colors">
                            <div className="col-span-1 border-r border-border/40 p-3 text-xs font-bold text-stone-500 flex items-center">
                              {hour}
                            </div>
                            {DAYS_EN.map((day, idx) => {
                              const d = new Date(navigatorStartDate + 'T00:00:00');
                              d.setDate(d.getDate() + idx);
                              const tzOffset = d.getTimezoneOffset() * 60000;
                              const cellDateStr = new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
                              const dayOfWeek = d.getDay();
                              
                              const isGloballyOpen = courtAvailability[`${selectedCanchaId}_${day}_${hour}`];
                              const cellDec = timeToDecimal(hour);
                              
                              const clase = agendaClases.find(c => {
                                if (c.cancha_id !== selectedCanchaId) return false;
                                const startDec = timeToDecimal(c.hora_inicio);
                                const endDec = timeToDecimal(c.hora_fin);
                                if (cellDec < startDec || cellDec >= endDec) return false;
                                
                                const classDateStr = c.fecha ? c.fecha.substring(0, 10) : '';
                                if (c.es_semanal) {
                                  const classStart = new Date(classDateStr + 'T00:00:00');
                                  return classStart.getDay() === dayOfWeek && classDateStr <= cellDateStr;
                                }
                                return classDateStr === cellDateStr;
                              });

                              const rental = agendaAlquileres.find(r => {
                                if (r.cancha_id !== selectedCanchaId) return false;
                                const startDec = timeToDecimal(r.hora_inicio);
                                const endDec = timeToDecimal(r.hora_fin);
                                if (cellDec < startDec || cellDec >= endDec) return false;
                                
                                const rentalDateStr = r.fecha ? r.fecha.substring(0, 10) : '';
                                if (r.es_semanal) {
                                  const rentalStart = new Date(rentalDateStr + 'T00:00:00');
                                  return rentalStart.getDay() === dayOfWeek && rentalDateStr <= cellDateStr;
                                }
                                return rentalDateStr === cellDateStr;
                              });

                              return (
                                <div key={day} className="border-r border-border/40 p-2 relative flex items-center justify-center min-h-[60px]">
                                  {clase ? (
                                    <div className="w-full h-full rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-center items-center p-1 cursor-default" title={`Clase con ${clase.profesor?.nombre || 'Profesor'}`}>
                                      <span className="text-[10px] font-bold text-emerald-500">Clase</span>
                                      <span className="text-[9px] text-stone-600 dark:text-stone-300 truncate w-full text-center">{clase.profesor?.nombre || clase.profesor?.apellido}</span>
                                    </div>
                                  ) : rental ? (
                                    <div className="w-full h-full rounded-lg bg-blue-500/10 border border-blue-500/20 flex flex-col justify-center items-center p-1 cursor-default" title={`Reserva de ${rental.usuario?.nombre || 'Usuario'}`}>
                                      <span className="text-[10px] font-bold text-blue-500">Reserva</span>
                                      <span className="text-[9px] text-stone-600 dark:text-stone-300 truncate w-full text-center">{rental.usuario?.nombre || rental.usuario?.apellido}</span>
                                    </div>
                                  ) : isGloballyOpen ? (
                                    <div className="w-full h-full flex items-center justify-center text-[10px] text-stone-400 font-medium">Libre</div>
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-stone-100 dark:bg-stone-850 rounded text-[10px] text-stone-400 italic">Cerrada</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Contenedor Configuración Global */}
              {activeTab === 'config' && selectedCanchaId && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <p className="text-xs text-stone-500">
                      Selecciona las horas en la grilla para configurar la disponibilidad de la <strong className="text-foreground">Cancha {canchas.find(c => c.id === selectedCanchaId)?.numero_cancha}</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={copyCanchaAvailabilityToAll}
                      className="px-3 py-1.5 bg-surface hover:bg-surface-secondary border border-border rounded-lg text-[10px] font-bold text-primary hover:text-primary-hover transition-colors cursor-pointer"
                    >
                      Copiar horario a todas las canchas
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-border bg-surface/40">
                    <div className="min-w-[700px]">
                      {/* Headers */}
                      <div className="grid grid-cols-9 border-b border-border bg-surface/80 p-2 text-center text-xs font-bold text-stone-400">
                        <div className="col-span-2 text-left pl-3 flex items-center text-stone-550">Hora</div>
                        {DAYS_ES.map((day, idx) => (
                          <div key={day} className="flex flex-col items-center justify-center gap-1 border-l border-border/40">
                            <span className="text-foreground">{day}</span>
                            <button
                              type="button"
                              onClick={() => copyDayAvailabilityForCancha(DAYS_EN[idx])}
                              className="text-[9px] text-primary hover:text-primary-hover font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Copiar a todos
                            </button>
                          </div>
                        ))}
                      </div>
                      
                      {/* Grid Body */}
                      <div className="max-h-[350px] overflow-y-auto divide-y divide-border">
                        {HOURS.map(hour => (
                          <div key={hour} className="grid grid-cols-9 hover:bg-surface/10 text-center text-xs">
                            <div className="col-span-2 flex items-center justify-start pl-4 font-mono font-bold text-stone-550 bg-surface/10 h-10 border-r border-border/40">
                              {hour} - {`${(parseInt(hour.split(':')[0]) + 1).toString().padStart(2, '0')}:00`}
                            </div>
                            {DAYS_EN.map(day => {
                              const gridKey = `${selectedCanchaId}_${day}_${hour}`;
                              const isChecked = !!courtAvailability[gridKey];
                              return (
                                <div
                                  key={`${day}_${hour}`}
                                  onClick={() => {
                                    setCourtAvailability(prev => ({
                                      ...prev,
                                      [gridKey]: !prev[gridKey]
                                    }));
                                  }}
                                  className={`flex items-center justify-center h-10 cursor-pointer border-r border-border/20 last:border-r-0 transition-all ${
                                    isChecked 
                                      ? 'bg-primary/25 text-primary font-black' 
                                      : 'text-stone-300 hover:bg-surface-secondary/20'
                                  }`}
                                >
                                  {isChecked ? '✓' : ''}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Acciones de Guardar */}
                  <div className="flex justify-end gap-3 pt-2">
                    {availSuccess && (
                      <span className="text-emerald-555 text-sm font-bold flex items-center gap-1 animate-pulse">
                        <Check size={16} /> Horarios guardados con éxito
                      </span>
                    )}
                    {error && (
                      <span className="text-red-500 text-sm font-medium flex items-center gap-1">
                        {error}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleGuardarDisponibilidadCanchas}
                      disabled={savingAvailability}
                      className="bg-primary hover:bg-primary-hover text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-70 cursor-pointer"
                    >
                      {savingAvailability ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Save size={14} />
                      )}
                      {savingAvailability ? 'Guardando...' : 'Guardar Horarios de Canchas'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

          </div>
        )}

        {/* Modal Simulado y Real */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <form onSubmit={handleSaveCancha} className="bg-surface border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-in">
              <div className="p-6 border-b border-border bg-surface-secondary">
                <h3 className="text-xl font-bold">{editingCanchaId ? 'Editar Cancha' : 'Agregar Instalación'}</h3>
              </div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-hide">
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl">
                    {error}
                  </div>
                )}
                {misClubes.length > 1 && (
                  <div>
                    <label className="text-sm font-bold text-stone-500 mb-1 block">Club</label>
                    <select
                      value={organizacionId || ''}
                      onChange={(e) => setOrganizacionId(parseInt(e.target.value))}
                      className="w-full bg-surface border border-border rounded-lg p-3 focus:ring-2 focus:ring-primary outline-none"
                    >
                      {misClubes.map(club => (
                        <option key={club.id} value={club.id}>{club.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-sm font-bold text-stone-500 mb-1 block">Número o Identificador</label>
                  <input 
                    required 
                    type="number" 
                    value={numeroCancha} 
                    onChange={(e) => setNumeroCancha(e.target.value)} 
                    placeholder="Ej: 5" 
                    className="w-full bg-surface border border-border rounded-lg p-3 focus:ring-2 focus:ring-primary outline-none placeholder-slate-500" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-stone-500 mb-1 block">Deporte</label>
                    <select 
                      value={deporte} 
                      onChange={(e) => setDeporte(e.target.value)} 
                      className="w-full bg-surface border border-border rounded-lg p-3 focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="Tenis">Tenis</option>
                      <option value="Padel">Pádel</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-stone-500 mb-1 block">Superficie</label>
                    <select 
                      value={superficie} 
                      onChange={(e) => setSuperficie(e.target.value)} 
                      className="w-full bg-surface border border-border rounded-lg p-3 focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="Polvo de Ladrillo">Polvo de Ladrillo</option>
                      <option value="Cemento">Cemento</option>
                      <option value="Sintético (Blindex)">Sintético (Blindex)</option>
                      <option value="Césped Sintético">Césped Sintético</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 mt-2 border-t border-border">
                  <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><DollarSign size={16}/> Precios por Hora</h4>
                  
                  <div className="bg-surface/50 p-4 rounded-xl border border-border mb-4">
                    <h5 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Tarifa Jugadores</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-bold text-stone-600 mb-1 block">Tarifa Día ($)</label>
                        <input 
                          required 
                          type="number" 
                          value={precioDia} 
                          onChange={(e) => setPrecioDia(e.target.value)} 
                          className="w-full bg-surface border border-border rounded-lg p-3 focus:ring-2 focus:ring-primary outline-none" 
                        />
                      </div>
                      <div>
                        <label className="text-sm font-bold text-stone-600 mb-1 block">Tarifa Noche ($)</label>
                        <input 
                          required 
                          type="number" 
                          value={precioNoche} 
                          onChange={(e) => setPrecioNoche(e.target.value)} 
                          className="w-full bg-surface border border-border rounded-lg p-3 focus:ring-2 focus:ring-primary outline-none" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 mb-4">
                    <h5 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Tarifa Profesores</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-bold text-stone-600 mb-1 block">Tarifa Día ($)</label>
                        <input 
                          required 
                          type="number" 
                          value={precioProfesorDia} 
                          onChange={(e) => setPrecioProfesorDia(e.target.value)} 
                          className="w-full bg-surface border border-primary/30 rounded-lg p-3 focus:ring-2 focus:ring-primary outline-none" 
                        />
                      </div>
                      <div>
                        <label className="text-sm font-bold text-stone-600 mb-1 block">Tarifa Noche ($)</label>
                        <input 
                          required 
                          type="number" 
                          value={precioProfesorNoche} 
                          onChange={(e) => setPrecioProfesorNoche(e.target.value)} 
                          className="w-full bg-surface border border-primary/30 rounded-lg p-3 focus:ring-2 focus:ring-primary outline-none" 
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="text-sm font-bold text-stone-500 mb-1 block">Inicio Tarifa Nocturna</label>
                    <input 
                      required 
                      type="time" 
                      value={horaNoche} 
                      onChange={(e) => setHoraNoche(e.target.value)} 
                      className="w-full bg-surface border border-border rounded-lg p-3 focus:ring-2 focus:ring-primary outline-none" 
                    />
                    <p className="text-xs text-stone-500 mt-1">A partir de esta hora se aplicará la "Tarifa Noche".</p>
                  </div>
                </div>

              </div>
              <div className="p-6 bg-surface-secondary border-t border-border flex gap-3 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-foreground font-bold hover:bg-surface rounded-xl transition-colors cursor-pointer border border-border bg-surface">Cancelar</button>
                <button type="submit" disabled={savingCancha} className="px-5 py-2.5 bg-primary text-white font-bold hover:bg-primary-hover shadow-sm rounded-xl transition-all cursor-pointer flex items-center gap-1">
                  {savingCancha && <Loader2 size={14} className="animate-spin" />}
                  {editingCanchaId ? 'Guardar Cambios' : 'Crear Cancha'}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
