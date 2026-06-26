'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, CreditCard, ShieldCheck, Users, CalendarDays, ArrowRight, ArrowLeft, Loader2, MapPin } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function InscripcionTorneoPage({ params }: { params: { id: string } }) {
  const [modalidad, setModalidad] = useState<'Single' | 'Dobles' | 'Ambos'>('Single');
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const [userRole, setUserRole] = useState<string>('');

  const platformFee = 1000; // Service Fee del SaaS referencial

  // Estados para datos reales
  const [torneo, setTorneo] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [errorData, setErrorData] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [partnerFound, setPartnerFound] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [availability, setAvailability] = useState<{ [key: string]: boolean }>({});

  // Estados para inscripción pagada por compañero
  const [alreadyRegisteredComplete, setAlreadyRegisteredComplete] = useState(false);
  const [hasPaidInvite, setHasPaidInvite] = useState(false);
  const [paidByPartnerInfo, setPaidByPartnerInfo] = useState<any>(null);

  const confirmOnlyMode = hasPaidInvite && modalidad === 'Dobles';

  const handlePartnerEmailChange = (email: string) => {
    setPartnerEmail(email);
    if (!email) {
      setPartnerFound(false);
      setPartnerName('');
      setSelectedPartnerId('');
      return;
    }

    const foundPlayer = players.find(p => p.email.toLowerCase().trim() === email.toLowerCase().trim());
    if (foundPlayer) {
      setPartnerFound(true);
      setPartnerName(foundPlayer.nombre);
      setSelectedPartnerId(foundPlayer.id);
    } else {
      setPartnerFound(false);
      setPartnerName('');
      setSelectedPartnerId('');
    }
  };

  const DAYS_EN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  const DAYS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const HOURS = Array.from({ length: 17 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`);

  const toggleCell = (day: string, hour: string) => {
    setAvailability(prev => ({
      ...prev,
      [`${day}_${hour}`]: !prev[`${day}_${hour}`]
    }));
  };

  const copyDayAvailability = (sourceDay: string) => {
    setAvailability(prev => {
      const updated = { ...prev };
      DAYS_EN.forEach(targetDay => {
        if (targetDay !== sourceDay) {
          HOURS.forEach(hour => {
            updated[`${targetDay}_${hour}`] = prev[`${sourceDay}_${hour}`] || false;
          });
        }
      });
      return updated;
    });
  };

  useEffect(() => {
    const fetchTorneoData = async () => {
      try {
        // Obtener rol del usuario
        const { data: { user } } = await supabase.auth.getUser();
        const role = (user?.app_metadata?.role as string) || '';
        setUserRole(role);

        // 1. Obtener datos del torneo
        const { data: tData, error: tError } = await supabase
          .from('torneos')
          .select('*')
          .eq('id', params.id)
          .single();

        if (tError) throw new Error("No se pudo cargar la información del torneo.");
        if (!tData) throw new Error("Torneo no encontrado.");
        if (!tData.fecha_inicio) throw new Error("Este torneo no está habilitado para inscripciones porque aún no tiene una fecha de inicio definida.");

        // 2. Obtener las tarifas del torneo
        const { data: pData, error: pError } = await supabase
          .from('tarifas_torneo')
          .select('*')
          .eq('torneo_id', params.id)
          .single();

        if (pError) throw new Error("No se pudieron cargar las tarifas del torneo.");

        setTorneo({
          ...tData,
          tarifas: {
            Single: pData?.precio_single || 0,
            Dobles: pData?.precio_dobles || 0,
            Ambos: pData?.precio_ambos || 0
          }
        });

        // 3. Obtener la lista de otros jugadores para dobles
        if (user) {
          const { data: usersData } = await supabase
            .from('perfiles_usuarios')
            .select('id, nombre, email')
            .neq('id', user.id);
          
          if (usersData) {
            setPlayers(usersData);

            // A. Verificar inscripción propia del usuario actual
            const { data: ownRegistration } = await supabase
              .from('inscripciones_torneo')
              .select('*')
              .eq('torneo_id', Number(params.id))
              .eq('usuario_id', user.id)
              .maybeSingle();

            // B. Verificar disponibilidad cargada
            const { data: ownAvailability } = await supabase
              .from('propuestas_disponibilidad')
              .select('id')
              .eq('torneo_id', Number(params.id))
              .eq('jugador_1_id', user.id);

            const hasAvailability = ownAvailability && ownAvailability.length >= 2;

            if (ownRegistration && ownRegistration.estado_pago === 'Aprobado') {
              if (hasAvailability) {
                // Ya completó todo
                setAlreadyRegisteredComplete(true);
                setModalidad(ownRegistration.modalidad);
                // Cargar datos de la pareja si los hay
                if (ownRegistration.pareja_email) {
                  const partner = usersData.find(p => p.email?.toLowerCase().trim() === ownRegistration.pareja_email.toLowerCase().trim());
                  setPartnerEmail(ownRegistration.pareja_email);
                  if (partner) {
                    setPartnerFound(true);
                    setPartnerName(partner.nombre);
                    setSelectedPartnerId(partner.id);
                  }
                }
              } else {
                // Ya está pago pero le falta disponibilidad
                setHasPaidInvite(true);
                setModalidad(ownRegistration.modalidad);
                if (ownRegistration.pareja_email) {
                  const partner = usersData.find(p => p.email?.toLowerCase().trim() === ownRegistration.pareja_email.toLowerCase().trim());
                  setPartnerEmail(ownRegistration.pareja_email);
                  if (partner) {
                    setPartnerFound(true);
                    setPartnerName(partner.nombre);
                    setSelectedPartnerId(partner.id);
                    setPaidByPartnerInfo({ nombre: partner.nombre, email: partner.email });
                  } else {
                    setPaidByPartnerInfo({ email: ownRegistration.pareja_email });
                  }
                }
              }
            } else {
              // Si no tiene inscripción propia aprobada, verificar si alguien más lo invitó y pagó por él
              const { data: inviteData } = await supabase
                .from('inscripciones_torneo')
                .select('usuario_id, modalidad, pareja_email')
                .eq('torneo_id', Number(params.id))
                .eq('pareja_email', user.email?.toLowerCase().trim())
                .eq('estado_pago', 'Aprobado')
                .maybeSingle();

              if (inviteData) {
                const partnerId = inviteData.usuario_id;
                const foundPartner = usersData.find(p => p.id === partnerId);
                if (foundPartner) {
                  setPartnerEmail(foundPartner.email || '');
                  setPartnerFound(true);
                  setPartnerName(foundPartner.nombre || '');
                  setSelectedPartnerId(partnerId);
                  setPaidByPartnerInfo({ nombre: foundPartner.nombre, email: foundPartner.email });
                } else {
                  setPaidByPartnerInfo({ email: inviteData.pareja_email });
                }
                setHasPaidInvite(true);
                // Si su pareja lo inscribió, la modalidad para él es Dobles
                setModalidad('Dobles');
              } else {
                // Flujo normal: buscar si alguien lo invitó (aunque no haya pagado aún)
                const { data: pendingInvite } = await supabase
                  .from('inscripciones_torneo')
                  .select('usuario_id')
                  .eq('torneo_id', Number(params.id))
                  .eq('pareja_email', user.email?.toLowerCase().trim())
                  .maybeSingle();

                if (pendingInvite) {
                  const partnerId = pendingInvite.usuario_id;
                  const foundPartner = usersData.find(p => p.id === partnerId);
                  if (foundPartner) {
                    setPartnerEmail(foundPartner.email || '');
                    setPartnerFound(true);
                    setPartnerName(foundPartner.nombre || '');
                    setSelectedPartnerId(partnerId);
                  }
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.error(err);
        setErrorData(err.message);
      } finally {
        setLoadingData(false);
      }
    };

    fetchTorneoData();
  }, [params.id]);

  const handleInscripcion = async () => {
    setLoading(true);
    setSubmitError(null);

    const selectedSlots = Object.entries(availability)
      .filter(([_, isSelected]) => isSelected)
      .map(([key]) => key);

    if (selectedSlots.length < 2) {
      setSubmitError("Debes seleccionar al menos 2 bloques horarios de disponibilidad para inscribirte.");
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No has iniciado sesión.");

      // 1. Insertar/Upsert inscripción
      let insError;
      if (confirmOnlyMode) {
        // Modo Confirmación: ya pagó su compañero, se inscribe con montos en 0
        const { error } = await supabase
          .from('inscripciones_torneo')
          .upsert({
            torneo_id: Number(params.id),
            usuario_id: user.id,
            modalidad: modalidad,
            monto_total_pagado: 0,
            comision_plataforma: 0,
            monto_neto_club: 0,
            estado_pago: 'Aprobado',
            fecha_pago: new Date().toISOString(),
            pareja_usuario_id: (modalidad === 'Dobles' || modalidad === 'Ambos') && selectedPartnerId ? selectedPartnerId : null,
            pareja_email: (modalidad === 'Dobles' || modalidad === 'Ambos') && partnerEmail ? partnerEmail.toLowerCase().trim() : null
          }, { onConflict: 'torneo_id,usuario_id' });
        insError = error;
      } else {
        // Modo Pago: el usuario paga por toda la pareja
        let totalPrecio = 0;
        let totalComision = 0;
        let totalNeto = 0;

        const basePrice = torneo.tarifas[modalidad] || 0;
        if (modalidad === 'Single') {
          totalPrecio = basePrice + platformFee;
          totalComision = platformFee;
          totalNeto = basePrice;
        } else if (modalidad === 'Dobles') {
          totalPrecio = (basePrice + platformFee) * 2;
          totalComision = platformFee * 2;
          totalNeto = basePrice * 2;
        } else if (modalidad === 'Ambos') {
          const precioDobles = torneo.tarifas['Dobles'] || 0;
          totalPrecio = (basePrice + platformFee) + (precioDobles + platformFee);
          totalComision = platformFee * 2;
          totalNeto = basePrice + precioDobles;
        }

        const { error } = await supabase
          .from('inscripciones_torneo')
          .upsert({
            torneo_id: Number(params.id),
            usuario_id: user.id,
            modalidad: modalidad,
            monto_total_pagado: totalPrecio,
            comision_plataforma: totalComision,
            monto_neto_club: totalNeto,
            estado_pago: 'Aprobado',
            fecha_pago: new Date().toISOString(),
            pareja_usuario_id: (modalidad === 'Dobles' || modalidad === 'Ambos') && selectedPartnerId ? selectedPartnerId : null,
            pareja_email: (modalidad === 'Dobles' || modalidad === 'Ambos') && partnerEmail ? partnerEmail.toLowerCase().trim() : null
          }, { onConflict: 'torneo_id,usuario_id' });
        insError = error;

        // Si el compañero ya existe en perfiles_usuarios, inscribirlo automáticamente en estado Aprobado con monto 0
        if (!insError && (modalidad === 'Dobles' || modalidad === 'Ambos') && selectedPartnerId) {
          await supabase
            .from('inscripciones_torneo')
            .upsert({
              torneo_id: Number(params.id),
              usuario_id: selectedPartnerId,
              modalidad: 'Dobles',
              monto_total_pagado: 0,
              comision_plataforma: 0,
              monto_neto_club: 0,
              estado_pago: 'Aprobado',
              fecha_pago: new Date().toISOString(),
              pareja_usuario_id: user.id,
              pareja_email: user.email?.toLowerCase().trim()
            }, { onConflict: 'torneo_id,usuario_id' });
        }
      }

      if (insError) throw insError;

      // Auto-enlace de parejas: si es Dobles/Ambos
      if (modalidad === 'Dobles' || modalidad === 'Ambos') {
        const { data: partnerInscripcion } = await supabase
          .from('inscripciones_torneo')
          .select('usuario_id')
          .eq('torneo_id', Number(params.id))
          .eq('pareja_email', user.email?.toLowerCase().trim())
          .neq('usuario_id', user.id)
          .maybeSingle();

        if (partnerInscripcion) {
          const partnerUserId = partnerInscripcion.usuario_id;
          
          await supabase
            .from('inscripciones_torneo')
            .update({ pareja_usuario_id: user.id })
            .eq('torneo_id', Number(params.id))
            .eq('usuario_id', partnerUserId);

          await supabase
            .from('inscripciones_torneo')
            .update({ pareja_usuario_id: partnerUserId })
            .eq('torneo_id', Number(params.id))
            .eq('usuario_id', user.id);
        }
      }

      // 2. Mapear disponibilidad semanal a fechas reales a partir de fecha_inicio del torneo
      const daysMap: { [key: string]: number } = {
        lunes: 1,
        martes: 2,
        miercoles: 3,
        jueves: 4,
        viernes: 5,
        sabado: 6,
        domingo: 0
      };

      const startDateStr = torneo.fecha_inicio;
      if (!startDateStr) throw new Error("El torneo no tiene una fecha de inicio definida.");

      const proposals = selectedSlots.map(slot => {
        const [dayName, hourStr] = slot.split('_');
        
        // Calcular fecha real
        const targetDayOfWeek = daysMap[dayName];
        const start = new Date(startDateStr + 'T00:00:00');
        const startDayOfWeek = start.getDay();
        
        let diff = targetDayOfWeek - startDayOfWeek;
        if (diff < 0) {
          diff += 7;
        }
        
        const resultDate = new Date(start);
        resultDate.setDate(start.getDate() + diff);
        const fechaDisponible = resultDate.toISOString().split('T')[0];

        const [h, m] = hourStr.split(':');
        const horaInicio = `${h}:${m}:00`;
        const horaFin = `${(parseInt(h) + 1).toString().padStart(2, '0')}:${m}:00`;

        return {
          torneo_id: Number(params.id),
          jugador_1_id: user.id,
          categoria_inscripta: torneo.categoria_torneo,
          fecha_disponible: fechaDisponible,
          hora_inicio_disponible: horaInicio,
          hora_fin_disponible: horaFin,
          asignado_a_partido: false
        };
      });

      // Limpiar disponibilidades previas
      await supabase
        .from('propuestas_disponibilidad')
        .delete()
        .eq('torneo_id', Number(params.id))
        .eq('jugador_1_id', user.id);

      // Insertar nuevas disponibilidades
      const { error: propError } = await supabase
        .from('propuestas_disponibilidad')
        .insert(proposals);

      if (propError) throw propError;

      // Simulación de checkout o confirmación directa
      setTimeout(() => {
        if (confirmOnlyMode) {
          setCheckoutUrl("confirmed");
        } else {
          setCheckoutUrl("https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=SIMULATED_PREF_ID");
        }
        setLoading(false);
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setSubmitError(err.message || "Ocurrió un error al procesar tu inscripción.");
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary" size={48} />
          <p className="text-muted font-medium">Obteniendo datos del torneo...</p>
        </div>
      </div>
    );
  }

  if (errorData || !torneo) {
    return (
      <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-center font-sans text-foreground animate-fade-in">
        <div className="bg-surface-secondary/45 backdrop-blur-md p-8 rounded-3xl max-w-md w-full text-center border border-border shadow-md animate-scale-in">
          <Trophy size={48} className="text-muted mx-auto mb-4 animate-bounce-subtle" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Error al Cargar</h2>
          <p className="text-muted mb-6">{errorData || "Torneo no disponible"}</p>
          <Link href="/" className="inline-flex px-6 py-3 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl transition-all shadow-md shadow-primary/20">
            Volver al Inicio
          </Link>
        </div>
      </div>
    );
  }

  // Determinar si las inscripciones están cerradas (fecha actual > fecha_inicio)
  const inscripcionesCerradas = torneo && torneo.fecha_inicio && new Date() > new Date(torneo.fecha_inicio + 'T00:00:00');

  const getPrecioTotal = () => {
    if (!torneo) return 0;
    const basePrice = torneo.tarifas[modalidad] || 0;
    if (modalidad === 'Single') {
      return basePrice + platformFee;
    }
    if (modalidad === 'Dobles') {
      return (basePrice + platformFee) * 2;
    }
    if (modalidad === 'Ambos') {
      const precioDobles = torneo.tarifas['Dobles'] || 0;
      return (basePrice + platformFee) + (precioDobles + platformFee);
    }
    return 0;
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8 font-sans text-foreground animate-fade-in">
      <div className="max-w-3xl mx-auto">
        
        {/* Botón Volver */}
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
          {torneo && ['admin', 'professor', 'superadmin'].includes(userRole) && (
            <Link
              href={`/organizador/torneos/editar/${torneo.id}`}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-md shadow-primary/20 text-sm"
            >
              <Trophy size={16} />
              Editar Torneo
            </Link>
          )}
        </div>

        {/* Encabezado */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6 shadow-sm border border-primary/20 animate-bounce-subtle">
            <Trophy size={32} />
          </div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Inscripción Oficial</h1>
          <p className="text-muted mt-2 text-lg">{torneo.nombre_torneo}</p>
        </div>

        {alreadyRegisteredComplete ? (
          <div className="bg-surface-secondary/40 backdrop-blur-md rounded-3xl shadow-md border border-border p-8 text-center space-y-6 animate-scale-in">
            <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <Trophy size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-foreground">¡Ya estás anotado en este torneo!</h2>
              <p className="text-muted text-sm">Tu registro y disponibilidad horaria han sido guardados correctamente.</p>
            </div>
            
            <div className="bg-surface border border-border rounded-2xl p-6 max-w-md mx-auto text-left space-y-4 shadow-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted text-sm">Modalidad</span>
                <span className="text-foreground font-bold">{modalidad}</span>
              </div>
              {partnerEmail && (
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted text-sm">Compañero</span>
                  <span className="text-foreground font-bold">{partnerName || partnerEmail}</span>
                </div>
              )}
              <div className="flex justify-between pb-2">
                <span className="text-muted text-sm">Estado de Pago</span>
                <span className="text-emerald-500 font-bold bg-emerald-500/10 px-2.5 py-1 rounded text-xs border border-emerald-500/20">Aprobado ✓</span>
              </div>
            </div>

            <div className="pt-4">
              <Link href="/" className="inline-flex px-8 py-3.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl transition-all shadow-md shadow-primary/20">
                Ir al Panel Principal
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-surface-secondary/40 backdrop-blur-md rounded-3xl shadow-md border border-border overflow-hidden animate-slide-up">
            
            {/* Detalles del Torneo */}
            <div className="p-6 md:p-8 border-b border-border bg-surface/25 flex flex-col sm:flex-row justify-between items-center gap-6">
              <div className="flex gap-4 items-center w-full sm:w-auto">
                <div className="bg-surface p-3 rounded-xl border border-border shadow-sm text-center min-w-[80px]">
                  <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Cat</p>
                  <p className="text-2xl font-black text-foreground">{torneo.categoria_torneo}</p>
                </div>
                <div>
                  <p className="font-bold text-foreground">{torneo.deporte}</p>
                  <div className="flex items-center gap-2 text-sm text-muted mt-1">
                    <CalendarDays size={16} />
                    Inicio: {torneo.fecha_inicio ? new Date(torneo.fecha_inicio + 'T00:00:00').toLocaleDateString('es-AR') : 'A confirmar'}
                  </div>
                </div>
              </div>
              <div className="bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-full text-sm font-bold border border-emerald-500/20 flex items-center gap-2 whitespace-nowrap shadow-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                Cupos Disponibles
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-8">
              
              {/* Alert banner for form validation errors */}
              {submitError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-start gap-3 animate-scale-in">
                  <span className="font-semibold">{submitError}</span>
                </div>
              )}

              {/* Banner informativo de inscripción pre-pagada por compañero */}
              {paidByPartnerInfo && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm flex flex-col gap-1.5 animate-scale-in">
                  <span className="font-bold text-base flex items-center gap-2">🎉 ¡Inscripción Bonificada!</span>
                  <span>
                    Tu compañero/a {paidByPartnerInfo.nombre ? <strong className="text-foreground">{paidByPartnerInfo.nombre} ({paidByPartnerInfo.email})</strong> : <strong className="text-foreground">{paidByPartnerInfo.email}</strong>} ya realizó el pago de tu inscripción para este torneo.
                  </span>
                  <span className="text-xs text-muted mt-1">
                    Solo necesitas seleccionar al menos 2 bloques horarios de disponibilidad abajo y confirmar para completar tu registro.
                  </span>
                </div>
              )}

              {/* Selección de Modalidad */}
              <div>
                <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                  <Users size={20} className="text-primary" />
                  Modalidad de Juego
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button
                    type="button"
                    disabled={hasPaidInvite}
                    onClick={() => setModalidad('Single')}
                    className={`p-4 rounded-2xl border-2 transition-all text-left ${
                      hasPaidInvite ? 'opacity-50 cursor-not-allowed' : ''
                    } ${
                      modalidad === 'Single' 
                        ? 'border-primary bg-primary/10 shadow-sm' 
                        : 'border-border bg-surface ' + (hasPaidInvite ? '' : 'hover:border-primary/20 hover:bg-surface-secondary')
                    }`}
                  >
                    <div className="font-bold text-foreground text-lg">Single</div>
                    <div className="text-muted text-sm mt-1">1 Jugador</div>
                  </button>
                  <button
                    type="button"
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
                    type="button"
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

              {/* Selección de Compañero (Solo para Dobles / Ambos) */}
              {(modalidad === 'Dobles' || modalidad === 'Ambos') && (
                <div className="space-y-3 animate-scale-in">
                  <h3 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
                    <Users size={20} className="text-primary" />
                    Compañero de Dobles
                  </h3>
                  <p className="text-xs text-muted">
                    {hasPaidInvite 
                      ? "Compañero vinculado para este torneo."
                      : "Ingresa el email de tu compañero de dobles. Si no se ha registrado aún en la plataforma, no te preocupes: cuando se inscriba, el sistema los unirá automáticamente."}
                  </p>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="Email de tu compañero (ej: compañero@email.com)"
                      value={partnerEmail}
                      disabled={hasPaidInvite}
                      onChange={(e) => handlePartnerEmailChange(e.target.value)}
                      className={`w-full bg-surface border border-border text-foreground rounded-xl p-3.5 pr-28 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted/50 text-sm ${
                        hasPaidInvite ? 'opacity-65 cursor-not-allowed bg-surface-secondary' : ''
                      }`}
                    />
                    {partnerEmail && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {partnerFound ? (
                          <span className="text-emerald-500 text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                            Registrado ✓
                          </span>
                        ) : (
                          <span className="text-amber-500 text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                            No registrado ⚠️
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {partnerEmail && partnerFound && (
                    <p className="text-xs text-emerald-500 font-semibold">
                      Compañero encontrado: <span className="font-bold">{partnerName}</span>
                    </p>
                  )}
                  {partnerEmail && !partnerFound && (
                    <p className="text-xs text-muted font-medium">
                      Tu compañero no está registrado aún en CourtUp. Podrá inscribirse más tarde usando este mismo email para asociarse automáticamente.
                    </p>
                  )}
                </div>
              )}

              {/* Grilla de Disponibilidad Horaria */}
              <div className="space-y-3">
                <h3 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
                  <CalendarDays size={20} className="text-primary" />
                  Disponibilidad Horaria Semanal
                </h3>
                <p className="text-xs text-muted">
                  Marca al menos <span className="text-primary font-bold">2 bloques horarios</span> de 1 hora en los que estás disponible para jugar. Tu disponibilidad se usará para programar los partidos de forma automática.
                </p>
                
                <div className="overflow-x-auto rounded-2xl border border-border bg-surface/40 shadow-sm">
                  <div className="min-w-[700px]">
                    {/* Headers */}
                    <div className="grid grid-cols-9 border-b border-border bg-surface p-2 text-center text-xs font-bold text-muted">
                      <div className="col-span-2 text-left pl-3 flex items-center text-foreground font-bold">Hora</div>
                      {DAYS_ES.map((day, idx) => (
                        <div key={day} className="flex flex-col items-center justify-center gap-1 border-l border-border/40">
                          <span className="text-foreground">{day}</span>
                          <button
                            type="button"
                            onClick={() => copyDayAvailability(DAYS_EN[idx])}
                            className="text-[9px] text-primary hover:text-primary-hover font-bold uppercase tracking-wider transition-colors"
                          >
                            Copiar a todos
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    {/* Grid Body */}
                    <div className="max-h-[350px] overflow-y-auto divide-y divide-border/20">
                      {HOURS.map(hour => (
                        <div key={hour} className="grid grid-cols-9 hover:bg-surface-secondary/40 text-center text-xs">
                          <div className="col-span-2 flex items-center justify-start pl-4 font-mono font-bold text-muted bg-surface/10 h-10 border-r border-border/40">
                            {hour} - {`${(parseInt(hour.split(':')[0]) + 1).toString().padStart(2, '0')}:00`}
                          </div>
                          {DAYS_EN.map(day => {
                            const isChecked = !!availability[`${day}_${hour}`];
                            return (
                              <div
                                key={`${day}_${hour}`}
                                onClick={() => toggleCell(day, hour)}
                                className={`flex items-center justify-center h-10 cursor-pointer border-r border-border/10 last:border-r-0 transition-all ${
                                  isChecked 
                                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black' 
                                    : 'text-muted/30 hover:bg-surface-secondary/50'
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
              </div>

              {/* Desglose de precios en caso de Pago */}
              {!confirmOnlyMode && (
                <>
                  {hasPaidInvite && modalidad === 'Ambos' ? (
                    <div className="mb-4 bg-surface border border-border rounded-2xl p-4 text-xs space-y-2 text-muted shadow-sm animate-scale-in">
                      <p className="font-bold text-foreground text-sm mb-1">Resumen de Actualización a Combo</p>
                      <div className="flex justify-between">
                        <span>Inscripción Combo (Single + Dobles)</span>
                        <span className="font-semibold text-foreground">${torneo.tarifas['Ambos']} ARS</span>
                      </div>
                      <div className="flex justify-between text-emerald-500">
                        <span>Bonificación de compañero (Dobles)</span>
                        <span className="font-semibold">-${torneo.tarifas['Dobles']} ARS</span>
                      </div>
                      <div className="flex justify-between border-t border-border pt-2 text-primary font-bold">
                        <span>Total a pagar (Diferencia)</span>
                        <span>${getPrecioTotal()} ARS</span>
                      </div>
                    </div>
                  ) : (
                    (modalidad === 'Dobles' || modalidad === 'Ambos') && (
                      <div className="mb-4 bg-surface border border-border rounded-2xl p-4 text-xs space-y-2 text-muted shadow-sm animate-scale-in">
                        <p className="font-bold text-foreground text-sm mb-1">Resumen de Inscripción en Pareja</p>
                        <div className="flex justify-between">
                          <span>Tu inscripción ({modalidad})</span>
                          <span className="font-semibold text-foreground">${torneo.tarifas[modalidad]} ARS</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Inscripción de tu compañero (Dobles)</span>
                          <span className="font-semibold text-foreground">${torneo.tarifas['Dobles']} ARS</span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-2 text-muted">
                          <span>Cargos de servicio de plataforma (x2)</span>
                          <span className="font-semibold text-foreground">${platformFee * 2} ARS</span>
                        </div>
                      </div>
                    )
                  )}
                </>
              )}

              {/* Botón de Pago Mercado Pago */}
              <div className="pt-4">
                {!checkoutUrl ? (
                  <button
                    onClick={handleInscripcion}
                    disabled={loading || !!inscripcionesCerradas}
                    className={`w-full text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-md flex items-center justify-center gap-3 disabled:opacity-75 disabled:cursor-not-allowed group relative overflow-hidden ${
                      confirmOnlyMode 
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10' 
                        : 'bg-[#009EE3] hover:bg-[#0088C4] shadow-blue-500/10'
                    }`}
                  >
                    {loading ? (
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {confirmOnlyMode ? 'Confirmando disponibilidad...' : 'Asegurando entorno de pago...'}
                      </div>
                    ) : inscripcionesCerradas ? (
                      <>
                        <ShieldCheck size={22} />
                        <span className="text-lg">Inscripciones Cerradas</span>
                      </>
                    ) : confirmOnlyMode ? (
                      <>
                        <ShieldCheck size={22} />
                        <span className="text-lg">Confirmar Inscripción (Gratis - Bonificada)</span>
                        <ArrowRight size={20} className="absolute right-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </>
                    ) : hasPaidInvite && modalidad === 'Ambos' ? (
                      <>
                        <CreditCard size={22} />
                        <span className="text-lg">Pagar Diferencia (${getPrecioTotal()} ARS)</span>
                        <ArrowRight size={20} className="absolute right-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </>
                    ) : (
                      <>
                        <CreditCard size={22} />
                        <span className="text-lg">Pagar con Mercado Pago (${getPrecioTotal()} ARS)</span>
                        <ArrowRight size={20} className="absolute right-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </>
                    )}
                  </button>
                ) : checkoutUrl === 'confirmed' ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 text-center animate-scale-in">
                    <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-400/20 shadow-sm shadow-emerald-500/10">
                      <ShieldCheck size={24} />
                    </div>
                    <h4 className="text-emerald-500 font-bold text-lg mb-2">¡Inscripción Confirmada!</h4>
                    <p className="text-muted text-sm mb-4">
                      {hasPaidInvite && modalidad === 'Ambos'
                        ? `Tu disponibilidad horaria ha sido registrada y has actualizado tu inscripción a Combo (Single + Dobles) con ${partnerName || partnerEmail} exitosamente.`
                        : `Tu disponibilidad horaria ha sido registrada y tu inscripción de dobles con ${partnerName || partnerEmail} está completa.`}
                    </p>
                    <Link 
                      href="/torneos"
                      className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md shadow-emerald-500/10"
                    >
                      Ver Torneos
                    </Link>
                  </div>
                ) : (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 text-center animate-scale-in">
                    <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                      <ShieldCheck size={24} />
                    </div>
                    <h4 className="text-emerald-500 font-bold text-lg mb-2">Entorno Seguro Generado</h4>
                    <a 
                      href={checkoutUrl}
                      className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md shadow-emerald-500/10"
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
          </div>
        )}
      </div>
    </div>
  );
}
