'use client';

import React, { useState, useEffect } from 'react';
import { UserPlus, Save, ArrowLeft, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchOrganizaciones } from '@/lib/queries/adminQueries';

export default function NuevoStaffPage() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rolesSeleccionados, setRolesSeleccionados] = useState<string[]>(['Profesor']);
  
  // Soporte para múltiples clubes
  const [selectedClubs, setSelectedClubs] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Clubes disponibles desde Supabase
  const [clubesDisponibles, setClubesDisponibles] = useState<any[]>([]);
  const [loadingClubes, setLoadingClubes] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let isSuper = false;
        if (user) {
          const { data: profile } = await supabase.from('perfiles_usuarios').select('rol').eq('id', user.id).single();
          isSuper = profile?.rol === 'SuperAdmin';
          setIsSuperAdmin(isSuper);
        }

        const orgs = await fetchOrganizaciones();
        let orgsActivas = orgs.filter((o: any) => o.activa);

        if (!isSuper && user) {
          const { data: membresias } = await supabase.from('miembros_organizacion').select('organizacion_id').eq('usuario_id', user.id);
          const userOrgIds = membresias?.map(m => m.organizacion_id) || [];
          orgsActivas = orgsActivas.filter((o: any) => userOrgIds.includes(o.id));
        }

        setClubesDisponibles(orgsActivas);
      } catch (err) {
        console.error("Error al cargar datos:", err);
      } finally {
        setLoadingClubes(false);
      }
    };
    cargarDatos();
  }, []);

  const handleToggleClub = (clubId: number) => {
    setSelectedClubs(prev => 
      prev.includes(clubId) 
        ? prev.filter(id => id !== clubId)
        : [...prev, clubId]
    );
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (rolesSeleccionados.length === 0) {
      setError("Debes seleccionar al menos un nivel de acceso (rol) para la persona.");
      return;
    }
    
    if (selectedClubs.length === 0) {
      setError("Debes seleccionar al menos un club para asignar a la persona.");
      return;
    }
    setLoading(true);

    try {
      const { data: authSession } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email,
          password,
          nombre,
          roles: rolesSeleccionados,
          organizacion_ids: selectedClubs
        }
      });

      if (error) throw new Error(error.message || 'Error al conectar con el servidor');
      if (data && !data.success) throw new Error(data.error || 'Error desconocido al crear usuario');

      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al crear el usuario.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 font-sans text-foreground animate-fade-in">
      <div className="max-w-2xl mx-auto">
        
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/dashboard" className="p-3 bg-surface-secondary border border-border rounded-xl hover:border-primary/50 hover:bg-surface-secondary/80 transition-all shadow-sm">
            <ArrowLeft size={20} className="text-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
              <UserPlus className="text-primary animate-bounce-subtle" size={28} /> Alta de Staff
            </h1>
            <p className="text-muted text-sm mt-1">Registra nuevos Administradores (Organizadores) o Profesores para los clubes.</p>
          </div>
        </div>

        <div className="bg-surface-secondary/40 border border-border rounded-3xl p-6 md:p-8 shadow-md hover:shadow-lg transition-all duration-300 backdrop-blur-md animate-slide-up">
          {success ? (
            <div className="text-center py-10 animate-scale-in">
              <div className="w-16 h-16 bg-primary/10 text-primary border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Usuario Registrado</h2>
              <p className="text-muted mb-8">La cuenta se ha creado exitosamente con el perfil de {rolesSeleccionados.join(' y ')} en los clubes seleccionados.</p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <button onClick={() => {setSuccess(false); setNombre(''); setEmail(''); setPassword(''); setSelectedClubs([]); setRolesSeleccionados(['Profesor']); setError('');}} className="px-6 py-3 bg-surface text-foreground font-bold rounded-xl hover:bg-surface-secondary transition-all border border-border">
                  Registrar otro usuario
                </button>
                <Link href="/admin/dashboard" className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover transition-all shadow-md shadow-primary/20">
                  Volver al Dashboard
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleGuardar} className="space-y-6">
              
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-medium">
                  {error}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Nombre Completo</label>
                <input 
                  required
                  type="text" 
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Juan Pérez" 
                  className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted/50" 
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Correo Electrónico</label>
                <input 
                  required
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="juan@tenisclub.com" 
                  className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted/50" 
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Contraseña Temporal</label>
                <input 
                  required
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres" 
                  minLength={6}
                  className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono placeholder:text-muted/50 text-sm" 
                />
              </div>

              {/* Selector de Rol Dinámico */}
              <div className="pt-4 border-t border-border">
                <label className="text-xs font-bold text-muted uppercase tracking-wider mb-3 block">Nivel de Acceso (Puedes seleccionar ambos)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className={`flex flex-col p-4 border rounded-xl cursor-pointer transition-all ${rolesSeleccionados.includes('Profesor') ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm' : 'bg-surface border-border text-muted hover:border-primary/20 hover:bg-surface-secondary'}`}>
                    <input 
                      type="checkbox" 
                      checked={rolesSeleccionados.includes('Profesor')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRolesSeleccionados(prev => [...prev, 'Profesor']);
                        } else {
                          setRolesSeleccionados(prev => prev.filter(r => r !== 'Profesor'));
                        }
                      }}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2 mb-1">
                      <UserPlus size={16} />
                      <span>Profesor</span>
                    </div>
                    <span className="text-xs text-muted font-normal">Gestiona sus propias clases y agenda.</span>
                  </label>
                  
                  {isSuperAdmin && (
                    <label className={`flex flex-col p-4 border rounded-xl cursor-pointer transition-all ${rolesSeleccionados.includes('Organizador') ? 'bg-primary/15 border-primary text-primary font-bold shadow-sm' : 'bg-surface border-border text-muted hover:border-primary/25 hover:bg-surface-secondary'}`}>
                      <input 
                        type="checkbox" 
                        checked={rolesSeleccionados.includes('Organizador')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setRolesSeleccionados(prev => [...prev, 'Organizador']);
                          } else {
                            setRolesSeleccionados(prev => prev.filter(r => r !== 'Organizador'));
                          }
                        }}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck size={16} />
                        <span>Organizador</span>
                      </div>
                      <span className="text-xs text-muted font-normal">Administrador total del club (Canchas, Torneos).</span>
                    </label>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <label className="text-xs font-bold text-muted uppercase tracking-wider mb-3 block">Asignación de Clubes (Multi-selección)</label>
                <p className="text-xs text-muted mb-3 font-medium">Un profesor puede estar asignado a varios clubes simultáneamente.</p>
                {loadingClubes ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="animate-spin text-primary" size={24} />
                    <span className="ml-3 text-muted text-sm">Cargando clubes...</span>
                  </div>
                ) : clubesDisponibles.length === 0 ? (
                  <div className="p-4 bg-surface border border-border rounded-xl text-muted text-sm text-center">
                    No hay clubes activos disponibles. Crea un club primero.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {clubesDisponibles.map((club) => (
                      <label key={club.id} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${selectedClubs.includes(club.id) ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border bg-surface hover:bg-surface-secondary text-foreground'}`}>
                        <input 
                          type="checkbox" 
                          checked={selectedClubs.includes(club.id)}
                          onChange={() => handleToggleClub(club.id)}
                          className="w-5 h-5 text-primary rounded focus:ring-primary bg-surface border-border"
                        />
                        <span className="font-semibold">{club.nombre}</span>
                        <span className="text-xs text-muted ml-auto font-mono">/{club.slug}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-border flex justify-end">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md shadow-primary/20 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <Save size={20} />
                  )}
                  {loading ? 'Creando cuenta...' : 'Confirmar Alta'}
                </button>
              </div>

            </form>
          )}
        </div>

      </div>
    </div>
  );
}
