import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { Brand, Spacing, Radius, Shadow } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import CourtUpModal from '@/components/CourtUpModal';

interface Debtor {
  id: string;
  nombre: string;
  monto: number;
  fechas: string[];
}

export default function DashboardScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userClubs, setUserClubs] = useState<any[]>([]);
  const [activeClubId, setActiveClubId] = useState<number | null>(null);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  
  const [stats, setStats] = useState({
    totalProfesores: 0,
    totalTorneos: 0,
    deudaPendiente: 0,
    ingresosBrutos: 0,
    totalCanchas: 0,
    totalJugadores: 0,
    actividadHoy: 0
  });

  const fetchUserClubs = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('miembros_organizacion')
        .select('organizacion_id, organizaciones(id, nombre)')
        .eq('usuario_id', user.id);
        
      if (data && data.length > 0) {
        const clubs = data.map((d: any) => d.organizaciones).filter(Boolean);
        setUserClubs(clubs);
        if (!activeClubId) {
          setActiveClubId(clubs[0].id);
        }
      }
    } catch (e) {
      console.error('Error fetching clubs', e);
    }
  }, [user, activeClubId]);

  const fetchDashboardData = useCallback(async () => {
    if (!activeClubId) return;
    try {
      const { data: canchas, error: canchasError } = await supabase
        .from('canchas')
        .select('id')
        .eq('organizacion_id', activeClubId);

      if (canchasError) throw canchasError;
      const canchaIds = canchas?.map(c => c.id) || [];
      
      let deudaPendiente = 0;
      let ingresosBrutos = 0;
      let actividadHoy = 0;
      const debtorsMap = new Map<string, Debtor>();
      const uniquePlayers = new Set<string>();

      const hoy = new Date().toISOString().split('T')[0];

      if (canchaIds.length > 0) {
        const { data: alquileres, error: alquileresError } = await supabase
          .from('alquileres_cancha')
          .select('id, usuario_id, monto_total, estado_pago, fecha, usuario:perfiles_usuarios(nombre, email)')
          .in('cancha_id', canchaIds);

        if (!alquileresError && alquileres) {
          alquileres.forEach((a: any) => {
            const amount = Number(a.monto_total || 0);
            if (a.usuario_id) uniquePlayers.add(a.usuario_id);
            if (a.fecha === hoy) actividadHoy++;
            
            if (a.estado_pago === 'Pendiente') {
              deudaPendiente += amount;
              if (a.usuario_id) {
                const userName = a.usuario?.nombre || a.usuario?.email || 'Desconocido';
                if (!debtorsMap.has(a.usuario_id)) {
                  debtorsMap.set(a.usuario_id, { id: a.usuario_id, nombre: userName, monto: 0, fechas: [] });
                }
                const debtor = debtorsMap.get(a.usuario_id)!;
                debtor.monto += amount;
                if (a.fecha && !debtor.fechas.includes(a.fecha)) {
                  debtor.fechas.push(a.fecha);
                }
              }
            } else if (a.estado_pago === 'Aprobado') {
              ingresosBrutos += amount;
            }
          });
        }
      }
      
      setDebtors(Array.from(debtorsMap.values()).sort((a, b) => b.monto - a.monto));

      const { data: miembros } = await supabase
        .from('miembros_organizacion')
        .select('usuario_id, usuario:perfiles_usuarios(rol, roles)')
        .eq('organizacion_id', activeClubId);
        
      let totalProfesores = 0;
      if (miembros) {
        miembros.forEach(m => {
          const u = Array.isArray(m.usuario) ? m.usuario[0] : m.usuario;
          if (u && u.rol !== 'SuperAdmin' && (!u.roles || !u.roles.includes('SuperAdmin'))) {
            if (u.rol === 'Profesor' || (u.roles && u.roles.includes('Profesor'))) {
              totalProfesores++;
            }
          }
        });
      }

      const { count: torneosCount } = await supabase
        .from('torneos')
        .select('*', { count: 'exact', head: true })
        .eq('organizacion_id', activeClubId);

      const { data: torneos } = await supabase
        .from('torneos')
        .select('id')
        .eq('organizacion_id', activeClubId);
        
      if (torneos && torneos.length > 0) {
        const torneoIds = torneos.map(t => t.id);
        const { data: inscripciones } = await supabase
          .from('inscripciones_torneo')
          .select('monto_total_pagado, usuario_id')
          .in('torneo_id', torneoIds)
          .eq('estado_pago', 'Aprobado');
          
        if (inscripciones) {
          inscripciones.forEach(ins => {
            if (ins.usuario_id) uniquePlayers.add(ins.usuario_id);
            ingresosBrutos += Number(ins.monto_total_pagado || 0);
          });
        }

        // Count matches for today
        const { count: partidosHoy } = await supabase
          .from('partidos')
          .select('*', { count: 'exact', head: true })
          .in('torneo_id', torneoIds)
          .eq('fecha_partido', hoy);
          
        if (partidosHoy) actividadHoy += partidosHoy;
      }

      setStats({
        totalProfesores,
        totalTorneos: torneosCount || 0,
        deudaPendiente,
        ingresosBrutos,
        totalCanchas: canchaIds.length,
        totalJugadores: uniquePlayers.size,
        actividadHoy
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeClubId]);

  useEffect(() => {
    fetchUserClubs();
  }, [fetchUserClubs]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const renderCard = (title: string, value: string | number, icon: any, color: string, description: string, onPress?: () => void) => {
    const CardContent = (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, Shadow.sm]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, { backgroundColor: `${color}15` }]}>
            <Ionicons name={icon} size={24} color={color} />
          </View>
          <Text style={[styles.cardValue, { color: theme.text }]}>{value}</Text>
        </View>
        <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>{description}</Text>
      </View>
    );
    if (onPress) {
      return (
        <TouchableOpacity style={{ width: '48%', marginBottom: Spacing.md }} onPress={onPress} activeOpacity={0.7}>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, width: '100%', marginBottom: 0 }, Shadow.sm]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: `${color}15` }]}>
                <Ionicons name={icon} size={24} color={color} />
              </View>
              <Text style={[styles.cardValue, { color: theme.text }]}>{value}</Text>
            </View>
            <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>{description}</Text>
          </View>
        </TouchableOpacity>
      );
    }
    return CardContent;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <Text style={styles.headerSubtitle}>Información general del club</Text>
        {userClubs.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.clubSelector}>
            {userClubs.map(club => (
              <TouchableOpacity
                key={club.id}
                onPress={() => setActiveClubId(club.id)}
                style={[
                  styles.clubBadge,
                  { 
                    backgroundColor: activeClubId === club.id ? Brand.orange : 'rgba(255, 255, 255, 0.1)',
                    borderColor: activeClubId === club.id ? Brand.orange : 'rgba(255, 255, 255, 0.2)'
                  }
                ]}
              >
                <Text style={[styles.clubBadgeText, { color: activeClubId === club.id ? '#fff' : '#aaa' }]}>
                  {club.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.orange} />
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.orange} />}
        >
          <View style={styles.grid}>
            {renderCard(
              'Profesores', 
              stats.totalProfesores, 
              'school-outline', 
              Brand.green, 
              'Staff con rol de profesor'
            )}
            
            {renderCard(
              'Deuda Pendiente', 
              `$${stats.deudaPendiente.toLocaleString('es-AR')}`, 
              'alert-circle-outline', 
              Brand.orange, 
              'Alquileres no cobrados',
              () => setShowDebtModal(true)
            )}
            
            {renderCard(
              'Torneos Activos', 
              stats.totalTorneos, 
              'trophy-outline', 
              '#3b82f6', 
              'Torneos creados en el club'
            )}
            
            {renderCard(
              'Ingresos Totales', 
              `$${stats.ingresosBrutos.toLocaleString('es-AR')}`, 
              'cash-outline', 
              Brand.green, 
              'Pagos recibidos'
            )}
            
            {renderCard(
              'Canchas Totales', 
              stats.totalCanchas, 
              'grid-outline', 
              '#a855f7', 
              'Ver disponibilidad y gestión',
              () => router.push('/(organizador)/canchas' as any)
            )}

            {renderCard(
              'Jugadores', 
              stats.totalJugadores, 
              'people-outline', 
              '#eab308', 
              'Clientes únicos'
            )}
            
            {renderCard(
              'Actividad Hoy', 
              stats.actividadHoy, 
              'calendar-outline', 
              '#ec4899', 
              'Reservas y partidos hoy'
            )}
          </View>
        </ScrollView>
      )}

      <CourtUpModal
        visible={showDebtModal}
        onClose={() => setShowDebtModal(false)}
        title="Detalle de Deudas"
      >
        <ScrollView style={{ maxHeight: 400 }}>
          {debtors.length === 0 ? (
            <Text style={{ color: theme.textSecondary, textAlign: 'center', marginVertical: 20 }}>No hay deudas pendientes en este club.</Text>
          ) : (
            debtors.map(debtor => (
              <View key={debtor.id} style={[styles.debtorItem, { borderBottomColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.debtorName, { color: theme.text }]}>{debtor.nombre}</Text>
                  <Text style={[styles.debtorDates, { color: theme.textSecondary }]}>
                    Fechas: {debtor.fechas.length > 2 
                      ? debtor.fechas.slice(0, 2).join(', ') + ' y más...' 
                      : debtor.fechas.join(', ')}
                  </Text>
                </View>
                <Text style={[styles.debtorAmount, { color: Brand.orange }]}>
                  ${debtor.monto.toLocaleString('es-AR')}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </CourtUpModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Spacing.xxxl + Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { color: '#9ca3af', fontSize: 14, marginTop: 2 },
  clubSelector: { marginTop: Spacing.md, flexDirection: 'row' },
  clubBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginRight: 8,
  },
  clubBadgeText: { fontSize: 12, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: Spacing.xl, paddingBottom: 100 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  debtorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  debtorName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  debtorDates: { fontSize: 12 },
  debtorAmount: { fontSize: 16, fontWeight: '800' }
});
