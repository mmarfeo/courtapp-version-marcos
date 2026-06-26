'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function ForceResetPasswordPage() {
  const router = useRouter();
  
  // Fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/login');
          return;
        }
        
        // Ensure user actually needs to reset
        if (!session.user.user_metadata?.force_password_reset) {
          router.push('/');
          return;
        }

        setSessionActive(true);
      } catch (err) {
        console.error("Error checking session", err);
      } finally {
        setChecking(false);
      }
    };
    
    checkSession();
  }, [router]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Update password and remove the force_password_reset flag from metadata simultaneously
      const { data: userData, error: updateError } = await supabase.auth.updateUser({
        password: password,
        data: { force_password_reset: false }
      });
      
      if (updateError) throw updateError;
      
      // 2. Unset DB flag
      if (userData?.user?.id) {
        await supabase
          .from('perfiles_usuarios')
          .update({ requiere_cambio_password: false })
          .eq('id', userData.user.id);
      }
      
      setSuccess('Tu contraseña ha sido actualizada exitosamente. Redirigiéndote al inicio...');
      
      setTimeout(() => {
        // Redirigir al dashboard principal después de éxito
        router.push('/');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative overflow-hidden animate-fade-in">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-24 w-96 h-96 bg-accent/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Main card */}
      <main className="flex-grow flex items-center justify-center p-6 z-10">
        <div className="w-full max-w-md bg-surface-secondary/40 border border-border rounded-3xl p-8 backdrop-blur-md shadow-lg animate-slide-up relative">
          
          <button 
            onClick={handleLogout}
            className="absolute top-6 right-6 text-muted hover:text-red-400 text-xs font-semibold transition-colors"
          >
            Cerrar Sesión
          </button>

          {/* Title */}
          <div className="text-center mb-8 flex flex-col items-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
              <ShieldAlert size={32} />
            </div>
            <h1 className="text-2xl font-black tracking-tight mb-2 text-foreground">Actualización Requerida</h1>
            <p className="text-muted text-sm px-4">Por motivos de seguridad, debes establecer una contraseña definitiva antes de continuar.</p>
          </div>

          {/* Alert banners */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-start gap-3 animate-scale-in">
              <AlertCircle className="shrink-0 mt-0.5" size={18} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm flex items-start gap-3 animate-scale-in">
              <CheckCircle2 className="shrink-0 mt-0.5" size={18} />
              <span>{success}</span>
            </div>
          )}

          {sessionActive && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              {/* New Password input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider block" htmlFor="password">
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                    <Lock size={18} />
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-surface border border-border focus:border-primary focus:ring-1 focus:ring-primary text-foreground rounded-xl pl-11 pr-11 py-3 outline-none transition-all placeholder:text-muted/50 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider block" htmlFor="confirmPassword">
                  Confirmar Contraseña
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                    <Lock size={18} />
                  </span>
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite tu contraseña"
                    className="w-full bg-surface border border-border focus:border-primary focus:ring-1 focus:ring-primary text-foreground rounded-xl pl-11 pr-4 py-3 outline-none transition-all placeholder:text-muted/50 text-sm"
                  />
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading || !!success}
                className="w-full bg-primary hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 text-sm mt-6"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : 'Guardar y Continuar'}
              </button>
            </form>
          )}

        </div>
      </main>
    </div>
  );
}
