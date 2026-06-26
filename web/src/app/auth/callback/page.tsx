'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, Trophy } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Supabase will automatically handle the URL code/hash exchange 
        // to establish the session in the client. We just query the session.
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;
        
        // Wait a short moment to ensure the state is fully synchronized
        setTimeout(() => {
          router.push('/');
        }, 1000);
      } catch (err: any) {
        console.error('Error in auth callback:', err);
        setError(err.message || 'Error al procesar la sesión de inicio.');
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col items-center justify-center font-sans relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="text-center z-10 space-y-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Trophy className="text-indigo-500 animate-bounce" size={32} />
          <span className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            CourtUp
          </span>
        </div>

        {error ? (
          <div className="max-w-md p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400">
            <h2 className="text-lg font-bold mb-2">Error de Autenticación</h2>
            <p className="text-sm mb-4">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-all"
            >
              Volver al Login
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-center">
              <Loader2 className="animate-spin text-indigo-500" size={36} />
            </div>
            <p className="text-[var(--text-secondary)] text-sm">Estableciendo sesión segura...</p>
          </div>
        )}
      </div>
    </div>
  );
}
