import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';

export type UserRole = 'jugador' | 'organizador' | 'profesor' | 'admin' | 'superadmin' | null;

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  roles: UserRole[];
  nombre?: string;
  apellido?: string;
  club_id?: string;
  categoria?: string;
  telefono?: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>;
  signOut: () => Promise<void>;
  switchRole: (newRole: UserRole) => Promise<void>;
  updateName: (newName: string) => Promise<{ error: any }>;
  updateCategory: (newCategory: string) => Promise<{ error: any }>;
  updatePhone: (newPhone: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACTIVE_ROLE_KEY = 'courtup_active_role';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch and sync user profile
  const fetchUserProfile = useCallback(async (authUser: User, forceRole?: UserRole) => {
    try {
      // Fetch from perfiles_usuarios table
      const { data, error } = await supabase
        .from('perfiles_usuarios')
        .select('id, email, rol, nombre, roles, categoria, telefono')
        .eq('id', authUser.id)
        .single();

      let baseRole: UserRole = 'jugador';
      let nombre = authUser.user_metadata?.nombre || '';
      let rolesList: UserRole[] = ['jugador'];
      let club_id = undefined;

      if (!error && data) {
        baseRole = (data.rol || 'jugador').toLowerCase() as UserRole;
        nombre = data.nombre || '';
        if (data.roles && Array.isArray(data.roles)) {
          rolesList = data.roles.map((r: string) => r.toLowerCase() as UserRole);
        } else {
          rolesList = [baseRole];
        }
      }

      // Check if email is nicortiz29@gmail.com or nicortiz29+admin@gmail.com to grant all roles
      const isSuperUser = authUser.email === 'nicortiz29@gmail.com' || authUser.email === 'nicortiz29+admin@gmail.com';
      if (isSuperUser) {
        rolesList = ['superadmin', 'organizador', 'profesor', 'jugador'];
      }

      // Restore active role from AsyncStorage if exists
      const savedRole = await AsyncStorage.getItem(ACTIVE_ROLE_KEY);
      let activeRole: UserRole = forceRole || (savedRole as UserRole) || baseRole;

      // Ensure the active role is valid for this user
      if (rolesList.length > 0 && !rolesList.includes(activeRole)) {
        activeRole = rolesList[0];
      }

      // Fetch club_id from miembros_organizacion
      const { data: memberData } = await supabase
        .from('miembros_organizacion')
        .select('organizacion_id')
        .eq('usuario_id', authUser.id)
        .limit(1);
      if (memberData && memberData.length > 0) {
        club_id = memberData[0].organizacion_id;
      }

      setUser({
        id: authUser.id,
        email: authUser.email || '',
        role: activeRole,
        roles: rolesList,
        nombre,
        apellido: '', // We use full name in nombre
        club_id,
        categoria: data?.categoria || null,
        telefono: data?.telefono || null,
      });
    } catch (e) {
      console.error('Error fetching user profile:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('==== USE-AUTH: Init Auth UseEffect ====');
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('==== USE-AUTH: Got Initial Session ====', session?.user?.id);
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setUser(null);
        setLoading(false);
        AsyncStorage.removeItem(ACTIVE_ROLE_KEY);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  };

  const signOut = async () => {
    // Eliminar el token de notificaciones de la base de datos si existe
    try {
      const pushToken = await AsyncStorage.getItem('courtup_push_token');
      if (pushToken) {
        await supabase
          .from('push_tokens')
          .delete()
          .eq('token', pushToken);
        await AsyncStorage.removeItem('courtup_push_token');
      }
    } catch (e) {
      console.error('Error al remover el token de notificaciones en logout:', e);
    }

    await AsyncStorage.removeItem(ACTIVE_ROLE_KEY);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Server signOut failed, clearing local state:', e);
    }
    // Always clear local state, even if server signOut fails
    setSession(null);
    setUser(null);
  };

  // Allow switching active role and sync with DB
  const switchRole = async (newRole: UserRole) => {
    if (!session?.user || !user) return;
    if (!user.roles.includes(newRole)) return;

    setLoading(true);
    
    // Map lowercase to DB capitalization
    let dbRole = 'Jugador';
    if (newRole === 'superadmin') dbRole = 'SuperAdmin';
    else if (newRole === 'admin') dbRole = 'Admin';
    else if (newRole === 'organizador') dbRole = 'Organizador';
    else if (newRole === 'profesor') dbRole = 'Profesor';

    try {
      await supabase
        .from('perfiles_usuarios')
        .update({ rol: dbRole })
        .eq('id', session.user.id);
    } catch (e) {
      console.error('Error updating role in DB:', e);
    }

    await AsyncStorage.setItem(ACTIVE_ROLE_KEY, newRole || '');
    await fetchUserProfile(session.user, newRole);
  };

  // Update full name in DB
  const updateName = async (newName: string) => {
    if (!session?.user || !user) return { error: new Error('Usuario no autenticado') };

    try {
      const { error } = await supabase
        .from('perfiles_usuarios')
        .update({ nombre: newName })
        .eq('id', session.user.id);

      if (error) throw error;

      // Update local state
      setUser(prev => prev ? { ...prev, nombre: newName } : null);
      return { error: null };
    } catch (e: any) {
      console.error('Error updating name:', e);
      return { error: e };
    }
  };

  // Update category/level in DB
  const updateCategory = async (newCategory: string) => {
    if (!session?.user || !user) return { error: new Error('Usuario no autenticado') };

    try {
      const { error } = await supabase
        .from('perfiles_usuarios')
        .update({ categoria: newCategory })
        .eq('id', session.user.id);

      if (error) throw error;

      // Update local state
      setUser(prev => prev ? { ...prev, categoria: newCategory } : null);
      return { error: null };
    } catch (e: any) {
      console.error('Error updating category:', e);
      return { error: e };
    }
  };

  // Update phone in DB
  const updatePhone = async (newPhone: string) => {
    if (!session?.user || !user) return { error: new Error('Usuario no autenticado') };

    try {
      const val = newPhone.trim() || null;
      const { error } = await supabase
        .from('perfiles_usuarios')
        .update({ telefono: val })
        .eq('id', session.user.id);

      if (error) throw error;

      // Update local state
      setUser(prev => prev ? { ...prev, telefono: val } : null);
      return { error: null };
    } catch (e: any) {
      console.error('Error updating phone:', e);
      return { error: e };
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signOut, switchRole, updateName, updateCategory, updatePhone }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
