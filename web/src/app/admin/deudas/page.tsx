'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Landmark, Wallet, CheckCircle2, AlertCircle } from 'lucide-react';

interface DebtGroup {
  profesor_id: string;
  profesor_nombre: string;
  profesor_email: string;
  monto_total: number;
  reservas_ids: number[];
}

export default function AdminDeudasPage() {
  const [loading, setLoading] = useState(true);
  const [debts, setDebts] = useState<DebtGroup[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchDebts = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Obtener clubes del admin
      const { data: userOrgs } = await supabase
        .from('miembros_organizacion')
        .select('organizacion_id')
        .eq('usuario_id', user.id);

      const orgIds = userOrgs?.map(o => o.organizacion_id) || [];
      if (orgIds.length === 0) {
        // SuperAdmin o no tiene orgs, buscamos todas las canchas? 
        // Para simplificar, buscamos si tiene un rol superadmin
      }

      let canchasQuery = supabase.from('canchas').select('id');
      if (orgIds.length > 0) {
        canchasQuery = canchasQuery.in('organizacion_id', orgIds);
      }
      
      const { data: canchasData } = await canchasQuery;
      const canchasIds = canchasData?.map(c => c.id) || [];

      if (canchasIds.length === 0) {
        setDebts([]);
        return;
      }

      // 2. Obtener alquileres pendientes
      const { data, error } = await supabase
        .from('alquileres_cancha')
        .select(`
          id,
          monto_total,
          usuario_id,
          profesor:perfiles_usuarios!usuario_id(nombre, email)
        `)
        .eq('estado_pago', 'Pendiente')
        .in('cancha_id', canchasIds);

      if (error) throw error;

      // 3. Agrupar por profesor
      const grouped = new Map<string, DebtGroup>();
      (data || []).forEach((item: any) => {
        if (!item.usuario_id) return;
        const pId = item.usuario_id;
        const monto = item.monto_total || 0;
        
        if (!grouped.has(pId)) {
          grouped.set(pId, {
            profesor_id: pId,
            profesor_nombre: item.profesor?.nombre || 'Desconocido',
            profesor_email: item.profesor?.email || '',
            monto_total: 0,
            reservas_ids: []
          });
        }
        
        const g = grouped.get(pId)!;
        g.monto_total += monto;
        g.reservas_ids.push(item.id);
      });

      setDebts(Array.from(grouped.values()));
    } catch (err) {
      console.error('Error fetching debts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebts();
  }, []);

  const handleSaldar = async (profesorId: string, reservasIds: number[]) => {
    if (!confirm('¿Estás seguro de que quieres marcar todas estas reservas como pagadas?')) return;
    
    setProcessing(profesorId);
    try {
      const { error } = await supabase
        .from('alquileres_cancha')
        .update({ estado_pago: 'Aprobado' })
        .in('id', reservasIds);
        
      if (error) throw error;
      
      // Update local state
      setDebts(prev => prev.filter(d => d.profesor_id !== profesorId));
    } catch (err) {
      console.error(err);
      alert('Error al saldar la deuda');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-stone-400">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p>Cargando deudas...</p>
      </div>
    );
  }

  const totalDebt = debts.reduce((acc, d) => acc + d.monto_total, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-stone-100 flex items-center gap-3">
            <Landmark className="text-primary" size={32} />
            Deudas de Profesores
          </h1>
          <p className="text-stone-400 mt-2 max-w-2xl">
            Aquí puedes ver el saldo pendiente de los profesores por el uso fijo de canchas. Marca como saldado una vez que recibas el pago semanal.
          </p>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex items-center gap-4 min-w-[200px]">
          <div className="bg-orange-500/10 p-3 rounded-xl">
            <Wallet className="text-orange-500" size={24} />
          </div>
          <div>
            <p className="text-sm text-stone-400 font-medium">Total Pendiente</p>
            <p className="text-2xl font-black text-orange-500">${totalDebt}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {debts.map(debt => (
          <div key={debt.profesor_id} className="bg-stone-900 border border-stone-800 rounded-2xl p-6 flex flex-col justify-between group hover:border-stone-700 transition-colors">
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-white">{debt.profesor_nombre}</h3>
                  <p className="text-sm text-stone-400">{debt.profesor_email}</p>
                </div>
                <div className="bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
                  <span className="text-xs font-bold text-orange-500">Pendiente</span>
                </div>
              </div>

              <div className="py-4 border-y border-stone-800 flex justify-between items-center">
                <span className="text-stone-400 font-medium">Adeudado</span>
                <span className="text-2xl font-black text-white">${debt.monto_total}</span>
              </div>
            </div>

            <button
              onClick={() => handleSaldar(debt.profesor_id, debt.reservas_ids)}
              disabled={processing === debt.profesor_id}
              className="mt-6 w-full bg-stone-800 hover:bg-primary text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-primary/20"
            >
              {processing === debt.profesor_id ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <CheckCircle2 size={18} />
              )}
              {processing === debt.profesor_id ? 'Saldando...' : 'Marcar como Saldado'}
            </button>
          </div>
        ))}
        
        {debts.length === 0 && (
          <div className="col-span-full bg-stone-900 border border-stone-800 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center">
            <div className="bg-stone-800/50 p-4 rounded-full mb-4">
              <CheckCircle2 size={32} className="text-stone-500" />
            </div>
            <h3 className="text-lg font-bold text-white">Todo al día</h3>
            <p className="text-stone-400 mt-2">No hay deudas pendientes registradas para los profesores.</p>
          </div>
        )}
      </div>
    </div>
  );
}
