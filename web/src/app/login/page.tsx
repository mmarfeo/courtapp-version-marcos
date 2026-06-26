'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Trophy, Mail, Lock, User, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

type AuthMode = 'login' | 'signup' | 'forgot_password';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  
  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check if user is already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/');
      }
    };
    checkUser();
  }, [router]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'login') {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
        router.push('/');
      } else if (mode === 'signup') {
        if (!nombre.trim()) throw new Error('Por favor ingresa tu nombre completo');
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nombre: nombre,
              full_name: nombre, // Necesario para el trigger de base de datos
              telefono: telefono.trim() || null,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (authError) throw authError;
        
        setSuccess('¡Registro exitoso! Por favor verifica tu correo electrónico para confirmar tu cuenta.');
        // Reset form
        setNombre('');
        setPassword('');
      } else if (mode === 'forgot_password') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (authError) throw authError;
        setSuccess('Se ha enviado un correo electrónico para restablecer tu contraseña.');
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (authError) throw authError;
    } catch (err: any) {
      setError(err.message || 'Error al conectar con Google');
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
          <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
            Volver al inicio
          </Link>
        </div>
      </header>

      {/* Main card */}
      <main className="flex-grow flex items-center justify-center p-6 z-10">
        <div className="w-full max-w-md bg-surface-secondary/40 border border-border rounded-3xl p-8 backdrop-blur-md shadow-lg relative animate-slide-up">
          
          {/* Transition back button for sub-modes */}
          {mode !== 'login' && (
            <button 
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccess(null);
              }}
              className="absolute top-6 left-6 text-muted hover:text-foreground flex items-center gap-1 text-sm transition-colors"
            >
              <ChevronLeft size={16} />
              Atrás
            </button>
          )}

          {/* Title and descriptions */}
          <div className="text-center mb-8 pt-4">
            <h1 className="text-3xl font-black tracking-tight mb-2 text-foreground">
              {mode === 'login' && 'Bienvenido'}
              {mode === 'signup' && 'Crea tu Cuenta'}
              {mode === 'forgot_password' && 'Recuperar'}
            </h1>
            <p className="text-muted text-sm">
              {mode === 'login' && 'Gestiona tus turnos y torneos en un solo lugar.'}
              {mode === 'signup' && 'Regístrate para competir y agendar clases.'}
              {mode === 'forgot_password' && 'Ingresa tu email para restablecer la contraseña.'}
            </p>
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

          <form onSubmit={handleEmailAuth} className="space-y-5">
            {/* Full Name input for Signup */}
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider block" htmlFor="nombre">
                  Nombre Completo
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                    <User size={18} />
                  </span>
                  <input
                    id="nombre"
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Juan Pérez"
                    className="w-full bg-surface border border-border focus:border-primary focus:ring-1 focus:ring-primary text-foreground rounded-xl pl-11 pr-4 py-3 outline-none transition-all placeholder:text-muted/50 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Teléfono input for Signup */}
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider block" htmlFor="telefono">
                  Teléfono (Opcional)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                    <User size={18} />
                  </span>
                  <input
                    id="telefono"
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Ej: 1122334455"
                    className="w-full bg-surface border border-border focus:border-primary focus:ring-1 focus:ring-primary text-foreground rounded-xl pl-11 pr-4 py-3 outline-none transition-all placeholder:text-muted/50 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Email input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider block" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                  <Mail size={18} />
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full bg-surface border border-border focus:border-primary focus:ring-1 focus:ring-primary text-foreground rounded-xl pl-11 pr-4 py-3 outline-none transition-all placeholder:text-muted/50 text-sm"
                />
              </div>
            </div>

            {/* Password input for Login & Signup */}
            {mode !== 'forgot_password' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider block" htmlFor="password">
                  Contraseña
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
                    placeholder="••••••••"
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
                
                {/* Reset Password link in Login Mode */}
                {mode === 'login' && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot_password');
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-xs text-primary hover:text-primary-hover font-medium transition-colors"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 text-sm mt-6"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  {mode === 'login' && 'Iniciar Sesión'}
                  {mode === 'signup' && 'Crear Cuenta'}
                  {mode === 'forgot_password' && 'Enviar Correo de Recuperación'}
                </>
              )}
            </button>

            {/* Divider for SSO */}
            {mode !== 'forgot_password' && (
              <>
                <div className="flex items-center gap-4 my-6">
                  <div className="flex-grow h-px bg-border"></div>
                  <span className="text-[10px] font-bold text-muted uppercase tracking-widest shrink-0">
                    O continúa con
                  </span>
                  <div className="flex-grow h-px bg-border"></div>
                </div>

                {/* Google SSO Button */}
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-surface hover:bg-surface-secondary border border-border text-foreground font-semibold py-3 px-4 rounded-xl transition-all text-sm disabled:opacity-50 hover:border-primary/30"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>Iniciar con Google</span>
                </button>
              </>
            )}
          </form>

          {/* Mode Switcher Footer */}
          <div className="mt-8 text-center border-t border-border pt-6">
            <p className="text-muted text-sm">
              {mode === 'login' ? (
                <>
                  ¿No tienes cuenta?{' '}
                  <button
                    onClick={() => {
                      setMode('signup');
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-primary hover:text-primary-hover font-bold hover:underline transition-all"
                  >
                    Regístrate
                  </button>
                </>
              ) : (
                mode === 'signup' && (
                  <>
                    ¿Ya tienes cuenta?{' '}
                    <button
                      onClick={() => {
                        setMode('login');
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-primary hover:text-primary-hover font-bold hover:underline transition-all"
                    >
                      Inicia Sesión
                    </button>
                  </>
                )
              )}
            </p>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 border-t border-border bg-background z-10 text-xs text-muted">
        <div className="flex flex-col sm:flex-row justify-between items-center px-6 w-full max-w-6xl mx-auto gap-4">
          <span className="font-semibold text-foreground">CourtUp © 2026</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary transition-colors">Privacidad</a>
            <a href="#" className="hover:text-primary transition-colors">Términos</a>
            <a href="mailto:courtupro@gmail.com" className="hover:text-primary transition-colors">Soporte</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
