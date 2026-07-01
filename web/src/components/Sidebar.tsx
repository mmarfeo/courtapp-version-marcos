'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import {
  Trophy, LogOut, ChevronDown, Loader2, User, Shield, GraduationCap,
  LayoutDashboard, MapPin, Calendar, BookOpen, Menu, X, LayoutGrid,
  ChevronLeft, ChevronRight, Sun, Moon, Plus, List, BarChart3, Home, Grid3X3, Wallet, Landmark, MessageCircle
} from 'lucide-react';
import ThreeBall from './ThreeBall';

type UserRole = 'Jugador' | 'Profesor' | 'Organizador' | 'SuperAdmin';

interface UserProfile {
  nombre: string;
  email: string;
  rol: UserRole;
  roles?: UserRole[];
  foto_url?: string;
}

interface NavGroup {
  label: string;
  icon: React.ReactNode;
  children: { label: string; href: string; icon: React.ReactNode }[];
}

type NavItem = { label: string; href: string; icon: React.ReactNode } | NavGroup;

function isGroup(item: NavItem): item is NavGroup {
  return 'children' in item;
}

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (profile?.nombre) {
      setEditName(profile.nombre);
    }
  }, [profile?.nombre]);

  const isAuthRoute = pathname === '/login' || pathname === '/auth/callback' || pathname === '/reset-password';

  // Theme toggle
  useEffect(() => {
    const saved = localStorage.getItem('courtup-theme');
    if (saved === 'dark') {
      setDarkMode(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('courtup-theme', next ? 'dark' : 'light');
  };

  const toggleGroup = (label: string) => {
    // eslint-disable-next-line security/detect-object-injection
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  // Auth listener
  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (active) {
        if (session?.user) setUser(session.user);
        else { setUser(null); setProfile(null); setLoading(false); }
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  // Fetch profile
  useEffect(() => {
    let active = true;
    if (!user) return;
    const getProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('perfiles_usuarios')
          .select('nombre, email, rol, roles, foto_url')
          .eq('id', user.id).single();
        if (error) {
          if ((error as any).status === 401) { await supabase.auth.signOut(); setUser(null); setProfile(null); return; }
          throw error;
        }
        if (active && data) setProfile(data as UserProfile);
      } catch (err) { console.error(err); }
      finally { if (active) setLoading(false); }
    };
    getProfile();
    return () => { active = false; };
  }, [user]);

  // Route protection
  useEffect(() => {
    if (loading || isAuthRoute) return;
    const isPublic = pathname === '/' || pathname === '/torneos' || pathname === '/clases';
    if (!user && !isPublic) router.push('/login');
  }, [pathname, user, loading, isAuthRoute, router]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (isAuthRoute || (!loading && !user)) return null;

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
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Server signOut failed:', e);
    }
    router.push('/login');
  };

  const handleRoleSwitch = async (newRole: UserRole) => {
    if (!user || !profile || profile.rol === newRole) { setRoleMenuOpen(false); return; }
    setSwitchingRole(true); setRoleMenuOpen(false);
    try {
      const { error } = await supabase.from('perfiles_usuarios').update({ rol: newRole }).eq('id', user.id);
      if (error) throw error;
      await supabase.auth.refreshSession();
      setProfile(prev => prev ? { ...prev, rol: newRole } : null);
      setTimeout(() => {
        setSwitchingRole(false);
        if (newRole === 'SuperAdmin') router.push('/admin/dashboard');
        else if (newRole === 'Organizador') router.push('/organizador/torneos/nuevo');
        else if (newRole === 'Profesor') router.push('/profesor/agenda');
        else router.push('/jugador/chat');
      }, 600);
    } catch (err) { console.error(err); setSwitchingRole(false); }
  };

  const getRoleIcon = (r: UserRole) => {
    switch (r) {
      case 'SuperAdmin': return <Shield size={16} />;
      case 'Organizador': return <Trophy size={16} />;
      case 'Profesor': return <GraduationCap size={16} />;
      case 'Jugador': return <User size={16} />;
    }
  };

  const getUserInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // Grouped navigation by role
  const getNavItems = (): NavItem[] => {
    const items: NavItem[] = [];

    if (!profile) {
      items.push({ label: 'Inicio', href: '/', icon: <Home size={20} /> });
      items.push({ label: 'Torneos', href: '/torneos', icon: <Trophy size={20} /> });
      items.push({ label: 'Clases', href: '/clases', icon: <BookOpen size={20} /> });
      return items;
    }

    if (profile.rol === 'SuperAdmin') {
      items.push({ label: 'Inicio', href: '/admin/dashboard', icon: <Home size={20} /> });
      items.push({
        label: 'Torneos',
        icon: <Trophy size={20} />,
        children: [
          { label: 'Dashboard', href: '/admin/torneos-dashboard', icon: <BarChart3 size={16} /> },
          { label: 'Crear Torneo', href: '/organizador/torneos/nuevo', icon: <Plus size={16} /> },
          { label: 'Torneos Activos', href: '/torneos', icon: <List size={16} /> },
        ],
      });
      items.push({ label: 'Canchas', href: '/organizador/canchas', icon: <LayoutGrid size={20} /> });
      items.push({ label: 'Deudas Staff', href: '/admin/deudas', icon: <Landmark size={20} /> });
    } else if (profile.rol === 'Organizador') {
      items.push({ label: 'Inicio', href: '/admin/dashboard', icon: <Home size={20} /> });
      items.push({
        label: 'Torneos',
        icon: <Trophy size={20} />,
        children: [
          { label: 'Dashboard', href: '/admin/torneos-dashboard', icon: <BarChart3 size={16} /> },
          { label: 'Crear Torneo', href: '/organizador/torneos/nuevo', icon: <Plus size={16} /> },
          { label: 'Torneos Activos', href: '/torneos', icon: <List size={16} /> },
        ],
      });
      items.push({ label: 'Canchas', href: '/organizador/canchas', icon: <LayoutGrid size={20} /> });
      items.push({ label: 'Deudas Staff', href: '/admin/deudas', icon: <Landmark size={20} /> });
    } else if (profile.rol === 'Profesor') {
      items.push({ label: 'Inicio', href: '/profesor/dashboard', icon: <Home size={20} /> });
      items.push({ label: 'Mi Agenda', href: '/profesor/agenda', icon: <Calendar size={20} /> });
      items.push({ label: 'Reservar Cancha', href: '/profesor/reservar', icon: <Calendar size={20} /> });
      items.push({ label: 'Publicar Clase', href: '/profesor/clases/nueva', icon: <GraduationCap size={20} /> });
      items.push({ label: 'Mis Pagos', href: '/profesor/pagos', icon: <Wallet size={20} /> });
    } else if (profile.rol === 'Jugador') {
      items.push({ label: 'Chat', href: '/jugador/chat', icon: <MessageCircle size={20} /> });
      items.push({ label: 'Inicio', href: '/jugador/dashboard', icon: <Home size={20} /> });
      items.push({ label: 'Torneos', href: '/torneos', icon: <Trophy size={20} /> });
      items.push({ label: 'Alquiler', href: '/alquiler', icon: <Grid3X3 size={20} /> });
    } else {
      items.push({ label: 'Inicio', href: '/', icon: <Home size={20} /> });
      items.push({ label: 'Torneos', href: '/torneos', icon: <Trophy size={20} /> });
    }

    items.push({ label: 'Clases', href: '/clases', icon: <BookOpen size={20} /> });
    return items;
  };

  const navItems = getNavItems();
  const isActive = (href: string) => pathname === href || pathname.substring(0, href.length + 1) === href + '/';
  const isGroupActive = (group: NavGroup) => group.children.some(c => isActive(c.href));

  // Roles for switching
  const isSuperAdmin = profile?.email === 'nicortiz29@gmail.com' || profile?.email === 'nicortiz29+admin@gmail.com';
  const rolesToShow = isSuperAdmin
    ? (['Jugador', 'Profesor', 'Organizador', 'SuperAdmin'] as UserRole[])
    : (profile?.roles && profile.roles.length > 1
      ? (profile.roles.filter(r => r !== 'SuperAdmin') as UserRole[])
      : []);

  const renderNavItem = (item: NavItem, idx: number) => {
    if (isGroup(item)) {
      const open = openGroups[item.label] ?? false;
      const active = isGroupActive(item);
      return (
        <div key={item.label} className="w-full">
          <button
            onClick={() => toggleGroup(item.label)}
            className={`flex items-center justify-between w-full px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
              active 
                ? 'text-primary bg-primary/10' 
                : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-surface-secondary'
            }`}
            title={collapsed ? item.label : undefined}
          >
            <span className="flex items-center gap-3">
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </span>
            {!collapsed && (
              <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            )}
          </button>
          {!collapsed && open && (
            <div className="ml-4 pl-4 border-l border-border mt-1 mb-2 space-y-0.5 animate-fade-in">
              {item.children.map(child => (
                <Link
                  key={child.href}
                  href={child.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                    pathname === child.href
                      ? 'bg-primary/15 text-primary'
                      : 'text-stone-400 hover:text-stone-900 dark:text-stone-500 dark:hover:text-stone-300 hover:bg-surface-secondary'
                  }`}
                >
                  <span className="shrink-0">{child.icon}</span>
                  <span>{child.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
          pathname === item.href 
            ? 'bg-primary/10 text-primary' 
            : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-surface-secondary'
        }`}
        title={collapsed ? item.label : undefined}
      >
        <span className="shrink-0">{item.icon}</span>
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-surface text-foreground transition-colors duration-300">
      {/* Logo y 3D Ball Toggle */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-border">
        <div className="flex items-center gap-2.5 group">
          <ThreeBall onClick={() => setCollapsed(!collapsed)} />
          {!collapsed && (
            <span className="text-lg font-black tracking-tight select-none">
              Court<span className="text-primary animate-bounce-subtle inline-block">Up</span>
            </span>
          )}
        </div>
        <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg hover:bg-surface-secondary transition-colors">
          {collapsed ? <ChevronRight size={16} className="text-muted" /> : <ChevronLeft size={16} className="text-muted" />}
        </button>
        <button onClick={() => setMobileOpen(false)} className="lg:hidden text-muted hover:text-foreground">
          <X size={20} />
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item, i) => renderNavItem(item, i))}
      </nav>

      {/* Controles de perfil, logout y tema */}
      <div className="border-t border-border px-3 py-3 space-y-2">
        <button onClick={toggleTheme} className="flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold rounded-xl text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-surface-secondary transition-all">
          {darkMode ? <Sun size={20} className="text-primary" /> : <Moon size={20} className="text-primary" />}
          {!collapsed && <span>{darkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>}
        </button>

        {rolesToShow.length > 1 && !collapsed && (
          <div className="relative">
            <button onClick={() => setRoleMenuOpen(!roleMenuOpen)} className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold rounded-xl text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-surface-secondary transition-all">
              <span className="flex items-center gap-2">
                {profile && getRoleIcon(profile.rol)}
                <span className="text-xs font-semibold">{profile?.rol}</span>
              </span>
              <ChevronDown size={14} className={`transition-transform ${roleMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {roleMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface border border-border rounded-xl p-1.5 shadow-xl z-50 animate-scale-in">
                {rolesToShow.map(r => (
                  <button key={r} onClick={() => handleRoleSwitch(r)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      profile?.rol === r ? 'bg-primary/10 text-primary' : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-surface-secondary'
                    }`}>
                    {getRoleIcon(r)} {r}
                    {profile?.rol === r && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-2"><Loader2 className="animate-spin text-primary" size={20} /></div>
        ) : user && profile ? (
          <div className="space-y-1">
            <div className={`flex items-center gap-3 px-3 py-2 ${collapsed ? 'justify-center' : ''}`}>
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0 ring-2 ring-primary/20">
                {profile.foto_url ? (
                  <img src={profile.foto_url} alt={profile.nombre} className="w-full h-full rounded-full object-cover" />
                ) : getUserInitials(profile.nombre)}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{profile.nombre}</p>
                  <p className="text-[10px] text-muted truncate">{profile.email}</p>
                  <button 
                    onClick={() => setEditModalOpen(true)}
                    className="text-[9px] text-primary hover:underline font-bold block mt-0.5"
                  >
                    Editar Perfil
                  </button>
                </div>
              )}
            </div>
            <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold rounded-xl text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-all">
              <LogOut size={18} />
              {!collapsed && <span className="text-xs font-semibold font-sans">Cerrar Sesión</span>}
            </button>
          </div>
        ) : (
          <Link href="/login" className="flex items-center justify-center w-full px-4 py-3 text-sm font-bold rounded-xl bg-surface-secondary border border-border text-foreground hover:bg-primary/10 hover:text-primary transition-all">
            {collapsed ? <User size={18} /> : 'Iniciar Sesión'}
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <>
      {switchingRole && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-primary" size={40} />
          <p className="text-white font-semibold text-sm">Cambiando perfil...</p>
        </div>
      )}

      {/* Mobile hamburger */}
      <button onClick={() => setMobileOpen(true)} className="lg:hidden fixed top-4 left-4 z-[60] w-10 h-10 rounded-xl bg-surface shadow-lg border border-border flex items-center justify-center text-foreground hover:bg-surface-secondary transition-colors" aria-label="Menú">
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && <div className="lg:hidden fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />}

      {/* Mobile sidebar */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-[80] w-72 bg-surface transform transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-[40] bg-surface border-r border-border transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-64'}`}>
        {sidebarContent}
      </aside>

      {/* CSS adjustments helper */}
      <style jsx global>{`
        body {
          margin-left: 0px;
        }
        @media (min-width: 1024px) {
          main, .main-content-layout {
            margin-left: ${collapsed ? '72px' : '256px'};
            transition: margin-left 0.3s ease;
          }
        }
      `}</style>

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
