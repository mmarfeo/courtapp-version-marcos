'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Trophy, LogOut, ChevronDown, Loader2, User, Shield, GraduationCap, Calendar, Wallet, ChevronRight } from 'lucide-react';
import Link from 'next/link';

type UserRole = 'Jugador' | 'Profesor' | 'Organizador' | 'SuperAdmin';

interface UserProfile {
  nombre: string;
  email: string;
  rol: UserRole;
  roles?: UserRole[];
  foto_url?: string;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (profile?.nombre) {
      setEditName(profile.nombre);
    }
  }, [profile?.nombre]);

  // Auto-hide on authentication routes
  const isAuthRoute = pathname === '/login' || pathname === '/auth/callback' || pathname === '/reset-password';

  // 1. Listen for auth changes and set user
  useEffect(() => {
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (active) {
        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Fetch profile when user state changes
  useEffect(() => {
    let active = true;
    if (!user) return;

    const getProfile = async () => {
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('perfiles_usuarios')
          .select('nombre, email, rol, roles, foto_url')
          .eq('id', user.id)
          .single();

        if (profileError) {
          if ((profileError as any).status === 401) {
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
            return;
          }
          throw profileError;
        }

        if (active && profileData) {
          setProfile(profileData as UserProfile);
        }
      } catch (err) {
        console.error('Error loading user profile:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    getProfile();

    return () => {
      active = false;
    };
  }, [user]);

  // 2. Handle route protection and redirections on pathname or auth state changes
  useEffect(() => {
    if (loading || isAuthRoute) return;

    const isPublicRoute = pathname === '/' || pathname === '/torneos' || pathname === '/clases';
    if (!user && !isPublicRoute) {
      router.push('/login');
    }
  }, [pathname, user, loading, isAuthRoute, router]);

  // Handle clicking outside the dropdown to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (isAuthRoute) return null;

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editName.trim()) return;
    setSavingName(true);
    try {
      const { error } = await supabase
        .from('perfiles_usuarios')
        .update({ nombre: editName.trim() })
        .eq('id', user.id);

      if (error) throw error;
      setProfile(prev => prev ? { ...prev, nombre: editName.trim() } : null);
      setEditModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Error al guardar el nombre');
    } finally {
      setSavingName(false);
    }
  };

  const handleLogout = async () => {
    setDropdownOpen(false);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Server signOut failed:', e);
    }
    router.push('/login');
  };

  const handleRoleSwitch = async (newRole: UserRole) => {
    if (!user || !profile || profile.rol === newRole) {
      setDropdownOpen(false);
      return;
    }
    
    setSwitchingRole(true);
    setDropdownOpen(false);

    try {
      // 1. Update the database role
      const { error: updateError } = await supabase
        .from('perfiles_usuarios')
        .update({ rol: newRole })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // 2. Force token claims synchronization in Supabase
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw refreshError;

      // 3. Update local state representation
      setProfile(prev => prev ? { ...prev, rol: newRole } : null);

      // 4. Redirect user based on their new target workspace
      setTimeout(() => {
        setSwitchingRole(false);
        if (newRole === 'SuperAdmin') {
          router.push('/admin/dashboard');
        } else if (newRole === 'Organizador') {
          router.push('/organizador/torneos/nuevo');
        } else if (newRole === 'Profesor') {
          router.push('/profesor/agenda');
        } else if (newRole === 'Jugador') {
          router.push('/jugador/dashboard');
        } else {
          router.push('/torneos');
        }
      }, 800);
      
    } catch (err) {
      console.error('Error switching user role:', err);
      alert('Hubo un problema al cambiar tu rol. Por favor inténtalo de nuevo.');
      setSwitchingRole(false);
    }
  };

  const getRoleIcon = (roleName: UserRole) => {
    switch (roleName) {
      case 'SuperAdmin': return <Shield size={14} className="text-primary" />;
      case 'Organizador': return <Trophy size={14} className="text-primary" />;
      case 'Profesor': return <GraduationCap size={14} className="text-primary" />;
      case 'Jugador': return <User size={14} className="text-primary" />;
    }
  };

  const getRoleBadgeStyle = (roleName: UserRole) => {
    return 'bg-primary/10 text-primary border border-primary/20';
  };

  const getUserInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Loading overlay for role switching */}
      {switchingRole && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-primary" size={40} />
          <p className="text-white font-bold text-sm tracking-wide">Cambiando perfil de usuario...</p>
        </div>
      )}

      <nav className="bg-surface/80 border-b border-border sticky top-0 z-[50] backdrop-blur-md transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <Trophy className="text-primary transition-transform group-hover:scale-110" size={24} />
            <span className="text-xl font-bold tracking-tight">
              Court<span className="text-primary">Up</span>
            </span>
          </Link>

          {/* Center Links */}
          <div className="hidden md:flex items-center gap-6 text-sm">
            {(profile?.rol === 'Organizador' || profile?.rol === 'SuperAdmin') && (
              <>
                <Link href="/admin/torneos-dashboard" className={`hover:text-primary transition-colors ${pathname.includes('/torneos-dashboard') ? 'text-primary font-bold' : 'text-muted'}`}>
                  Dashboard Torneos
                </Link>
                <Link href="/organizador/torneos/nuevo" className={`hover:text-primary transition-colors ${pathname.includes('/organizador/torneos') ? 'text-primary font-bold' : 'text-muted'}`}>
                  Torneos
                </Link>
                <Link href="/organizador/canchas" className={`hover:text-primary transition-colors ${pathname.includes('/canchas') ? 'text-primary font-bold' : 'text-muted'}`}>
                  Canchas
                </Link>
              </>
            )}
            {profile?.rol === 'Profesor' && (
              <>
                <Link href="/profesor/clases/nueva" className={`hover:text-primary transition-colors ${pathname.includes('/clases/nueva') ? 'text-primary font-bold' : 'text-muted'}`}>
                  Publicar Clase
                </Link>
                <Link href="/profesor/agenda" className={`hover:text-primary transition-colors ${pathname.includes('/agenda') ? 'text-primary font-bold' : 'text-muted'}`}>
                  Agenda
                </Link>
                <Link href="/profesor/pagos" className={`hover:text-primary transition-colors ${pathname.includes('/pagos') ? 'text-primary font-bold' : 'text-muted'}`}>
                  Mis Pagos
                </Link>
              </>
            )}
            {profile?.rol === 'SuperAdmin' && (
              <Link href="/admin/dashboard" className={`hover:text-primary transition-colors ${pathname.includes('/admin/dashboard') ? 'text-primary font-bold' : 'text-muted'}`}>
                Dashboard Admin
              </Link>
            )}
            {profile?.rol === 'Jugador' && (
              <Link href="/jugador/dashboard" className={`hover:text-primary transition-colors ${pathname.includes('/jugador/dashboard') ? 'text-primary font-bold' : 'text-muted'}`}>
                Mi Dashboard
              </Link>
            )}
          </div>

          {/* User Auth Controls */}
          <div className="flex items-center gap-4">
            {loading ? (
              <Loader2 className="animate-spin text-primary" size={20} />
            ) : user && profile ? (
              <div className="relative flex items-center gap-2" ref={dropdownRef}>
                
                {/* User Card trigger */}
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-3 p-1.5 pl-3 rounded-full hover:bg-surface-secondary border border-transparent hover:border-border transition-all outline-none"
                >
                  <div className="flex flex-col text-right hidden sm:flex">
                    <span className="text-xs font-bold">{profile.nombre}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full mt-0.5 inline-flex items-center gap-1 font-semibold uppercase tracking-wider ${getRoleBadgeStyle(profile.rol)}`}>
                      {getRoleIcon(profile.rol)}
                      {profile.rol}
                    </span>
                  </div>
                  
                  {/* User Profile Avatar / Initial */}
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0 shadow-inner ring-2 ring-primary/20">
                    {profile.foto_url ? (
                      <img src={profile.foto_url} alt={profile.nombre} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      getUserInitials(profile.nombre)
                    )}
                  </div>
                  <ChevronDown size={14} className={`text-muted transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 top-14 w-60 bg-surface border border-border rounded-2xl shadow-2xl p-2 z-50 animate-scale-in">
                    
                    {/* Header info inside dropdown */}
                    <div className="px-4 py-3 border-b border-border mb-2">
                      <p className="text-xs text-muted uppercase font-bold tracking-wider">Identificado como</p>
                      <p className="text-sm font-bold truncate mt-0.5">{profile.nombre}</p>
                      <p className="text-xs text-muted truncate">{profile.email}</p>
                      <button 
                        onClick={() => { setEditModalOpen(true); setDropdownOpen(false); }}
                        className="mt-2 text-[10px] text-primary hover:underline font-bold flex items-center gap-1"
                      >
                        <User size={10} />
                        Editar Perfil
                      </button>
                    </div>

                    {/* Role Switcher Section */}
                    {(() => {
                      const isSuperAdmin = profile.email === 'nicortiz29@gmail.com' || profile.email === 'nicortiz29+admin@gmail.com';
                      const rolesToShow = isSuperAdmin
                        ? (['Jugador', 'Profesor', 'Organizador', 'SuperAdmin'] as UserRole[])
                        : (profile.roles && profile.roles.length > 1
                            ? (profile.roles.filter(r => r !== 'SuperAdmin') as UserRole[])
                            : []);

                      if (rolesToShow.length <= 1) return null;

                      return (
                        <>
                          <div className="px-3 py-2">
                            <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-2">Cambiar Rol Activo</p>
                            <div className="space-y-1">
                              {rolesToShow.map((r) => (
                                <button
                                  key={r}
                                  onClick={() => handleRoleSwitch(r)}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                                    profile.rol === r
                                      ? 'bg-primary/10 border border-primary/20 text-primary'
                                      : 'hover:bg-surface-secondary text-muted hover:text-foreground'
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    {getRoleIcon(r)}
                                    {r}
                                  </span>
                                  {profile.rol === r && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="border-t border-border my-2"></div>
                        </>
                      );
                    })()}

                    {/* Logout Button */}
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut size={16} />
                      Cerrar Sesión
                    </button>
                  </div>
                )}

              </div>
            ) : (
              <Link
                href="/login"
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-primary/10"
              >
                Iniciar Sesión
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scale-in">
            <h3 className="text-lg font-bold mb-4">Editar Perfil</h3>
            <form onSubmit={handleSaveName} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Nombre Completo</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-surface-secondary border border-border rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-primary transition-all text-foreground"
                  required
                />
              </div>

              {profile?.rol === 'Profesor' && (
                <div className="pt-2">
                  <Link href="/profesor/pagos" onClick={() => setEditModalOpen(false)} className="w-full flex items-center justify-between p-3 bg-primary/10 rounded-xl hover:bg-primary/20 transition-colors border border-primary/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/20 rounded-lg">
                        <Wallet size={18} className="text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-foreground">Métodos de Cobro</p>
                        <p className="text-xs text-muted">Configurar CVU, Alias y MP</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-primary" />
                  </Link>
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 border border-border rounded-xl text-xs font-bold hover:bg-surface-secondary transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingName}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2"
                >
                  {savingName && <Loader2 size={12} className="animate-spin" />}
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
