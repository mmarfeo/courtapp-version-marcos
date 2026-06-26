import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { Brand, Spacing, Radius, Shadow } from '@/constants/theme';
import { BracketModal } from '@/components/bracket-modal';

export default function JugadorDashboardScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [gastos, setGastos] = useState({
    torneos: 0,
    clases: 0,
    alquileres: 0,
    totalMes: 0
  });
  const [misTorneos, setMisTorneos] = useState<any[]>([]);
  const [misClases, setMisClases] = useState<any[]>([]);

  // Bracket modal state
  const [bracketVisible, setBracketVisible] = useState(false);
  const [selectedTorneo, setSelectedTorneo] = useState<{ id: string; nombre: string } | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const startOfMonthStr = startOfMonth.toISOString();

      // Fetch Gastos Torneos del mes
      const { data: torneosData } = await supabase
        .from('inscripciones_torneo')
        .select('monto_total_pagado, fecha_pago')
        .eq('usuario_id', user.id)
        .gte('fecha_pago', startOfMonthStr);
      
      // Fetch Gastos Clases del mes
      const { data: clasesData } = await supabase
        .from('reservas_clases')
        .select('monto_total_pagado, fecha_pago')
        .eq('alumno_id', user.id)
        .gte('fecha_pago', startOfMonthStr);

      // Fetch Gastos Alquileres del mes
      const { data: alquileresData } = await supabase
        .from('alquileres_cancha')
        .select('monto_total, fecha_pago')
        .eq('usuario_id', user.id)
        .gte('fecha_pago', startOfMonthStr);

      let gTorneos = 0;
      let gClases = 0;
      let gAlquileres = 0;

      torneosData?.forEach(t => gTorneos += Number(t.monto_total_pagado));
      clasesData?.forEach(c => gClases += Number(c.monto_total_pagado));
      alquileresData?.forEach(a => gAlquileres += Number(a.monto_total));

      setGastos({
        torneos: gTorneos,
        clases: gClases,
        alquileres: gAlquileres,
        totalMes: gTorneos + gClases + gAlquileres
      });

      // Próximos Eventos
      const { data: torneosActivos } = await supabase
        .from('inscripciones_torneo')
        .select('id, modalidad, torneos(id, nombre_torneo, deporte, fase_actual)')
        .eq('usuario_id', user.id)
        .neq('torneos.fase_actual', 'Final')
        .limit(3);
        
      setMisTorneos(torneosActivos?.filter(t => t.torneos) || []);

      const today = new Date().toISOString().split('T')[0];
      const { data: proximasClases } = await supabase
        .from('reservas_clases')
        .select('id, clases_disponibles!inner(id, fecha, hora_inicio, deporte, perfiles_usuarios(nombre))')
        .eq('alumno_id', user.id)
        .gte('clases_disponibles.fecha', today)
        .order('clases_disponibles(fecha)', { ascending: true })
        .limit(3);

      setMisClases(proximasClases?.filter(c => c.clases_disponibles) || []);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={Brand.green} />
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.green} />}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <View>
          <Text style={styles.headerGreeting}>
            Hola, {user?.nombre || 'Jugador'} 👋
          </Text>
          <Text style={styles.headerTitle}>Mi Dashboard</Text>
        </View>
      </View>

      <View style={styles.content}>
        
        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => router.push('/(jugador)/torneos')}
          >
            <Ionicons name="trophy-outline" size={18} color={theme.text} />
            <Text style={[styles.actionBtnText, { color: theme.text }]}>Buscar Torneos</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtnPrimary, { backgroundColor: Brand.orange }]}
            onPress={() => router.push('/(jugador)/clases')}
          >
            <Ionicons name="calendar-outline" size={18} color="#fff" />
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>Buscar Clases</Text>
          </TouchableOpacity>
        </View>

        {/* Resumen del Mes */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Gastos del Mes</Text>
        
        <View style={[styles.totalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={styles.totalCardLabel}>Total del Mes</Text>
          <Text style={[styles.totalCardValue, { color: theme.text }]}>${gastos.totalMes.toLocaleString()}</Text>
          <View style={styles.totalCardBadge}>
            <Ionicons name="trending-up-outline" size={12} color={Brand.green} />
            <Text style={styles.totalCardBadgeText}>Mes Actual</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardLabel}>Torneos</Text>
              <Ionicons name="trophy-outline" size={16} color={Brand.orange} />
            </View>
            <Text style={[styles.statCardValue, { color: theme.text }]}>${gastos.torneos.toLocaleString()}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardLabel}>Clases</Text>
              <Ionicons name="school-outline" size={16} color={Brand.orange} />
            </View>
            <Text style={[styles.statCardValue, { color: theme.text }]}>${gastos.clases.toLocaleString()}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardLabel}>Alquileres</Text>
              <Ionicons name="keypad-outline" size={16} color={Brand.orange} />
            </View>
            <Text style={[styles.statCardValue, { color: theme.text }]}>${gastos.alquileres.toLocaleString()}</Text>
          </View>
        </View>

        {/* Mis Torneos */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="trophy-outline" size={20} color={Brand.orange} />
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Mis Torneos</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(jugador)/torneos')}>
            <Text style={{ color: Brand.orange, fontSize: 12, fontWeight: '700' }}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.listContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {misTorneos.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No estás inscripto en torneos activos.</Text>
          ) : (
            misTorneos.map((inscripcion, idx) => (
              <View key={inscripcion.id} style={[styles.listItem, idx > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, { color: theme.text }]}>{inscripcion.torneos?.nombre_torneo}</Text>
                  <Text style={[styles.itemSubtitle, { color: theme.textMuted }]}>{inscripcion.torneos?.deporte} • Modalidad {inscripcion.modalidad}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{inscripcion.torneos?.fase_actual}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.cuadroBtn}
                    onPress={() => {
                      setSelectedTorneo({ id: inscripcion.torneos.id, nombre: inscripcion.torneos.nombre_torneo });
                      setBracketVisible(true);
                    }}
                  >
                    <Ionicons name="play-circle-outline" size={14} color={Brand.orange} />
                    <Text style={styles.cuadroBtnText}>Cuadro</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Próximas Clases */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="calendar-outline" size={20} color={Brand.orange} />
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Próximas Clases</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(jugador)/clases')}>
            <Text style={{ color: Brand.orange, fontSize: 12, fontWeight: '700' }}>Ver agenda</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.listContainer, { backgroundColor: theme.card, borderColor: theme.border, marginBottom: Spacing.xxxl }]}>
          {misClases.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No tienes clases programadas.</Text>
          ) : (
            misClases.map((reserva, idx) => {
              const clase = reserva.clases_disponibles;
              const date = new Date(clase.fecha);
              return (
                <View key={reserva.id} style={[styles.listItem, idx > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                  <View style={[styles.dateBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <Text style={[styles.dateMonth, { color: theme.textMuted }]}>{date.toLocaleDateString('es-AR', { month: 'short' })}</Text>
                    <Text style={[styles.dateDay, { color: theme.text }]}>{date.getDate()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, { color: theme.text }]}>Clase de {clase.deporte}</Text>
                    <Text style={[styles.itemSubtitle, { color: theme.textMuted }]}>Prof. {clase.perfiles_usuarios?.nombre} • {clase.hora_inicio.substring(0,5)} hs</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

      </View>

      {/* Bracket Modal */}
      {selectedTorneo && (
        <BracketModal
          visible={bracketVisible}
          torneoId={selectedTorneo.id}
          torneoNombre={selectedTorneo.nombre}
          onClose={() => setBracketVisible(false)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: Spacing.xxxl + Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.base,
  },
  headerGreeting: { color: '#9ca3af', fontSize: 13, marginBottom: 2 },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  content: {
    padding: Spacing.base,
    gap: Spacing.lg,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: -Spacing.xl,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.lg,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: -8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: -8,
  },
  totalCard: {
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  totalCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalCardValue: {
    fontSize: 32,
    fontWeight: '900',
    marginVertical: 4,
  },
  totalCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Brand.green + '20',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  totalCardBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Brand.green,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '30%',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  listContainer: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 12,
  },
  badge: {
    backgroundColor: Brand.orange + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Brand.orange + '30',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Brand.orange,
    textTransform: 'uppercase',
  },
  cuadroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Brand.orange,
    backgroundColor: Brand.orange + '10',
  },
  cuadroBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: Brand.orange,
    textTransform: 'uppercase',
  },
  dateBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateMonth: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dateDay: {
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    padding: Spacing.xl,
  }
});
