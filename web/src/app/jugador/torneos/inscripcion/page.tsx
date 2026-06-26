'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, CreditCard, ShieldCheck, Users, CalendarDays, ArrowRight, ArrowLeft, Loader2, MapPin } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function InscripcionTorneoGenericoPage() {
  // Datos crudos de torneos activos
  const [torneosActivos, setTorneosActivos] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [deporte, setDeporte] = useState('Tenis');
  const [fechaInicio, setFechaInicio] = useState('');
  const [loadingTorneos, setLoadingTorneos] = useState(true);

  // Estados de selección
  const [selectedEventName, setSelectedEventName] = useState<string>('');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('');
  const [modalidad, setModalidad] = useState<'Single' | 'Dobles' | 'Ambos'>('Single');
  
  // Tarifas del torneo específico seleccionado
  const [tarifas, setTarifas] = useState<any>(null);
  const [loadingTarifas, setLoadingTarifas] = useState(false);
  
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const platformFee = 1000; // Service Fee del SaaS

  // 1. Cargar todos los torneos activos
  // Cargar información del usuario (rol y club asociado) y torneos activos
  useEffect(() => {
    const init = async () => {
      try {
        // Obtener sesión y metadatos de usuario
        const { data: { user } } = await supabase.auth.getUser();
        const role = (user?.app_metadata?.role as string) || '';
        const clubId = (user?.app_metadata?.club_id as string) || '';
        setUserRole(role);
        setSelectedClubId(role === 'superadmin' ? '' : clubId);

        // Obtener lista de clubs (organizaciones)
        const { data: clubsData, error: clubsError } = await supabase
          .from('organizaciones')
          .select('id, nombre');
        if (clubsError) throw clubsError;
        setClubs(clubsData || []);

        // Obtener torneos activos
        const { data: torneosData, error: torneosError } = await supabase
          .from('torneos')
          .select(`*, organizaciones(id, nombre)`)
          .eq('activo', true)
          .eq('fase_actual', 'Inscripcion');
        if (torneosError) throw torneosError;

        // Filtrar según rol y requerir fecha de inicio
        let filtered = (torneosData || []).filter(t => !!t.fecha_inicio);
        if (role === 'admin' || role === 'professor') {
          // mantener solo torneos del club asociado
          filtered = filtered.filter(t => t.organizaciones?.id === clubId);
        }
        // superadmin ve todos
        setTorneosActivos(filtered);
      } catch (err) {
        console.error('Error inicializando datos:', err);
      } finally {
        setLoadingTorneos(false);
      }
    };
    init();
  }, []);

  // 2. Agrupar torneos por "Nombre Base" (Evento)
  const eventosAgrupados = useMemo(() => {
    const grupos: Record<string, any[]> = {};
    torneosActivos.forEach(t => {
      // Extraemos el nombre base removiendo " - Cat X"
      const baseName = t.nombre_torneo.split(' - Cat ')[0];
      if (!grupos[baseName]) {
        grupos[baseName] = [];
      }
      grupos[baseName].push(t);
    });
    return grupos;
  }, [torneosActivos]);

  // 3. Cuando se elige un evento o cambia la categoría, resetear/cargar tarifas
  useEffect(() => {
    if (!selectedEventName || !selectedCategoria) {
      setTarifas(null);
      return;
    }

    const torneoSeleccionado = eventosAgrupados[selectedEventName]?.find(
      (t) => t.categoria_torneo === selectedCategoria
    );

    if (torneoSeleccionado) {
      setLoadingTarifas(true);
      supabase
        .from('tarifas_torneo')
        .select('*')
        .eq('torneo_id', torneoSeleccionado.id)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setTarifas({
              Single: data.precio_single,
              Dobles: data.precio_dobles,
              Ambos: data.precio_ambos
            });
          }
          setLoadingTarifas(false);
        });
    }
  }, [selectedEventName, selectedCategoria, eventosAgrupados]);

  // Cuando cambia el evento, limpiamos la categoría
  const handleEventChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedEventName(e.target.value);
    setSelectedCategoria('');
    setCheckoutUrl(null);
  };

  const torneoSeleccionadoData = selectedEventName && selectedCategoria
    ? eventosAgrupados[selectedEventName]?.find(t => t.categoria_torneo === selectedCategoria)
    : null;

  // Actualizar fecha de inicio cuando se selecciona un torneo
  useEffect(() => {
    if (torneoSeleccionadoData?.fecha_inicio) {
      setFechaInicio(torneoSeleccionadoData.fecha_inicio);
    }
  }, [torneoSeleccionadoData]);

  // Determinar si las inscripciones están cerradas (fecha actual > fecha_inicio)
  const inscripcionesCerradas = torneoSeleccionadoData && torneoSeleccionadoData.fecha_inicio && new Date() > new Date(torneoSeleccionadoData.fecha_inicio + 'T00:00:00');

  const handleInscripcion = async () => {
    setLoadingSubmit(true);
    try {
      // Simulación de creación de preferencia Mercado Pago
      setTimeout(() => {
        setCheckoutUrl("https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=SIMULATED_PREF_ID");
        setLoadingSubmit(false);
      }, 1500);
    } catch (error) {
      console.error(error);
      setLoadingSubmit(false);
    }
  };

  if (loadingTorneos) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary" size={48} />
          <p className="text-muted font-medium">Buscando torneos disponibles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8 font-sans text-foreground animate-fade-in">
      <div className="max-w-3xl mx-auto">
        
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col gap-2">
            <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-surface-secondary border border-border rounded-xl hover:border-primary/50 hover:bg-surface-secondary/80 transition-all text-foreground text-sm font-medium w-fit shadow-sm">
              <ArrowLeft size={18} />
              Volver al Inicio
            </Link>
            {inscripcionesCerradas && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-center font-bold animate-pulse w-fit text-sm">
                Inscripciones cerradas
              </div>
            )}
          </div>
          {torneoSeleccionadoData && ['admin', 'professor', 'superadmin'].includes(userRole) && (
            <Link
              href={`/organizador/torneos/editar/${torneoSeleccionadoData.id}`}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-md shadow-primary/20 text-sm"
            >
              <Trophy size={16} />
              Editar Torneo
            </Link>
          )}
        </div>

        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6 shadow-sm border border-primary/20 animate-bounce-subtle">
            <Trophy size={32} />
          </div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Inscripción Oficial</h1>
          <p className="text-muted mt-2 text-lg">Elige el torneo y la categoría en la que deseas participar.</p>
        </div>

        <div className="bg-surface-secondary/40 backdrop-blur-md rounded-3xl shadow-md border border-border overflow-hidden animate-slide-up">
          
          <div className="p-6 md:p-8 space-y-8">
            
            {/* Paso 0: Selección de Club */}
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">1. Selecciona el Club</label>
              <select
                value={selectedClubId}
                onChange={(e) => { setSelectedClubId(e.target.value); setSelectedEventName(''); setSelectedCategoria(''); }}
                className="w-full bg-surface border border-border text-foreground rounded-xl p-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none text-base font-bold cursor-pointer"
                style={{
                  backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%23a8a29e\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E")',
                  backgroundPosition: 'right 1.2rem center',
                  backgroundSize: '1.5em 1.5em',
                  backgroundRepeat: 'no-repeat'
                }}
              >
                <option value="" disabled>-- Elige un Club --</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

            {/* Paso 1: Selección de Torneo (Evento) */}
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">2. Selecciona el Tipo de Torneo</label>
              {Object.keys(eventosAgrupados).length === 0 ? (
                <div className="p-4 bg-surface border border-border rounded-xl text-muted text-sm">
                  No hay torneos abiertos en este momento.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Deporte</label>
                      <select 
                        value={deporte}
                        onChange={(e) => setDeporte(e.target.value)}
                        className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none cursor-pointer"
                        style={{
                          backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%23a8a29e\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E")',
                          backgroundPosition: 'right 1rem center',
                          backgroundSize: '1.2rem 1.2rem',
                          backgroundRepeat: 'no-repeat'
                        }}
                      >
                        <option value="Tenis">Tenis</option>
                        <option value="Pádel">Pádel</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block flex items-center gap-1">
                        <CalendarDays size={14} /> Fecha de Inicio
                      </label>
                      <p className="w-full bg-surface border border-border text-foreground rounded-xl p-3 font-mono text-sm leading-tight h-[46px] flex items-center">{fechaInicio || 'Selecciona un evento'}</p>
                    </div>
                  </div>
                  
                  <select 
                    value={selectedEventName}
                    onChange={handleEventChange}
                    className="w-full bg-surface border border-border text-foreground rounded-xl p-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none text-base font-bold cursor-pointer"
                    style={{
                      backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%23a8a29e\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E")',
                      backgroundPosition: 'right 1.2rem center',
                      backgroundSize: '1.5em 1.5em',
                      backgroundRepeat: 'no-repeat'
                    }}
                  >
                    <option value="" disabled>-- Elige un Evento --</option>
                    {Object.keys(eventosAgrupados).filter(eventName => {
                      const torneo = eventosAgrupados[eventName][0];
                      return selectedClubId ? torneo?.organizaciones?.id === selectedClubId : true;
                    }).map(eventName => (
                      <option key={eventName} value={eventName}>{eventName}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Paso 2: Selección de Categoría */}
            {selectedEventName && (
              <div className="animate-scale-in">
                <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 flex items-center justify-between">
                  3. Selecciona tu Categoría
                  <span className="text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-full font-bold">
                    {eventosAgrupados[selectedEventName]?.length} niveles disponibles
                  </span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {eventosAgrupados[selectedEventName]?.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedCategoria(t.categoria_torneo)}
                      className={`p-3.5 rounded-xl border-2 transition-all font-bold ${
                        selectedCategoria === t.categoria_torneo
                          ? 'border-primary bg-primary/10 text-primary shadow-sm'
                          : 'border-border bg-surface text-muted hover:border-primary/30 hover:bg-surface-secondary'
                      }`}
                    >
                      {t.categoria_torneo}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Información del Club Seleccionado */}
            {torneoSeleccionadoData && (
              <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 flex items-center gap-3 animate-fade-in">
                <MapPin className="text-primary" size={20} />
                <div>
                  <p className="text-xs text-muted font-medium uppercase tracking-wider">Club</p>
                  <p className="font-bold text-foreground">{torneoSeleccionadoData.organizaciones?.nombre}</p>
                </div>
              </div>
            )}

            {/* Paso 3: Modalidad y Pago */}
            {selectedCategoria && (
              <div className="border-t border-border pt-8 animate-slide-up">
                {loadingTarifas ? (
                  <div className="flex items-center gap-2 text-muted">
                    <Loader2 className="animate-spin text-primary" size={20} /> Cargando tarifas...
                  </div>
                ) : tarifas ? (
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                        <Users size={20} className="text-primary" />
                        4. Modalidad de Juego
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <button
                          onClick={() => setModalidad('Single')}
                          className={`p-4 rounded-2xl border-2 transition-all text-left ${
                            modalidad === 'Single' 
                              ? 'border-primary bg-primary/10 shadow-sm' 
                              : 'border-border bg-surface hover:border-primary/20 hover:bg-surface-secondary'
                          }`}
                        >
                          <div className="font-bold text-foreground text-lg">Single</div>
                          <div className="text-muted text-sm mt-1">1 Jugador</div>
                        </button>
                        <button
                          onClick={() => setModalidad('Dobles')}
                          className={`p-4 rounded-2xl border-2 transition-all text-left ${
                            modalidad === 'Dobles' 
                              ? 'border-primary bg-primary/10 shadow-sm' 
                              : 'border-border bg-surface hover:border-primary/20 hover:bg-surface-secondary'
                          }`}
                        >
                          <div className="font-bold text-foreground text-lg">Dobles</div>
                          <div className="text-muted text-sm mt-1">2 Jugadores</div>
                        </button>
                        <button
                          onClick={() => setModalidad('Ambos')}
                          className={`p-4 rounded-2xl border-2 transition-all text-left ${
                            modalidad === 'Ambos' 
                              ? 'border-primary bg-primary/15 shadow-sm' 
                              : 'border-border bg-surface hover:border-primary/25 hover:bg-primary/5'
                          }`}
                        >
                          <div className="font-bold text-primary text-lg">Combo (Ambos)</div>
                          <div className="text-muted text-sm mt-1">Single + Dobles</div>
                        </button>
                      </div>
                    </div>

                    {/* Botón de Pago Mercado Pago */}
                    <div className="pt-2">
                      {!checkoutUrl ? (
                        <button
                          onClick={handleInscripcion}
                          disabled={loadingSubmit || !!inscripcionesCerradas}
                          className="w-full bg-[#009EE3] hover:bg-[#0088C4] text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-3 disabled:opacity-75 disabled:cursor-not-allowed group relative overflow-hidden text-lg"
                        >
                          {loadingSubmit ? (
                            <div className="flex items-center gap-3">
                              <Loader2 className="animate-spin" size={20} />
                              Asegurando entorno de pago...
                            </div>
                          ) : inscripcionesCerradas ? (
                            <>
                              <CreditCard size={22} />
                              <span>Inscripciones Cerradas</span>
                            </>
                          ) : (
                            <>
                              <CreditCard size={22} />
                              <span>Pagar con Mercado Pago (${tarifas ? (tarifas[modalidad] + platformFee) : 0} ARS)</span>
                              <ArrowRight size={20} className="absolute right-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 text-center animate-scale-in">
                          <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-4">
                            <ShieldCheck size={24} />
                          </div>
                          <h4 className="text-emerald-500 font-bold text-lg mb-2">Entorno Seguro Generado</h4>
                          <a 
                            href={checkoutUrl}
                            className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl transition-all"
                          >
                            Proceder al Checkout
                          </a>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-center gap-2 mt-4 text-muted text-xs font-medium">
                        <ShieldCheck size={14} />
                        Transacción procesada por Mercado Pago Marketplace. Cobro directo al Club.
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                    No se encontraron las tarifas para esta categoría.
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
