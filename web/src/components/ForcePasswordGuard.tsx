'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ForcePasswordGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Only protect routes inside the dashboard
    if (pathname === '/login' || pathname === '/reset-password' || pathname === '/force-reset-password' || pathname === '/') {
      setChecking(false);
      return;
    }

    const checkPasswordResetFlag = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const { data: profile } = await supabase
            .from('perfiles_usuarios')
            .select('requiere_cambio_password')
            .eq('id', session.user.id)
            .single();

          if (profile?.requiere_cambio_password || session.user.user_metadata?.force_password_reset) {
            router.push('/force-reset-password');
            return;
          }
        }
        
        setChecking(false);
      } catch (error) {
        console.error('Error checking password reset flag:', error);
        setChecking(false);
      }
    };

    checkPasswordResetFlag();

    // Set up a listener for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.user_metadata?.force_password_reset && pathname !== '/force-reset-password') {
        router.push('/force-reset-password');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (checking) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}
