'use client';

import React, { useState, useEffect } from 'react';
import { Building2, Save, ArrowLeft, Building, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { fetchOrganizacionById, updateOrganizacion } from '@/lib/queries/adminQueries';
import { useParams, useRouter } from 'next/navigation';

export default function EditarClubPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [mpUserId, setMpUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const cargarClub = async () => {
      try {
        if (!id) return;
        const org = await fetchOrganizacionById(id);
        if (org) {
          setNombre(org.nombre);
          setSlug(org.slug);
          setMpAccessToken(org.mp_access_token || '');
          setMpUserId(org.mp_user_id || '');
        }
      } catch (err) {
        console.error("Error al cargar club", err);
      } finally {
        setInitialLoading(false);
      }
    };
    cargarClub();
  }, [id]);

  const handleNombreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNombre(val);
    if (!slug || slug === val.slice(0, -1).toLowerCase().replace(/\s+/g, '-')) {
      setSlug(val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
    }
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateOrganizacion(id, {
        nombre,
        slug,
        mp_access_token: mpAccessToken || undefined,
        mp_user_id: mpUserId || undefined,
      });

      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        router.push('/admin/dashboard');
      }, 2000);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <Loader2 className="animate-spin text-primary" size={48} />
          <p className="text-muted font-medium">Cargando club...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 font-sans text-foreground animate-fade-in">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/dashboard" className="p-3 bg-surface-secondary border border-border rounded-xl hover:border-primary/50 hover:bg-surface-secondary/80 transition-all shadow-sm">
            <ArrowLeft size={20} className="text-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
              <Building2 className="text-primary animate-bounce-subtle" size={28} /> Editar Club
            </h1>
            <p className="text-muted text-sm mt-1">Actualiza la configuración de la organización.</p>
          </div>
        </div>

        {/* Formulario */}
        <div className="bg-surface-secondary/40 border border-border rounded-3xl p-6 md:p-8 shadow-md hover:shadow-lg transition-all duration-300 backdrop-blur-md animate-slide-up">
          {success ? (
            <div className="text-center py-12 animate-scale-in">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20">
                <Building size={32} />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">¡Club actualizado exitosamente!</h2>
              <p className="text-muted mb-8">Redirigiendo al dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleGuardar} className="space-y-6">
              
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
                  <Building size={18} className="text-primary" /> Información Principal
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Nombre Comercial</label>
                    <input 
                      required
                      type="text" 
                      value={nombre}
                      onChange={handleNombreChange}
                      placeholder="Ej: Buenos Aires Lawn Tennis" 
                      className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted/50" 
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Slug (URL identificador)</label>
                    <input 
                      required
                      type="text" 
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="ej: baltc" 
                      className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono text-sm placeholder:text-muted/50" 
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <h3 className="text-lg font-bold text-foreground border-b border-border pb-2">Configuración Financiera (Mercado Pago)</h3>
                <p className="text-xs text-muted">Credenciales OAuth de Mercado Pago Marketplace necesarias para el cobro directo y split automático.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">MP Access Token (Opcional)</label>
                    <input 
                      type="password" 
                      value={mpAccessToken}
                      onChange={(e) => setMpAccessToken(e.target.value)}
                      placeholder="APP_USR-..." 
                      className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono text-sm placeholder:text-muted/50" 
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">MP User ID (Opcional)</label>
                    <input 
                      type="text" 
                      value={mpUserId}
                      onChange={(e) => setMpUserId(e.target.value)}
                      placeholder="123456789" 
                      className="w-full bg-surface border border-border text-foreground rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono text-sm placeholder:text-muted/50" 
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-border flex justify-end">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md shadow-primary/20 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <Save size={20} />
                  )}
                  {loading ? 'Guardando...' : 'Actualizar Club'}
                </button>
              </div>

            </form>
          )}
        </div>

      </div>
    </div>
  );
}
