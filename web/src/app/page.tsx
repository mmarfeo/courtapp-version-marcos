'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Trophy, Calendar, MapPin, GraduationCap, Play, Users, DollarSign, Activity, CheckCircle2, ArrowRight, Loader2, PlayCircle } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let active = true;

    const checkAuthAndRedirect = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: p } = await supabase
            .from('perfiles_usuarios')
            .select('rol')
            .eq('id', session.user.id)
            .single();

          if (active && p) {
            const role = p.rol;
            if (role === 'SuperAdmin' || role === 'Organizador') {
              router.push('/admin/dashboard');
            } else if (role === 'Profesor') {
              router.push('/profesor/agenda');
            } else if (role === 'Jugador') {
              router.push('/jugador/dashboard');
            } else {
              router.push('/torneos');
            }
            return; // Don't turn off loading, let it redirect
          }
        }
        if (active) setLoading(false);
      } catch (err) {
        console.error('Auth error:', err);
        if (active) setLoading(false);
      }
    };

    checkAuthAndRedirect();

    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={48} />
        <p className="mt-4 text-muted font-bold tracking-wider uppercase text-sm">Cargando CourtUp...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden selection:bg-primary/30 selection:text-primary">
      
      {/* BACKGROUND GLOWS */}
      <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-primary/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] bg-accent/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* NAVBAR */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto backdrop-blur-md bg-background/50 border-b border-border/50 sticky top-0 rounded-b-3xl mb-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Trophy size={16} className="text-white" />
          </div>
          <span className="text-xl font-black tracking-tight">Court<span className="text-primary">Up</span></span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-bold hover:text-primary transition-colors text-muted hover:text-foreground">
            Iniciar Sesión
          </Link>
          <Link href="/login" className="bg-primary hover:bg-primary-hover text-white text-sm font-bold px-5 py-2.5 rounded-full transition-transform active:scale-95 shadow-lg shadow-primary/25">
            Registrarse Gratis
          </Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-24 text-center lg:pt-20">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-secondary border border-border text-xs font-bold uppercase tracking-widest mb-8 text-stone-400 animate-fade-in shadow-sm">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          El ecosistema completo para clubes
        </div>
        
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-6 leading-tight animate-slide-up">
          Revoluciona tu forma de <br className="hidden md:block"/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
            vivir el deporte.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-stone-500 max-w-3xl mx-auto mb-10 leading-relaxed animate-slide-up" style={{ animationDelay: '100ms' }}>
          La primera plataforma inteligente que une a <strong>Jugadores</strong>, <strong>Profesores</strong> y <strong>Clubes</strong>. Encuentra torneos, reserva canchas, cobra tus clases y genera cuadros con Inteligencia Artificial.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
          <Link href="/login" className="w-full sm:w-auto bg-primary text-white hover:bg-primary-hover font-black text-lg px-8 py-4 rounded-full transition-all active:scale-95 shadow-xl shadow-primary/30 flex items-center justify-center gap-2 hover:-translate-y-1">
            Crear mi Cuenta Ahora <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* BACKGROUND MUSIC CONTROL */}
      <div className="fixed bottom-6 right-6 z-[60] animate-fade-in">
        <button 
          onClick={() => {
            if (audioRef.current) {
              if (isPlayingMusic) audioRef.current.pause();
              else audioRef.current.play();
              setIsPlayingMusic(!isPlayingMusic);
            }
          }}
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 border ${isPlayingMusic ? 'bg-primary border-primary text-white' : 'bg-surface border-border text-muted'}`}
          title="Música de fondo"
        >
          {isPlayingMusic ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>}
        </button>
        <audio ref={audioRef} src="https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=ambient-piano-ampamp-strings-10711.mp3" loop />
      </div>

      {/* IMAGE HERO SECTION */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-32 animate-slide-up" style={{ animationDelay: '300ms' }}>
        <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl group w-full bg-black">
          <img src="/courtup-hero.png" alt="CourtUp App Futuristic Interface" className="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity duration-500 hover:scale-[1.02] transform" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
          <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
            <div>
              <h3 className="text-white text-3xl font-black mb-2">CourtUp Pro</h3>
              <p className="text-white/70 font-medium">Lleva tu club al año 2030.</p>
            </div>
            <div className="hidden md:flex gap-3">
              <span className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-white text-xs font-bold border border-white/20">Inteligencia Artificial</span>
              <span className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-white text-xs font-bold border border-white/20">Gestión en la Nube</span>
            </div>
          </div>
        </div>
      </section>

      {/* VIDEO PLAYER SECTION */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-32 animate-slide-up" style={{ animationDelay: '300ms' }}>
        <div className="relative rounded-2xl overflow-hidden border border-border shadow-2xl flex flex-col bg-black aspect-video">
          {/* Top Bar simulating a browser/app window */}
          <div className="h-10 bg-slate-900/90 border-b border-white/10 flex items-center px-4 gap-2 w-full z-20 shrink-0">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <div className="mx-auto w-1/3 h-4 bg-white/5 rounded"></div>
          </div>
          
          {/* The Video */}
          <div className="flex-1 w-full relative">
            <video 
              src="/courtup.mp4" 
              controls 
              className="absolute inset-0 w-full h-full object-contain bg-black"
              poster="/courtup-hero.png"
            />
          </div>
        </div>
      </section>

      {/* STATS SECTION */}
      <section className="border-y border-border bg-surface-secondary/50 py-16">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 divide-x-0 md:divide-x divide-border">
          <div className="text-center px-4">
            <h3 className="text-4xl font-black text-primary mb-2">+500</h3>
            <p className="text-sm font-bold text-muted uppercase tracking-wider">Partidos Jugados</p>
          </div>
          <div className="text-center px-4">
            <h3 className="text-4xl font-black text-primary mb-2">+50</h3>
            <p className="text-sm font-bold text-muted uppercase tracking-wider">Torneos Creados</p>
          </div>
          <div className="text-center px-4">
            <h3 className="text-4xl font-black text-primary mb-2">100%</h3>
            <p className="text-sm font-bold text-muted uppercase tracking-wider">Pagos Seguros</p>
          </div>
          <div className="text-center px-4">
            <h3 className="text-4xl font-black text-primary mb-2">24/7</h3>
            <p className="text-sm font-bold text-muted uppercase tracking-wider">Reservas Online</p>
          </div>
        </div>
      </section>

      {/* VALUE PROP BY ROLE */}
      <section className="py-32 relative z-10 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl md:text-5xl font-black mb-6">Hecho a medida para todos los protagonistas de la cancha.</h2>
          <p className="text-xl text-stone-500">No importa si juegas, enseñas o administras. CourtUp centraliza toda la actividad del club en un solo ecosistema.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Jugadores */}
          <div className="bg-surface border border-border p-8 rounded-3xl hover:-translate-y-2 transition-transform duration-300 shadow-xl shadow-black/5">
            <div className="w-14 h-14 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/20">
              <Users size={28} />
            </div>
            <h3 className="text-2xl font-bold mb-4">Para Jugadores</h3>
            <p className="text-stone-500 mb-6 leading-relaxed">
              Inscríbete en torneos de tu nivel, mira los cuadros de partidos en vivo, reserva canchas en tu club favorito y abona tus clases desde el celular.
            </p>
            <ul className="space-y-3">
              {['Ranking y estadísticas.', 'Reservas en 3 clics.', 'Pagos online sin efectivo.'].map(item => (
                <li key={item} className="flex items-center gap-3 text-sm font-medium">
                  <CheckCircle2 size={18} className="text-indigo-500 shrink-0" /> {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Profesores */}
          <div className="bg-surface border border-border p-8 rounded-3xl hover:-translate-y-2 transition-transform duration-300 shadow-xl shadow-black/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <GraduationCap size={120} />
            </div>
            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20">
              <GraduationCap size={28} />
            </div>
            <h3 className="text-2xl font-bold mb-4">Para Profesores</h3>
            <p className="text-stone-500 mb-6 leading-relaxed">
              Despídete de los mensajes perdidos por WhatsApp. Publica tu agenda de clases, cobra por adelantado y gestiona la asistencia de tus alumnos.
            </p>
            <ul className="space-y-3">
              {['Agenda digital automática.', 'Cobros vía MercadoPago.', 'Historial de alumnos.'].map(item => (
                <li key={item} className="flex items-center gap-3 text-sm font-medium">
                  <CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Organizadores */}
          <div className="bg-surface border border-primary/30 p-8 rounded-3xl hover:-translate-y-2 transition-transform duration-300 shadow-2xl shadow-primary/10 relative">
            <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 border border-primary/20">
              <Activity size={28} />
            </div>
            <h3 className="text-2xl font-bold mb-4">Para Organizadores</h3>
            <p className="text-stone-500 mb-6 leading-relaxed">
              La herramienta definitiva para el Club. Genera cuadros de torneos con IA, automatiza el split de pagos y ten el control financiero total.
            </p>
            <ul className="space-y-3">
              {['Matchmaking con Inteligencia Artificial.', 'Split de pagos en tiempo real.', 'Gestión de inventario de canchas.'].map(item => (
                <li key={item} className="flex items-center gap-3 text-sm font-medium text-foreground">
                  <CheckCircle2 size={18} className="text-primary shrink-0" /> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CALL TO ACTION CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-full bg-primary/10 blur-[100px] rounded-full"></div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <Trophy size={48} className="text-primary mx-auto mb-8 animate-bounce-subtle" />
          <h2 className="text-5xl font-black mb-6">Sube el nivel de tu juego hoy.</h2>
          <p className="text-xl text-stone-500 mb-10">Únete a cientos de jugadores y clubes que ya usan CourtUp para gestionar su pasión por el tenis y el pádel.</p>
          <Link href="/login" className="inline-flex bg-primary text-white hover:bg-primary-hover font-black text-xl px-12 py-5 rounded-full transition-all active:scale-95 shadow-2xl shadow-primary/30 items-center justify-center gap-3 hover:-translate-y-1">
            Comenzar Gratis <ArrowRight size={24} />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border bg-background py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-stone-600" />
            <span className="text-xl font-black tracking-tight text-stone-400">CourtUp</span>
          </div>
          <p className="text-sm text-stone-600 font-medium">© {new Date().getFullYear()} CourtUp. Todos los derechos reservados.</p>
          <div className="flex gap-6 text-sm font-bold text-stone-500">
            <Link href="#" className="hover:text-primary transition-colors">Términos</Link>
            <Link href="#" className="hover:text-primary transition-colors">Privacidad</Link>
            <Link href="#" className="hover:text-primary transition-colors">Contacto</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
