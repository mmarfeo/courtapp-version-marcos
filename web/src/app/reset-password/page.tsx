'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Trophy } from 'lucide-react';
import Link from 'next/link';

export default function ResetPasswordPage() {
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

  // Check if we have a session (which is established by Supabase via the reset link params)
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // We could also listen to the URL to verify if there's an auth flow happening
        // If not, redirect to login
        setError('Enlace inválido o expirado. Por favor solicita recuperar tu contraseña nuevamente.');
      } else {
        setSessionActive(true);
      }
    };
    checkSession();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    // eslint-disable-next-line security/detect-possible-timing-attacks
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
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });
      if (updateError) throw updateError;
      
      setSuccess('Tu contraseña ha sido restablecida exitosamente. Redirigiéndote al login...');
      // Sign out to clear any temporary auth session
      await supabase.auth.signOut();
      
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative overflow-hidden animate-fade-in">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-24 w-96 h-96 bg-accent/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header */}
      <header className="w-full border-b border-border bg-background/60 backdrop-blur-xl z-50">
        <div className="flex items-center justify-between px-6 h-16 w-full max-w-6xl mx-auto">
          <Link href="/" className="flex items-center gap-2 group">
            <Trophy className="text-primary transition-transform group-hover:scale-110" size={24} />
            <span className="text-xl font-black tracking-tight text-foreground">
              CourtUp
            </span>
          </Link>
        </div>
      </header>

      {/* Main card */}
      <main className="flex-grow flex items-center justify-center p-6 z-10">
        <div className="w-full max-w-md bg-surface-secondary/40 border border-border rounded-3xl p-8 backdrop-blur-md shadow-lg animate-slide-up">
          
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black tracking-tight mb-2 text-foreground">Restablecer</h1>
            <p className="text-muted text-sm">Ingresa tu nueva contraseña para ingresar a tu cuenta.</p>
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
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 text-sm mt-6"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : 'Guardar Nueva Contraseña'}
              </button>
            </form>
          )}

          {!sessionActive && !loading && (
            <div className="text-center mt-6">
              <Link
                href="/login"
                className="inline-block px-6 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-primary/20"
              >
                Ir al Login
              </Link>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 border-t border-border bg-background z-10 text-xs text-muted">
        <div className="flex flex-col sm:flex-row justify-between items-center px-6 w-full max-w-6xl mx-auto gap-4">
          <span className="font-semibold text-foreground">CourtUp © 2026</span>
        </div>
      </footer>
    </div>
  );
}
