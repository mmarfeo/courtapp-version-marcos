'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Save, ArrowLeft, Target, Loader2, CheckSquare, Calendar, Users, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchOrganizaciones } from '@/lib/queries/adminQueries';

const TODAS_CATEGORIAS = ['SuperA', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D'];

export default function NuevoTorneoPage() {
  const [nombre, setNombre] = useState('');
  const [deporte, setDeporte] = useState('Tenis');
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<string[]>(['B']);
  
  const [precioSingle, setPrecioSingle] = useState('');
  const [precioDobles, setPrecioDobles] = useState('');
  const [precioAmbos, setPrecioAmbos] = useState('');
  
  const [organizacionId, setOrganizacionId] = useState<number | ''>('');
  
  // Nueva fecha de inicio del torneo
  const [fechaInicio, setFechaInicio] = useState('');
  const [cantSets, setCantSets] = useState(3);
  
  // Reglas de Zonas
  const [partidosAsegurados, setPartidosAsegurados] = useState(2);
  const [clasificadosPorZona, setClasificadosPorZona] = useState(2);
  const [enviarNotificacion, setEnviarNotificacion] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clubes disponibles desde Supabase
  const [clubesDisponibles, setClubesDisponibles] = useState<any[]>([]);
  const [loadingClubes, setLoadingClubes] = useState(true);

  useEffect(() => {
    const cargarClubes = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { data: memberOrgs, error } = await supabase
            .from('miembros_organizacion')
            .select('organizacion_id, organizaciones(*)')
            .eq('usuario_id', userData.user.id);
            
          if (!error && memberOrgs) {
            // @ts-ignore
            const orgs = memberOrgs.map((m: any) => m.organizaciones).filter(o => o?.activa);
            setClubesDisponibles(orgs);
            if (orgs.length === 1) {
              setOrganizacionId(orgs[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Error al cargar clubes:", err);
      } finally {
        setLoadingClubes(false);
      }
    };
    cargarClubes();
  }, []);

  const toggleCategoria = (cat: string) => {
    setCategoriasSeleccionadas(prev => 
      prev.includes(cat) 
        ? prev.filter(c => c !== cat) 
        : [...prev, cat]
    );
  };

  const seleccionarTodas = () => {
    if (categoriasSeleccionadas.length === TODAS_CATEGORIAS.length) {
      setCategoriasSeleccionadas([]); // Deseleccionar todas
    } else {
      setCategoriasSeleccionadas([...TODAS_CATEGORIAS]); // Seleccionar todas
    }
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!organizacionId) {
      setError("Debes seleccionar un club para el torneo.");
      return;
    }

    if (!fechaInicio) {
      setError("Debes seleccionar la fecha de inicio del torneo.");
      return;
    }
    
    if (categoriasSeleccionadas.length === 0) {
      setError("Debes seleccionar al menos una categoría.");
      return;
    }

    setLoading(true);

    try {
      // Por cada categoría seleccionada, creamos un registro de torneo independiente (para manejar cuadros y llaves separados)
      for (const cat of categoriasSeleccionadas) {
        // 1. Insertar Torneo
        const { data: torneo, error: tError } = await supabase
          .from('torneos')
          .insert([{
            organizacion_id: Number(organizacionId),
            nombre_torneo: `${nombre} - Cat ${cat}`,
            categoria_torneo: cat,
            deporte: deporte,
            fase_actual: 'Inscripcion',
            activo: true,
            fecha_inicio: fechaInicio, // Guardamos la fecha de inicio
            formato_sets: `${cantSets}_sets`,
            partidos_asegurados_por_zona: partidosAsegurados,
            clasificados_por_zona: clasificadosPorZona
          }])
          .select()
          .single();

        if (tError) throw new Error(tError.message);

        // 2. Insertar Tarifas
        const { error: pError } = await supabase
          .from('tarifas_torneo')
          .insert([{
            torneo_id: torneo.id,
            precio_single: parseFloat(precioSingle),
            precio_dobles: parseFloat(precioDobles),
            precio_ambos: parseFloat(precioAmbos)
          }]);

        if (pError) throw new Error(pError.message);
      }

      if (enviarNotificacion) {
        try {
          const { data: tokensData } = await supabase.from('push_tokens').select('token');

          if (tokensData && tokensData.length > 0) {
            const tokens = tokensData.map((t: any) => t.token);
            const chunks = [];
            for (let i = 0; i < tokens.length; i += 100) chunks.push(tokens.slice(i, i + 100));

            for (const chunk of chunks) {
              const messages = chunk.map(token => ({
                to: token,
                sound: 'default',
                title: '¡Nuevo Torneo Abierto!',
                body: `Se han creado torneos para "${nombre.trim()}" en varias categorías. ¡Inscríbete ya!`,
              }));
              
              const { data: { session } } = await supabase.auth.getSession();
              const token = session?.access_token;

              await fetch('/api/notifications/send', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ messages })
              });
            }
          }
        } catch (err) {
          console.error("Error al enviar notificaciones push:", err);
        }
      }

      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al crear el torneo. Verifica los permisos de Supabase.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSuccess(false);
    setError(null);
    setNombre('');
    setPrecioSingle('');
    setPrecioDobles('');
    setPrecioAmbos('');
    setCategoriasSeleccionadas(['B']);
    setOrganizacionId('');
    setPartidosAsegurados(2);
    setClasificadosPorZona(2);
    setEnviarNotificacion(true);
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 font-sans text-foreground animate-fade-in">
      <div className="max-w-3xl mx-auto">
        
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/dashboard" className="p-3 bg-surface-secondary border border-border rounded-xl hover:border-primary/50 hover:bg-surface-secondary/80 transition-all shadow-sm">
            <ArrowLeft size={20} className="text-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
              <Trophy className="text-primary animate-bounce-subtle" size={28} /> Crear Torneo
            </h1>
            <p className="text-muted text-sm mt-1">Configura un nuevo evento, categorías y costos de inscripción.</p>
          </div>
        </div>

        <div className="bg-surface-secondary/40 backdrop-blur-md border border-border rounded-3xl p-6 md:p-8 shadow-md hover:shadow-lg transition-all duration-300 animate-slide-up">
          {success ? (
            <div className="text-center py-10 animate-scale-in">
              <div className="w-16 h-16 bg-primary/10 text-primary border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target size={32} />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">¡Torneos Creados!</h2>
              <p className="text-muted mb-8">Se han generado exitosamente los torneos para las {categoriasSeleccionadas.length} categorías seleccionadas. Ya se encuentran en fase de Inscripción abierta al público.</p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <button onClick={handleReset} className="px-6 py-3 bg-surface text-foreground font-bold rounded-xl hover:bg-surface-secondary transition-all border border-border">
                  Crear otro torneo
                </button>
                <Link href="/admin/dashboard" className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover transition-all shadow-md shadow-primary/20 text-center">
                  Volver al Dashboard
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleGuardar} className="space-y-8">
              
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-medium">
                  {error}
                </div>
              )}

              {/* Bloque 1: General */}
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
                  <Users size={18} className="text-primary" /> Datos Generales
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Nombre Oficial del Torneo</label>
                    <input 
                      required
                      type="text" 
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej: Copa Verano 2026" 
                      className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted/50" 
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Deporte</label>
                    <select 
                      value={deporte}
                      onChange={(e) => setDeporte(e.target.value)}
                      className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none cursor-pointer pr-10"
                      style={{
                        backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%23a8a29e\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E")',
                        backgroundPosition: 'right 1rem center',
                        backgroundSize: '1.5em 1.5em',
                        backgroundRepeat: 'no-repeat'
                      }}
                    >
                      <option value="Tenis">Tenis</option>
                      <option value="Pádel">Pádel</option>
                    </select>
                  </div>
                </div>

                {/* Fecha de Inicio y Formato del Partido */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block flex items-center gap-1">
                      <Calendar size={14} /> Fecha de Inicio
                    </label>
                    <input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Cantidad de Sets</label>
                    <input
                      type="number"
                      min="1"
                      max="3"
                      value={cantSets}
                      onChange={(e) => setCantSets(parseInt(e.target.value) || 1)}
                      className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted/50 font-mono"
                    />
                  </div>
                </div>

                {/* Reglas de Zonas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Partidos Asegurados por Zona</label>
                    <input
                      type="number"
                      min="1"
                      value={partidosAsegurados}
                      onChange={(e) => setPartidosAsegurados(parseInt(e.target.value) || 1)}
                      className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted/50 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Clasificados por Zona</label>
                    <input
                      type="number"
                      min="1"
                      value={clasificadosPorZona}
                      onChange={(e) => setClasificadosPorZona(parseInt(e.target.value) || 1)}
                      className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted/50 font-mono"
                    />
                  </div>
                </div>

                {/* Selección de Categorías (Multiselect) */}
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-xs font-bold text-muted uppercase tracking-wider">Categorías a Habilitar</label>
                    <button 
                      type="button" 
                      onClick={seleccionarTodas}
                      className="text-xs font-bold text-primary hover:text-primary-hover transition-colors flex items-center gap-1">
                      <CheckSquare size={14} />
                      {categoriasSeleccionadas.length === TODAS_CATEGORIAS.length ? 'Deseleccionar Todas' : 'Seleccionar Todas'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {TODAS_CATEGORIAS.map(cat => (
                      <label 
                        key={cat} 
                        className={`flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          categoriasSeleccionadas.includes(cat)
                            ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm'
                            : 'bg-surface border-border text-muted hover:border-primary/30 hover:bg-surface-secondary'
                        }`}
                      >
                        <input 
                          type="checkbox"
                          className="hidden"
                          checked={categoriasSeleccionadas.includes(cat)}
                          onChange={() => toggleCategoria(cat)}
                        />
                        {cat}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted mt-2">
                    Se creará un fixture independiente en la base de datos para cada categoría seleccionada.
                  </p>
                </div>

                {/* Selección de Club */}
                <div>
                  <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Asignar a Club</label>
                  {loadingClubes ? (
                    <div className="flex items-center gap-2 text-muted p-3 bg-surface border border-border rounded-xl">
                      <Loader2 size={18} className="animate-spin" /> Cargando clubes...
                    </div>
                  ) : (
                    <select 
                      required
                      value={organizacionId}
                      onChange={(e) => setOrganizacionId(Number(e.target.value))}
                      className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none cursor-pointer pr-10"
                      style={{
                        backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%23a8a29e\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E")',
                        backgroundPosition: 'right 1rem center',
                        backgroundSize: '1.5em 1.5em',
                        backgroundRepeat: 'no-repeat'
                      }}
                    >
                      <option value="" disabled>Selecciona un club...</option>
                      {clubesDisponibles.map(club => (
                        <option key={club.id} value={club.id}>{club.nombre}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Bloque 2: Tarifas */}
              <div className="space-y-4 pt-2">
                <h3 className="text-lg font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
                  <DollarSign size={18} className="text-primary" /> Estructura de Costos
                </h3>
                <p className="text-xs text-muted mb-4">El valor final que verá el jugador incluirá automáticamente el Service Fee del SaaS.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Pase Single</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold">$</span>
                      <input 
                        required
                        type="number" 
                        value={precioSingle}
                        onChange={(e) => setPrecioSingle(e.target.value)}
                        placeholder="25000" 
                        className="w-full bg-surface border border-border text-foreground rounded-xl p-3 pl-8 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Pase Dobles</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold">$</span>
                      <input 
                        required
                        type="number" 
                        value={precioDobles}
                        onChange={(e) => setPrecioDobles(e.target.value)}
                        placeholder="18000" 
                        className="w-full bg-surface border border-border text-foreground rounded-xl p-3 pl-8 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-primary uppercase tracking-wider mb-1.5 block">Combo (Ambos)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold">$</span>
                      <input 
                        required
                        type="number" 
                        value={precioAmbos}
                        onChange={(e) => setPrecioAmbos(e.target.value)}
                        placeholder="35000" 
                        className="w-full bg-primary/10 border border-primary/30 text-primary rounded-xl p-3 pl-8 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    enviarNotificacion ? 'bg-primary border-primary' : 'bg-surface border-border group-hover:border-primary/50'
                  }`}>
                    {enviarNotificacion && <CheckSquare size={14} className="text-white" />}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden" 
                    checked={enviarNotificacion}
                    onChange={(e) => setEnviarNotificacion(e.target.checked)}
                  />
                  <span className="text-sm font-medium text-muted group-hover:text-foreground transition-colors">Enviar notificación push a los jugadores</span>
                </label>

                <button 
                  type="submit" 
                  disabled={loading || loadingClubes}
                  className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md shadow-primary/20 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
                >
                  {loading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Save size={20} />
                  )}
                  {loading ? 'Aperturando Torneos...' : 'Confirmar Torneo'}
                </button>
              </div>

            </form>
          )}
        </div>

      </div>
    </div>
  );
}
