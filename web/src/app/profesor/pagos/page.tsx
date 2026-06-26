'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, Save, Loader2, ArrowLeft, Building2, Wallet } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function MisPagosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [cvu, setCvu] = useState('');
  const [alias, setAlias] = useState('');
  const [cuitCuil, setCuitCuil] = useState('');
  const [banco, setBanco] = useState('');
  const [mpLinked, setMpLinked] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('perfiles_usuarios')
        .select('cvu, alias, cuit_cuil, banco, mp_access_token')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setCvu(data.cvu || '');
        setAlias(data.alias || '');
        setCuitCuil(data.cuit_cuil || '');
        setBanco(data.banco || '');
        setMpLinked(!!data.mp_access_token);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [router]);

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const { error } = await supabase
        .from('perfiles_usuarios')
        .update({
          cvu: cvu || null,
          alias: alias || null,
          cuit_cuil: cuitCuil || null,
          banco: banco || null
        })
        .eq('id', session.user.id);

      if (error) throw error;
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving payment info', err);
      alert('Hubo un error al guardar los datos.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 font-sans text-foreground animate-fade-in">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/profesor/agenda" className="p-3 bg-surface-secondary border border-border rounded-xl hover:border-primary/50 hover:bg-surface-secondary/80 transition-all shadow-sm">
            <ArrowLeft size={20} className="text-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
              <Wallet className="text-primary" size={28} /> Mis Métodos de Cobro
            </h1>
            <p className="text-muted text-sm mt-1">Configura dónde recibirás el dinero de tus clases.</p>
          </div>
        </div>

        {/* Formulario */}
        <div className="bg-surface-secondary/40 border border-border rounded-3xl p-6 md:p-8 shadow-md hover:shadow-lg transition-all duration-300 backdrop-blur-md animate-slide-up space-y-8">
          
          <form onSubmit={handleGuardar} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
                <Building2 size={18} className="text-primary" /> Transferencias (CVU / Alias)
              </h3>
              <p className="text-xs text-muted mb-4">Los alumnos verán estos datos para realizarte transferencias manuales.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Alias</label>
                  <input 
                    type="text" 
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="cancha.tenis.mp" 
                    className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted/50" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">CVU / CBU</label>
                  <input 
                    type="text" 
                    value={cvu}
                    onChange={(e) => setCvu(e.target.value)}
                    placeholder="0000003100000000000000" 
                    className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono text-sm placeholder:text-muted/50" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Banco / Billetera</label>
                  <input 
                    type="text" 
                    value={banco}
                    onChange={(e) => setBanco(e.target.value)}
                    placeholder="Mercado Pago / Ualá / Galicia" 
                    className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted/50" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">CUIT / CUIL</label>
                  <input 
                    type="text" 
                    value={cuitCuil}
                    onChange={(e) => setCuitCuil(e.target.value)}
                    placeholder="20-12345678-9" 
                    className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono text-sm placeholder:text-muted/50" 
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-border flex items-center justify-between">
              {success && <span className="text-sm font-bold text-green-500 animate-pulse">¡Datos guardados!</span>}
              <button 
                type="submit" 
                disabled={saving}
                className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md shadow-primary/20 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed ml-auto"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Save size={20} />
                )}
                {saving ? 'Guardando...' : 'Guardar Datos Bancarios'}
              </button>
            </div>
          </form>

          {/* Mercado Pago Section */}
          <div className="pt-8 border-t border-border space-y-4">
            <h3 className="text-lg font-bold text-foreground pb-2 flex items-center gap-2">
              <CreditCard size={18} className="text-[#009EE3]" /> Integración con Mercado Pago
            </h3>
            <p className="text-xs text-muted mb-4">
              Si conectas tu cuenta de Mercado Pago, los alumnos podrán pagarte directamente con tarjeta o saldo desde la app.
            </p>
            
            <div className="p-4 rounded-xl border border-border bg-surface flex items-center justify-between">
              <div>
                <p className="font-bold text-sm">Estado de conexión</p>
                <p className="text-xs text-muted mt-1">
                  {mpLinked ? 'Vinculado correctamente.' : 'Aún no has vinculado tu cuenta de Mercado Pago.'}
                </p>
              </div>
              <button 
                className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                  mpLinked 
                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' 
                    : 'bg-[#009EE3] text-white hover:bg-[#0080B7] shadow-md shadow-[#009EE3]/20'
                }`}
                onClick={() => alert('Próximamente: Flujo OAuth de Mercado Pago')}
              >
                {mpLinked ? 'Desvincular' : 'Conectar Mercado Pago'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
