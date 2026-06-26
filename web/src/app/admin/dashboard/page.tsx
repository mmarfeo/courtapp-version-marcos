'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, Wallet, Trophy, Users, Power, Search, Building2,
  TrendingUp, Edit2, Plus, ArrowLeft, UserPlus, Target, Calendar,
  BarChart3, BadgeDollarSign, Landmark, Layers, ChevronRight, CheckCircle2,
  DollarSign, Eye, X, Trash2, ShieldCheck, UserCog, AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toggleEstadoOrganizacion } from '@/lib/queries/adminQueries';

export default function SuperAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'clubs' | 'tournaments' | 'monthly' | 'breakdown'>('clubs');
  const [searchQuery, setSearchQuery] = useState('');
  
  // User Profile state
  const [profile, setProfile] = useState<any>(null);
  const [userOrgIds, setUserOrgIds] = useState<number[]>([]);
  const [selectedClubFilter, setSelectedClubFilter] = useState<string>('all');

  // Raw Data States
  const [allClubs, setAllClubs] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allTournaments, setAllTournaments] = useState<any[]>([]);
  const [allInscriptions, setAllInscriptions] = useState<any[]>([]);
  const [allClassReservations, setAllClassReservations] = useState<any[]>([]);
  const [allCourtRentals, setAllCourtRentals] = useState<any[]>([]);

  // Staff Modal state
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffModalClub, setStaffModalClub] = useState<any>(null);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>('');
  const [editNombre, setEditNombre] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Get logged in user and profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: prof } = await supabase
        .from('perfiles_usuarios')
        .select('*')
        .eq('id', user.id)
        .single();
      
      setProfile(prof);

      // 2. Fetch memberships if user is not SuperAdmin (e.g. Organizador, Profesor)
      let orgsList: number[] = [];
      if (prof && prof.rol !== 'SuperAdmin') {
        const { data: miembros } = await supabase
          .from('miembros_organizacion')
          .select('organizacion_id')
          .eq('usuario_id', user.id);
        orgsList = miembros?.map(m => m.organizacion_id) || [];
        setUserOrgIds(orgsList);
      }

      // 3. Fetch general data
      const [orgsRes, usersRes, torneosRes, inscripcionesRes, reservasRes, alquileresRes] = await Promise.all([
        supabase.from('organizaciones').select('*').order('creado_at', { ascending: false }),
        supabase.from('perfiles_usuarios').select('*'),
        supabase.from('torneos').select('*, organizaciones(nombre)'),
        supabase.from('inscripciones_torneo').select('*, torneos(*, organizaciones(*))').eq('estado_pago', 'Aprobado'),
        supabase.from('reservas_clases').select('*, clases_disponibles(*, organizaciones(*))').eq('estado_pago', 'Aprobado'),
        supabase.from('alquileres_cancha').select('*, canchas(*, organizaciones(*))').eq('estado_pago', 'Aprobado')
      ]);

      if (orgsRes.error) throw orgsRes.error;
      if (usersRes.error) throw usersRes.error;
      if (torneosRes.error) throw torneosRes.error;
      if (inscripcionesRes.error) throw inscripcionesRes.error;
      if (reservasRes.error) throw reservasRes.error;
      if (alquileresRes.error) throw alquileresRes.error;

      setAllClubs(orgsRes.data || []);
      setAllUsers(usersRes.data || []);
      setAllTournaments(torneosRes.data || []);
      setAllInscriptions(inscripcionesRes.data || []);
      setAllClassReservations(reservasRes.data || []);
      setAllCourtRentals(alquileresRes.data || []);
    } catch (err) {
      console.error("Error al cargar datos del dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const isSuperAdmin = profile?.rol === 'SuperAdmin';

  // 4. Role Filtered Data
  const clubs = useMemo(() => {
    let filtered = allClubs;
    if (!isSuperAdmin) {
      filtered = filtered.filter(c => userOrgIds.includes(c.id));
    }
    if (selectedClubFilter !== 'all') {
      filtered = filtered.filter(c => c.id.toString() === selectedClubFilter);
    }
    return filtered;
  }, [allClubs, isSuperAdmin, userOrgIds, selectedClubFilter]);

  const tournaments = useMemo(() => {
    let filtered = allTournaments;
    if (!isSuperAdmin) {
      filtered = filtered.filter(t => userOrgIds.includes(t.organizacion_id));
    }
    if (selectedClubFilter !== 'all') {
      filtered = filtered.filter(t => t.organizacion_id.toString() === selectedClubFilter);
    }
    return filtered;
  }, [allTournaments, isSuperAdmin, userOrgIds, selectedClubFilter]);

  const inscriptions = useMemo(() => {
    let filtered = allInscriptions;
    if (!isSuperAdmin) {
      filtered = filtered.filter(ins => userOrgIds.includes(ins.torneos?.organizacion_id));
    }
    if (selectedClubFilter !== 'all') {
      filtered = filtered.filter(ins => ins.torneos?.organizacion_id.toString() === selectedClubFilter);
    }
    return filtered;
  }, [allInscriptions, isSuperAdmin, userOrgIds, selectedClubFilter]);

  const classReservations = useMemo(() => {
    let filtered = allClassReservations;
    if (!isSuperAdmin) {
      filtered = filtered.filter(res => userOrgIds.includes(res.clases_disponibles?.organizacion_id));
    }
    if (selectedClubFilter !== 'all') {
      filtered = filtered.filter(res => res.clases_disponibles?.organizacion_id.toString() === selectedClubFilter);
    }
    return filtered;
  }, [allClassReservations, isSuperAdmin, userOrgIds, selectedClubFilter]);

  const courtRentals = useMemo(() => {
    let filtered = allCourtRentals;
    if (!isSuperAdmin) {
      filtered = filtered.filter(rent => userOrgIds.includes(rent.canchas?.organizacion_id));
    }
    if (selectedClubFilter !== 'all') {
      filtered = filtered.filter(rent => rent.canchas?.organizacion_id.toString() === selectedClubFilter);
    }
    return filtered;
  }, [allCourtRentals, isSuperAdmin, userOrgIds, selectedClubFilter]);

  const users = useMemo(() => {
    return allUsers;
  }, [allUsers]);

  // Staff Modal Functions
  const fetchClubStaff = async (club: any) => {
    setStaffModalClub(club);
    setStaffModalOpen(true);
    setLoadingStaff(true);
    setEditingMemberId(null);
    setConfirmDelete(null);
    try {
      const { data, error } = await supabase
        .from('miembros_organizacion')
        .select('usuario_id, organizacion_id, usuario:perfiles_usuarios(id, nombre, email, rol, roles)')
        .eq('organizacion_id', club.id);
      if (error) throw error;
      const filtered = data || [];

      const teacherIds = filtered.map(f => f.usuario_id);
      
      const { data: canchas } = await supabase.from('canchas').select('id').eq('organizacion_id', club.id);
      const canchaIds = canchas?.map(c => c.id) || [];
      
      let alquileresData: any[] = [];
      if (canchaIds.length > 0 && teacherIds.length > 0) {
        const { data: alq } = await supabase
          .from('alquileres_cancha')
          .select('usuario_id, monto_total, estado_pago, fecha')
          .in('cancha_id', canchaIds)
          .in('usuario_id', teacherIds);
          
        if (alq) alquileresData = alq;
      }

      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() - today.getDay() + 6);
      
      const startStr = startOfWeek.toISOString().split('T')[0];
      const endStr = endOfWeek.toISOString().split('T')[0];

      const enriched = filtered.map(m => {
         const u = Array.isArray(m.usuario) ? m.usuario[0] : m.usuario;
         let deuda = 0;
         let reservasSemana = 0;
         
         alquileresData.forEach(a => {
           if (a.usuario_id === m.usuario_id) {
             if (a.estado_pago === 'Pendiente') {
               deuda += Number(a.monto_total || 0);
             }
             if (a.fecha >= startStr && a.fecha <= endStr) {
               reservasSemana += 1;
             }
           }
         });

         return { ...m, usuario: { ...u, deuda, reservasSemana } };
      });

      setStaffMembers(enriched);
    } catch (err) {
      console.error('Error fetching staff:', err);
      setStaffMembers([]);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleUpdateStaffRole = async (usuarioId: string, newRole: string) => {
    try {
      const rolesArray = newRole.split(', ').filter(Boolean);
      const dbRol = rolesArray.length > 0 ? rolesArray[0] : 'Jugador';

      const { error } = await supabase
        .from('perfiles_usuarios')
        .update({ rol: dbRol, roles: rolesArray })
        .eq('id', usuarioId);
      if (error) throw error;
      setStaffMembers(prev =>
        prev.map(m => m.usuario_id === usuarioId
          ? { ...m, usuario: { ...m.usuario, rol: dbRol, roles: rolesArray } }
          : m
        )
      );
      setEditingMemberId(null);
    } catch (err) {
      console.error('Error updating role:', err);
    }
  };

  const handleUpdateStaffInfo = async (usuarioId: string) => {
    try {
      const rolesArray = editRole.split(', ').filter(Boolean);
      const dbRol = rolesArray.length > 0 ? rolesArray[0] : 'Jugador';

      const { error } = await supabase
        .from('perfiles_usuarios')
        .update({ 
          nombre: editNombre.trim(),
          email: editEmail.trim(),
          rol: dbRol,
          roles: rolesArray
        })
        .eq('id', usuarioId);
      if (error) throw error;
      
      setStaffMembers(prev =>
        prev.map(m => m.usuario_id === usuarioId
          ? { ...m, usuario: { ...m.usuario, nombre: editNombre.trim(), email: editEmail.trim(), rol: dbRol, roles: rolesArray } }
          : m
        )
      );
      setEditingMemberId(null);
    } catch (err) {
      console.error('Error updating staff info:', err);
    }
  };

  const handleRemoveStaff = async (usuarioId: string) => {
    if (!staffModalClub) return;
    try {
      const { error } = await supabase
        .from('miembros_organizacion')
        .delete()
        .eq('usuario_id', usuarioId)
        .eq('organizacion_id', staffModalClub.id);
      if (error) throw error;
      setStaffMembers(prev => prev.filter(m => m.usuario_id !== usuarioId));
      setConfirmDelete(null);
    } catch (err) {
      console.error('Error removing staff:', err);
    }
  };

  const handleToggleEstado = async (id: number, activaActual: boolean) => {
    try {
      await toggleEstadoOrganizacion(id, !activaActual);
      setAllClubs(orgs =>
        orgs.map(org => org.id === id ? { ...org, activa: !activaActual } : org)
      );
    } catch (err) {
      console.error("Error al cambiar estado:", err);
    }
  };

  // 5. KPI Calculations
  const kpis = useMemo(() => {
    const clubAdmins = users.filter(u => u.rol === 'Organizador' || u.roles?.includes('Organizador')).length;
    const activeTournaments = tournaments.filter(t => t.activo).length;

    return {
      totalClubs: clubs.length,
      totalAdmins: clubAdmins,
      totalUsers: users.length,
      activeTournaments: activeTournaments
    };
  }, [clubs, users, tournaments]);

  // 6. Global Revenues Summary
  const financialSummary = useMemo(() => {
    // Platform commissions
    const commTournaments = inscriptions.reduce((acc, curr) => acc + Number(curr.comision_plataforma || 0), 0);
    const commClasses = classReservations.reduce((acc, curr) => acc + Number(curr.comision_plataforma || 0), 0);
    const commRentals = courtRentals.reduce((acc, curr) => acc + Number(curr.comision_plataforma || 0), 0);
    const platformCommission = commTournaments + commClasses + commRentals;

    // Net club earnings
    const netTournaments = inscriptions.reduce((acc, curr) => acc + Number(curr.monto_neto_club || 0), 0);
    const netClasses = classReservations.reduce((acc, curr) => acc + Number(curr.monto_neto_club || 0), 0);
    const netRentals = courtRentals.reduce((acc, curr) => acc + Number(curr.monto_neto_club || 0), 0);
    const clubsNetRevenue = netTournaments + netClasses + netRentals;

    // Total gross volume
    const grossTournaments = inscriptions.reduce((acc, curr) => acc + Number(curr.monto_total_pagado || 0), 0);
    const grossClasses = classReservations.reduce((acc, curr) => acc + Number(curr.monto_total_pagado || 0), 0);
    const grossRentals = courtRentals.reduce((acc, curr) => acc + Number(curr.monto_total || 0), 0);
    const totalVolume = grossTournaments + grossClasses + grossRentals;

    return {
      totalVolume,
      platformCommission,
      clubsNetRevenue,
      categories: {
        tournaments: { gross: grossTournaments, comm: commTournaments, net: netTournaments },
        classes: { gross: grossClasses, comm: commClasses, net: netClasses },
        rentals: { gross: grossRentals, comm: commRentals, net: netRentals }
      }
    };
  }, [inscriptions, classReservations, courtRentals]);

  // 7. Revenues by Club Breakdown
  const clubsBreakdown = useMemo(() => {
    return clubs.map(club => {
      // Tournament sales for this club
      const clubInscriptions = inscriptions.filter(ins => ins.torneos?.organizacion_id === club.id);
      const tourGross = clubInscriptions.reduce((acc, curr) => acc + Number(curr.monto_total_pagado || 0), 0);
      const tourComm = clubInscriptions.reduce((acc, curr) => acc + Number(curr.comision_plataforma || 0), 0);
      const tourNet = clubInscriptions.reduce((acc, curr) => acc + Number(curr.monto_neto_club || 0), 0);

      // Class sales for this club
      const clubReservations = classReservations.filter(res => res.clases_disponibles?.organizacion_id === club.id);
      const classGross = clubReservations.reduce((acc, curr) => acc + Number(curr.monto_total_pagado || 0), 0);
      const classComm = clubReservations.reduce((acc, curr) => acc + Number(curr.comision_plataforma || 0), 0);
      const classNet = clubReservations.reduce((acc, curr) => acc + Number(curr.monto_neto_club || 0), 0);

      // Court rental sales for this club
      const clubRentals = courtRentals.filter(rent => rent.canchas?.organizacion_id === club.id);
      const rentGross = clubRentals.reduce((acc, curr) => acc + Number(curr.monto_total || 0), 0);
      const rentComm = clubRentals.reduce((acc, curr) => acc + Number(curr.comision_plataforma || 0), 0);
      const rentNet = clubRentals.reduce((acc, curr) => acc + Number(curr.monto_neto_club || 0), 0);

      const totalClubGross = tourGross + classGross + rentGross;
      const totalClubComm = tourComm + classComm + rentComm;
      const totalClubNet = tourNet + classNet + rentNet;

      const activeTourneysCount = tournaments.filter(t => t.organizacion_id === club.id && t.activo).length;

      return {
        ...club,
        tournamentsCount: activeTourneysCount,
        gross: totalClubGross,
        commission: totalClubComm,
        net: totalClubNet,
        details: {
          tournaments: { gross: tourGross, comm: tourComm, net: tourNet },
          classes: { gross: classGross, comm: classComm, net: classNet },
          rentals: { gross: rentGross, comm: rentComm, net: rentNet }
        }
      };
    });
  }, [clubs, inscriptions, classReservations, courtRentals, tournaments]);

  // 8. Revenues by Tournament
  const tournamentsBreakdown = useMemo(() => {
    return tournaments.map(torneo => {
      const torneoInscripciones = inscriptions.filter(ins => ins.torneo_id === torneo.id);
      const gross = torneoInscripciones.reduce((acc, curr) => acc + Number(curr.monto_total_pagado || 0), 0);
      const commission = torneoInscripciones.reduce((acc, curr) => acc + Number(curr.comision_plataforma || 0), 0);
      const net = torneoInscripciones.reduce((acc, curr) => acc + Number(curr.monto_neto_club || 0), 0);

      return {
        ...torneo,
        inscriptionsCount: torneoInscripciones.length,
        gross,
        commission,
        net
      };
    });
  }, [tournaments, inscriptions]);

  // 9. Monthly Breakdown
  const monthlyBreakdown = useMemo(() => {
    const monthlyMap: { [key: string]: { month: string; gross: number; comm: number; net: number; tour: number; class: number; rent: number } } = {};

    const addToMonth = (dateStr: string | null, gross: number, comm: number, net: number, type: 'tour' | 'class' | 'rent') => {
      if (!dateStr) return;
      const yearMonth = dateStr.substring(0, 7); // YYYY-MM
      if (!monthlyMap[yearMonth]) {
        monthlyMap[yearMonth] = { month: yearMonth, gross: 0, comm: 0, net: 0, tour: 0, class: 0, rent: 0 };
      }
      monthlyMap[yearMonth].gross += gross;
      monthlyMap[yearMonth].comm += comm;
      monthlyMap[yearMonth].net += net;
      if (type === 'tour') monthlyMap[yearMonth].tour += gross;
      if (type === 'class') monthlyMap[yearMonth].class += gross;
      if (type === 'rent') monthlyMap[yearMonth].rent += gross;
    };

    inscriptions.forEach(ins => addToMonth(ins.fecha_pago, Number(ins.monto_total_pagado || 0), Number(ins.comision_plataforma || 0), Number(ins.monto_neto_club || 0), 'tour'));
    classReservations.forEach(res => addToMonth(res.fecha_pago, Number(res.monto_total_pagado || 0), Number(res.comision_plataforma || 0), Number(res.monto_neto_club || 0), 'class'));
    courtRentals.forEach(rent => addToMonth(rent.fecha_pago, Number(rent.monto_total || 0), Number(rent.comision_plataforma || 0), Number(rent.monto_neto_club || 0), 'rent'));

    return Object.values(monthlyMap).sort((a, b) => b.month.localeCompare(a.month));
  }, [inscriptions, classReservations, courtRentals]);

  const getMonthLabel = (yearMonth: string) => {
    const [year, month] = yearMonth.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  };

  // Filters
  const filteredClubs = useMemo(() => {
    return clubsBreakdown.filter(club => 
      club.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      club.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [clubsBreakdown, searchQuery]);

  const filteredTournaments = useMemo(() => {
    return tournamentsBreakdown.filter(t => 
      t.nombre_torneo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.organizaciones?.nombre || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tournamentsBreakdown, searchQuery]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans transition-colors duration-300 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        
        {/* Dashboard Header */}
        <header className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-3 border border-primary/20 animate-pulse-subtle">
              <LayoutDashboard size={14} />
              {isSuperAdmin ? 'SuperAdmin Dashboard' : 'Club Admin Dashboard'}
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight">
              {isSuperAdmin ? 'Consola de Control SaaS' : 'Consola de Control del Club'}
            </h1>
            <p className="text-stone-500 dark:text-stone-400 mt-2">
              {isSuperAdmin 
                ? 'Visualización en tiempo real de métricas, recaudación transaccional y administración de clubes.'
                : 'Métricas de ingresos, torneos, clases y reservas correspondientes a tu club.'
              }
            </p>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <div className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-4 shadow-sm min-w-[200px] hover:border-primary/20 transition-all duration-300">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                <Wallet size={20} />
              </div>
              <div>
                <p className="text-[10px] text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">
                  {isSuperAdmin ? 'Volumen Transaccionado' : 'Recaudación Bruta'}
                </p>
                <p className="text-lg font-black text-foreground">{formatCurrency(financialSummary.totalVolume)}</p>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-4 shadow-sm min-w-[200px] hover:border-primary/20 transition-all duration-300">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner">
                <BadgeDollarSign size={20} />
              </div>
              <div>
                <p className="text-[10px] text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">
                  {isSuperAdmin ? 'Comisión Plataforma' : 'Neto Club'}
                </p>
                <p className="text-lg font-black text-primary">
                  {isSuperAdmin ? formatCurrency(financialSummary.platformCommission) : formatCurrency(financialSummary.clubsNetRevenue)}
                </p>
              </div>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin"></div>
            </div>
            <p className="text-stone-500 dark:text-stone-400 font-medium text-sm animate-pulse">
              Consolidando información del servidor...
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              
              <div className="bg-surface border border-border rounded-2xl p-5 hover:border-primary/30 transition-all duration-300 group shadow-sm flex items-center gap-4">
                <div className="p-3 bg-primary/15 text-primary rounded-xl group-hover:scale-105 transition-transform">
                  <Building2 size={24} />
                </div>
                <div>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">
                    Clubes
                  </p>
                  <p className="text-2xl font-bold mt-0.5">{kpis.totalClubs}</p>
                </div>
              </div>

              {isSuperAdmin ? (
                <div className="bg-surface border border-border rounded-2xl p-5 hover:border-primary/30 transition-all duration-300 group shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-primary/15 text-primary rounded-xl group-hover:scale-105 transition-transform">
                    <UserPlus size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">Administradores</p>
                    <p className="text-2xl font-bold mt-0.5">{kpis.totalAdmins}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-surface border border-border rounded-2xl p-5 hover:border-primary/30 transition-all duration-300 group shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-primary/15 text-primary rounded-xl group-hover:scale-105 transition-transform">
                    <BadgeDollarSign size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">Comisión SaaS Pagada</p>
                    <p className="text-2xl font-bold mt-0.5 text-red-500">{formatCurrency(financialSummary.platformCommission)}</p>
                  </div>
                </div>
              )}

              <div className="bg-surface border border-border rounded-2xl p-5 hover:border-primary/30 transition-all duration-300 group shadow-sm flex items-center gap-4">
                <div className="p-3 bg-primary/15 text-primary rounded-xl group-hover:scale-105 transition-transform">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">Usuarios</p>
                  <p className="text-2xl font-bold mt-0.5">{kpis.totalUsers}</p>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5 hover:border-primary/30 transition-all duration-300 group shadow-sm flex items-center gap-4">
                <div className="p-3 bg-primary/15 text-primary rounded-xl group-hover:scale-105 transition-transform">
                  <Trophy size={24} />
                </div>
                <div>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">Torneos Activos</p>
                  <p className="text-2xl font-bold mt-0.5">{kpis.activeTournaments}</p>
                </div>
              </div>

            </div>

            {/* Financial Breakdown Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Recaudación por Concepto */}
              <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm lg:col-span-2">
                <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <Layers size={16} className="text-primary" /> Recaudación por Concepto
                </h3>
                <div className="space-y-6">
                  {/* Torneos */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-2">
                      <span className="flex items-center gap-2 text-foreground">
                        <span className="w-3 h-3 rounded bg-primary" />
                        Inscripciones a Torneos
                      </span>
                      <span className="text-stone-500">
                        {formatCurrency(financialSummary.categories.tournaments.gross)}{' '}
                        <span className="text-[10px] text-stone-400">(SaaS: {formatCurrency(financialSummary.categories.tournaments.comm)})</span>
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-primary h-3 rounded-full transition-all duration-500"
                        style={{ width: `${financialSummary.totalVolume > 0 ? (financialSummary.categories.tournaments.gross / financialSummary.totalVolume) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Clases */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-2">
                      <span className="flex items-center gap-2 text-foreground">
                        <span className="w-3 h-3 rounded bg-orange-400" />
                        Clases Publicadas
                      </span>
                      <span className="text-stone-500">
                        {formatCurrency(financialSummary.categories.classes.gross)}{' '}
                        <span className="text-[10px] text-stone-400">(SaaS: {formatCurrency(financialSummary.categories.classes.comm)})</span>
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-orange-450 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${financialSummary.totalVolume > 0 ? (financialSummary.categories.classes.gross / financialSummary.totalVolume) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Alquileres */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-2">
                      <span className="flex items-center gap-2 text-foreground">
                        <span className="w-3 h-3 rounded bg-amber-400" />
                        Alquileres de Canchas
                      </span>
                      <span className="text-stone-500">
                        {formatCurrency(financialSummary.categories.rentals.gross)}{' '}
                        <span className="text-[10px] text-stone-400">(SaaS: {formatCurrency(financialSummary.categories.rentals.comm)})</span>
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-amber-400 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${financialSummary.totalVolume > 0 ? (financialSummary.categories.rentals.gross / financialSummary.totalVolume) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Reparto de Ganancias */}
              <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <Landmark size={16} className="text-primary" /> Distribución de Ingresos
                  </h3>
                  
                  <div className="flex flex-col gap-4 mt-2">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                        <span className="text-xs font-medium text-stone-500 dark:text-stone-400">SaaS (Plataforma)</span>
                      </div>
                      <span className="text-xs font-bold text-foreground">{formatCurrency(financialSummary.platformCommission)}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-stone-400" />
                        <span className="text-xs font-medium text-stone-500 dark:text-stone-400">Clubes (Neto)</span>
                      </div>
                      <span className="text-xs font-bold text-foreground">{formatCurrency(financialSummary.clubsNetRevenue)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-border flex items-center justify-center gap-8">
                  <div className="text-center">
                    <p className="text-[10px] text-stone-400 uppercase tracking-wider font-bold">Comisión Media</p>
                    <p className="text-2xl font-black text-primary">
                      {financialSummary.totalVolume > 0 
                        ? `${((financialSummary.platformCommission / financialSummary.totalVolume) * 100).toFixed(1)}%` 
                        : '0.0%'
                      }
                    </p>
                  </div>
                  <div className="text-center border-l border-border pl-8">
                    <p className="text-[10px] text-stone-400 uppercase tracking-wider font-bold">Operaciones</p>
                    <p className="text-2xl font-black text-foreground">
                      {inscriptions.length + classReservations.length + courtRentals.length}
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Tabs Selector & Search Control */}
            <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 md:p-6 border-b border-border bg-surface-secondary/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex overflow-x-auto gap-2 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl w-fit">
                  <button 
                    onClick={() => { setActiveTab('clubs'); setSearchQuery(''); }}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                      activeTab === 'clubs' 
                        ? 'bg-surface text-primary shadow-sm' 
                        : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                    }`}
                  >
                    Clubes ({clubs.length})
                  </button>
                  <button 
                    onClick={() => { setActiveTab('tournaments'); setSearchQuery(''); }}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                      activeTab === 'tournaments' 
                        ? 'bg-surface text-primary shadow-sm' 
                        : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                    }`}
                  >
                    Torneos ({tournaments.length})
                  </button>
                  <button 
                    onClick={() => { setActiveTab('monthly'); setSearchQuery(''); }}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                      activeTab === 'monthly' 
                        ? 'bg-surface text-primary shadow-sm' 
                        : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                    }`}
                  >
                    Recaudación Mensual ({monthlyBreakdown.length})
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  
                  {/* Filtro por Club */}
                  <select
                    value={selectedClubFilter}
                    onChange={(e) => setSelectedClubFilter(e.target.value)}
                    className="w-full md:w-auto bg-surface border border-border rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary transition-all text-foreground font-semibold"
                  >
                    <option value="all">Todos mis clubes</option>
                    {(isSuperAdmin ? allClubs : allClubs.filter(c => userOrgIds.includes(c.id))).map((c) => (
                      <option key={c.id} value={c.id.toString()}>{c.nombre}</option>
                    ))}
                  </select>

                  {activeTab !== 'monthly' && (
                    <div className="relative flex-grow md:flex-initial">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                      <input 
                        type="text" 
                        placeholder={activeTab === 'clubs' ? 'Buscar club...' : 'Buscar torneo...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full md:w-60 bg-surface border border-border rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-primary transition-all placeholder-stone-400 font-medium"
                      />
                    </div>
                  )}

                  {(isSuperAdmin || profile?.rol === 'Organizador') && (
                    <div className="flex items-center gap-2">
                      <Link 
                        href="/admin/staff/nuevo"
                        className="inline-flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 border border-border text-foreground font-bold py-2 px-4 rounded-xl transition-all text-xs"
                      >
                        <UserPlus size={14} />
                        Alta Staff
                      </Link>
                      {isSuperAdmin && (
                        <Link 
                          href="/admin/clubes/nuevo"
                          className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-2 px-4 rounded-xl transition-all shadow-sm text-xs"
                        >
                          <Plus size={14} />
                          Nuevo Club
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Tab: Clubs / Organizations */}
              {activeTab === 'clubs' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface text-stone-500 dark:text-stone-400 text-xs font-bold uppercase tracking-wider border-b border-border">
                        <th className="px-6 py-4">Club / Organización</th>
                        <th className="px-6 py-4 hidden md:table-cell">Slug</th>
                        <th className="px-6 py-4 text-center hidden sm:table-cell">Torneos Activos</th>
                        <th className="px-6 py-4 text-right hidden lg:table-cell">Torneos (Club / SaaS)</th>
                        <th className="px-6 py-4 text-right hidden lg:table-cell">Clases (Club / SaaS)</th>
                        <th className="px-6 py-4 text-right hidden lg:table-cell">Alquileres (Club / SaaS)</th>
                        <th className="px-6 py-4 text-right">Total Neto Club</th>
                        <th className="px-6 py-4 text-center">Estado</th>
                        {(isSuperAdmin || profile?.rol === 'Organizador') && <th className="px-6 py-4 text-right">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredClubs.length === 0 ? (
                        <tr>
                          <td colSpan={(isSuperAdmin || profile?.rol === 'Organizador') ? 9 : 8} className="px-6 py-12 text-center text-stone-500 dark:text-stone-400 text-sm">
                            No se encontraron clubes registrados.
                          </td>
                        </tr>
                      ) : (
                        filteredClubs.map((club) => (
                          <tr key={club.id} className="hover:bg-surface-secondary/25 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm border ${
                                  club.activa 
                                    ? 'bg-primary/10 border-primary/20 text-primary' 
                                    : 'bg-surface border-border text-stone-400'
                                }`}>
                                  {club.nombre.charAt(0)}
                                </div>
                                <span className={`font-bold ${!club.activa && 'text-stone-400'}`}>{club.nombre}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs text-stone-500 dark:text-stone-400 font-mono hidden md:table-cell">/{club.slug}</td>
                            <td className="px-6 py-4 text-center text-sm font-semibold hidden sm:table-cell">{club.tournamentsCount}</td>
                            
                            {/* Torneos */}
                            <td className="px-6 py-4 text-right text-xs hidden lg:table-cell">
                              <div className="font-semibold text-foreground">{formatCurrency(club.details.tournaments.net)}</div>
                              <div className="text-[10px] text-stone-400">SaaS: {formatCurrency(club.details.tournaments.comm)}</div>
                            </td>
                            
                            {/* Clases */}
                            <td className="px-6 py-4 text-right text-xs hidden lg:table-cell">
                              <div className="font-semibold text-foreground">{formatCurrency(club.details.classes.net)}</div>
                              <div className="text-[10px] text-stone-400">SaaS: {formatCurrency(club.details.classes.comm)}</div>
                            </td>

                            {/* Alquileres */}
                            <td className="px-6 py-4 text-right text-xs hidden lg:table-cell">
                              <div className="font-semibold text-foreground">{formatCurrency(club.details.rentals.net)}</div>
                              <div className="text-[10px] text-stone-400">SaaS: {formatCurrency(club.details.rentals.comm)}</div>
                            </td>

                            {/* Total Neto */}
                            <td className="px-6 py-4 text-right font-bold text-emerald-500 text-sm">
                              {formatCurrency(club.net)}
                            </td>

                            {/* Estado */}
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                                club.activa 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                                  : 'bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/20'
                              }`}>
                                {club.activa ? 'Operativo' : 'Suspendido'}
                              </span>
                            </td>

                            {/* Acciones (SuperAdmin / Admin) */}
                            {(isSuperAdmin || profile?.rol === 'Organizador') && (
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => fetchClubStaff(club)}
                                    className="inline-flex items-center justify-center p-2 rounded-lg transition-all bg-surface border border-border text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/20"
                                    title="Ver Staff del Club"
                                  >
                                    <Eye size={14} />
                                  </button>
                                  {isSuperAdmin && (
                                    <>
                                      <Link
                                        href={`/admin/clubes/editar/${club.id}`}
                                        className="inline-flex items-center justify-center p-2 rounded-lg transition-all bg-surface border border-border text-foreground hover:bg-stone-100 dark:hover:bg-stone-800"
                                        title="Editar Club"
                                      >
                                        <Edit2 size={14} />
                                      </Link>
                                      <button
                                        onClick={() => handleToggleEstado(club.id, club.activa)}
                                        className={`inline-flex items-center justify-center p-2 rounded-lg transition-all border ${
                                          club.activa 
                                            ? 'bg-surface border-border text-foreground hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20' 
                                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/20'
                                        }`}
                                        title={club.activa ? 'Suspender Club' : 'Reactivar Club'}
                                      >
                                        <Power size={14} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab: Tournaments */}
              {activeTab === 'tournaments' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface text-stone-500 dark:text-stone-400 text-xs font-bold uppercase tracking-wider border-b border-border">
                        <th className="px-6 py-4">Torneo</th>
                        <th className="px-6 py-4">Club / Organización</th>
                        <th className="px-6 py-4 hidden sm:table-cell">Deporte</th>
                        <th className="px-6 py-4 hidden sm:table-cell">Categoría</th>
                        <th className="px-6 py-4 text-center hidden md:table-cell">Fase Actual</th>
                        <th className="px-6 py-4 text-center">Inscriptos</th>
                        <th className="px-6 py-4 text-right hidden lg:table-cell">Bruto</th>
                        <th className="px-6 py-4 text-right hidden md:table-cell">SaaS</th>
                        <th className="px-6 py-4 text-right">Neto Club</th>
                        <th className="px-6 py-4 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredTournaments.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-6 py-12 text-center text-stone-500 dark:text-stone-400 text-sm">
                            No se encontraron torneos.
                          </td>
                        </tr>
                      ) : (
                        filteredTournaments.map((torneo) => (
                          <tr key={torneo.id} className="hover:bg-surface-secondary/25 transition-colors">
                            <td className="px-6 py-4 font-bold">{torneo.nombre_torneo}</td>
                            <td className="px-6 py-4 text-sm">{torneo.organizaciones?.nombre || 'Sin Club'}</td>
                            <td className="px-6 py-4 text-xs font-semibold hidden sm:table-cell">{torneo.deporte}</td>
                            <td className="px-6 py-4 hidden sm:table-cell">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                                Cat {torneo.categoria_torneo}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center text-xs font-medium hidden md:table-cell">
                              <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-foreground border border-border">
                                {torneo.fase_actual}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center font-bold text-sm">{torneo.inscriptionsCount}</td>
                            <td className="px-6 py-4 text-right text-sm font-semibold hidden lg:table-cell">{formatCurrency(torneo.gross)}</td>
                            <td className="px-6 py-4 text-right text-sm text-primary font-semibold hidden md:table-cell">{formatCurrency(torneo.commission)}</td>
                            <td className="px-6 py-4 text-right text-sm text-emerald-500 font-semibold">{formatCurrency(torneo.net)}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                torneo.activo 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                                  : 'bg-stone-100 text-stone-500 border-border'
                              }`}>
                                {torneo.activo ? 'Activo' : 'Cerrado'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab: Monthly */}
              {activeTab === 'monthly' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface text-stone-500 dark:text-stone-400 text-xs font-bold uppercase tracking-wider border-b border-border">
                        <th className="px-6 py-4">Mes</th>
                        <th className="px-6 py-4 text-right hidden md:table-cell">Torneos</th>
                        <th className="px-6 py-4 text-right hidden md:table-cell">Clases</th>
                        <th className="px-6 py-4 text-right hidden md:table-cell">Alquileres</th>
                        <th className="px-6 py-4 text-right hidden sm:table-cell">Bruto</th>
                        <th className="px-6 py-4 text-right text-primary">SaaS</th>
                        <th className="px-6 py-4 text-right text-emerald-500">Neto Clubes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {monthlyBreakdown.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-stone-500 dark:text-stone-400 text-sm">
                            No se registran pagos en el sistema.
                          </td>
                        </tr>
                      ) : (
                        monthlyBreakdown.map((row) => (
                          <tr key={row.month} className="hover:bg-surface-secondary/25 transition-colors">
                            <td className="px-6 py-4 font-bold text-sm capitalize">{getMonthLabel(row.month)}</td>
                            <td className="px-6 py-4 text-right text-sm font-semibold hidden md:table-cell">{formatCurrency(row.tour)}</td>
                            <td className="px-6 py-4 text-right text-sm font-semibold hidden md:table-cell">{formatCurrency(row.class)}</td>
                            <td className="px-6 py-4 text-right text-sm font-semibold hidden md:table-cell">{formatCurrency(row.rent)}</td>
                            <td className="px-6 py-4 text-right text-sm font-bold text-foreground hidden sm:table-cell">{formatCurrency(row.gross)}</td>
                            <td className="px-6 py-4 text-right text-sm font-bold text-primary">{formatCurrency(row.comm)}</td>
                            <td className="px-6 py-4 text-right text-sm font-bold text-emerald-500">{formatCurrency(row.net)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

            </div>

          </div>
        )}

      </div>

      {/* Staff Members Modal */}
      {staffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setStaffModalOpen(false)}
          />
          {/* Modal Card */}
          <div className="relative z-10 w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
            {/* Accent top bar */}
            <div className="h-1 w-full bg-gradient-to-r from-primary via-orange-400 to-amber-400" />
            
            {/* Header */}
            <div className="p-6 pb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <UserCog size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-foreground tracking-tight">
                    Staff de {staffModalClub?.nombre}
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Administradores y organizadores asignados
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStaffModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-stone-400 hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 pb-6 max-h-[60vh] overflow-y-auto">
              {loadingStaff ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="relative w-10 h-10">
                    <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                    <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
                  </div>
                  <p className="text-xs text-stone-400 animate-pulse">Cargando staff...</p>
                </div>
              ) : staffMembers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center mb-3">
                    <Users size={20} className="text-stone-400" />
                  </div>
                  <p className="text-sm text-stone-500 dark:text-stone-400 font-medium">
                    No hay staff asignado a este club.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {staffMembers.filter(member => (member.usuario?.rol || member.rol) !== 'SuperAdmin').map((member) => {
                    const u = member.usuario || member;
                    const isEditing = editingMemberId === member.usuario_id;
                    const isDeleting = confirmDelete === member.usuario_id;

                    if (isEditing) {
                      return (
                        <div
                          key={member.usuario_id}
                          className="p-4 rounded-xl border border-primary/20 bg-surface-secondary/40 space-y-3"
                        >
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-stone-500 font-bold uppercase">Nombre</label>
                              <input
                                type="text"
                                value={editNombre}
                                onChange={(e) => setEditNombre(e.target.value)}
                                className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:border-primary"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-stone-500 font-bold uppercase">Email</label>
                              <input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-border bg-surface text-stone-500 cursor-not-allowed opacity-60"
                                disabled
                                title="El email de acceso no puede cambiarse directamente"
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-1">
                            <div>
                              <label className="text-[10px] text-stone-500 font-bold uppercase block mb-1">Rol</label>
                              <div className="flex gap-1.5">
                                {['Organizador', 'Profesor'].map((r) => (
                                  <button
                                    key={r}
                                    type="button"
                                    onClick={() => {
                                      setEditRole((prev) => {
                                        let roles = prev.split(', ').filter(Boolean);
                                        if (roles.includes(r)) {
                                          return roles.filter(role => role !== r).join(', ') || 'Jugador';
                                        } else {
                                          return [...roles, r].join(', ');
                                        }
                                      });
                                    }}
                                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                                      editRole.includes(r)
                                        ? 'bg-primary text-white border-primary'
                                        : 'bg-surface border-border text-stone-500 hover:border-primary/30 hover:text-primary'
                                    }`}
                                  >
                                    {r}
                                  </button>
                                ))}
                              </div>
                            </div>
                            
                            <div className="flex gap-2 self-end">
                              <button
                                type="button"
                                onClick={() => setEditingMemberId(null)}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-border bg-surface text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateStaffInfo(member.usuario_id)}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary text-white hover:bg-primary/95 transition-colors"
                              >
                                Guardar
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={member.usuario_id}
                        className={`group relative p-4 rounded-xl border transition-all duration-200 ${
                          isDeleting
                            ? 'border-red-500/30 bg-red-500/5'
                            : 'border-border hover:border-primary/20 bg-surface-secondary/30 hover:bg-surface-secondary/50'
                        }`}
                      >
                        {/* Delete Confirmation Overlay */}
                        {isDeleting && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-surface/95 backdrop-blur-sm border border-red-500/20">
                            <div className="text-center px-4">
                              <AlertTriangle size={24} className="text-red-500 mx-auto mb-2" />
                              <p className="text-xs font-semibold text-foreground mb-3">
                                ¿Eliminar a {u?.nombre} de este club?
                              </p>
                              <div className="flex gap-2 justify-center">
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-border bg-surface text-foreground hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={() => handleRemoveStaff(member.usuario_id)}
                                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                                >
                                  Confirmar
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {u?.nombre?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{u?.nombre || 'Sin nombre'}</p>
                            <p className="text-xs text-stone-500 dark:text-stone-400 truncate">{u?.email}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            {(u?.reservasSemana > 0) && (
                               <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold border bg-stone-100 dark:bg-stone-800 text-stone-500 border-border" title="Horas por semana">
                                 {u.reservasSemana} hs/sem
                               </span>
                            )}
                            {(u?.deuda > 0) && (
                               <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold border bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20" title={`Deuda: $${u.deuda}`}>
                                 Debe: ${u.deuda}
                               </span>
                            )}
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold border bg-primary/10 text-primary border-primary/20">
                              {u?.roles && u.roles.length > 0 ? u.roles.filter((r:string)=>r!=='Jugador').join(', ') : (u?.rol || 'Staff')}
                            </span>
                            
                            {/* Action buttons — always visible */}
                            <div className="flex items-center gap-1 transition-opacity">
                              <button
                                onClick={() => {
                                  setEditingMemberId(member.usuario_id);
                                  setEditRole(u?.roles && u.roles.length > 0 ? u.roles.filter((r:string)=>r!=='Jugador').join(', ') : (u?.rol || 'Organizador'));
                                  setEditNombre(u?.nombre || '');
                                  setEditEmail(u?.email || '');
                                }}
                                className="p-1.5 rounded-lg text-stone-400 hover:text-primary hover:bg-primary/10 transition-all"
                                title="Editar miembro"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => setConfirmDelete(member.usuario_id)}
                                className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
                                title="Eliminar del club"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border bg-surface-secondary/20 flex items-center justify-between">
              <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">
                {staffMembers.length} miembro{staffMembers.length !== 1 ? 's' : ''}
              </p>
              <button
                onClick={() => setStaffModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-surface border border-border text-foreground hover:bg-stone-100 dark:hover:bg-stone-800 transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
