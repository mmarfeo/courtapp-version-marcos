import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, StatusBar, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { Brand, Spacing, Radius, Shadow } from '@/constants/theme';

export default function ProfesorDashboardScreen() {
  const { user } = useAuth();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [monthOffset, setMonthOffset] = useState(0);

  const [metrics, setMetrics] = useState({
    totalEarnings: 0,
    occupancyPercentage: 0,
    activeStudents: 0,
    emptyClassesCount: 0,
    fixedClassesCount: 0,
    totalDebt: 0,
    weeklyDebt: [] as { weekNumber: number, amount: number, label: string }[],
    monthName: ''
  });

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() + monthOffset);
      
      const firstDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

      const startStr = firstDayOfMonth.toISOString().split('T')[0];
      const endStr = lastDayOfMonth.toISOString().split('T')[0];
      
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const monthName = monthNames[targetDate.getMonth()];

      // 1. Fetch Alquileres (Deuda)
      const { data: alquileresData } = await supabase
        .from('alquileres_cancha')
        .select('monto_total, fecha, hora_inicio, hora_fin, cancha:canchas(precio_profesor_hora_dia, precio_hora_dia, precio_profesor_hora_noche, precio_hora_noche)')
        .eq('usuario_id', user.id)
        .gte('fecha', startStr)
        .lte('fecha', endStr)
        .in('estado_pago', ['Pendiente', 'Aprobado']); 

      let debtTotal = 0;
      const weeks: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      if (alquileresData) {
        alquileresData.forEach(alquiler => {
          let amount = Number(alquiler.monto_total) || 0;
          
          // Recálculo en vuelo en caso de que monto_total sea 0 por error antiguo
          if (amount === 0 && alquiler.cancha) {
             const canchaInfo = alquiler.cancha as any;
             const precioProfDia = Number(canchaInfo.precio_profesor_hora_dia) || Number(canchaInfo.precio_hora_dia) || 0;
             const precioProfNoche = Number(canchaInfo.precio_profesor_hora_noche) || Number(canchaInfo.precio_hora_noche) || 0;
             
             const [hInicio, mInicio] = (alquiler.hora_inicio || '00:00').split(':').map(Number);
             const [hFin, mFin] = (alquiler.hora_fin || '00:00').split(':').map(Number);
             const startDecimal = hInicio + mInicio / 60;
             const endDecimal = hFin + mFin / 60;
             
             let horasDia = 0;
             let horasNoche = 0;
             const NIGHT_START = 18;

             if (startDecimal >= NIGHT_START) {
               horasNoche = endDecimal - startDecimal;
             } else if (endDecimal <= NIGHT_START) {
               horasDia = endDecimal - startDecimal;
             } else {
               horasDia = NIGHT_START - startDecimal;
               horasNoche = endDecimal - NIGHT_START;
             }
             amount = (horasDia * precioProfDia) + (horasNoche * precioProfNoche);
          }

          const [y, m, d] = alquiler.fecha.split('-').map(Number);
          const weekNumber = Math.ceil(d / 7);
          const boundedWeek = Math.min(Math.max(1, weekNumber), 5);
          weeks[boundedWeek] += amount;
          debtTotal += amount;
        });
      }

      // 2. Fetch Clases Disponibles (para calcular Ganancias, Ocupación y Deuda Implícita de Cancha)
      const { data: clasesData } = await supabase
        .from('clases_disponibles')
        .select(`
          id,
          fecha,
          hora_inicio,
          hora_fin,
          cupo_maximo,
          precio_clase,
          cancha:canchas(precio_profesor_hora_dia, precio_hora_dia, precio_profesor_hora_noche, precio_hora_noche),
          reservas_clases (id, estado_pago)
        `)
        .eq('profesor_id', user.id)
        .gte('fecha', startStr)
        .lte('fecha', endStr);

      if (clasesData) {
        clasesData.forEach(clase => {
          // --- Calcular deuda implícita de la cancha por esta clase ---
          const canchaInfo = clase.cancha as any;
          if (canchaInfo) {
            const precioProfDia = Number(canchaInfo.precio_profesor_hora_dia) || Number(canchaInfo.precio_hora_dia) || 0;
            const precioProfNoche = Number(canchaInfo.precio_profesor_hora_noche) || Number(canchaInfo.precio_hora_noche) || 0;
            
            const [hInicio, mInicio] = (clase.hora_inicio || '00:00').split(':').map(Number);
            const [hFin, mFin] = (clase.hora_fin || '00:00').split(':').map(Number);
            const startDecimal = hInicio + mInicio / 60;
            const endDecimal = hFin + mFin / 60;
            
            let horasDia = 0;
            let horasNoche = 0;
            const NIGHT_START = 18;

            if (startDecimal >= NIGHT_START) {
              horasNoche = endDecimal - startDecimal;
            } else if (endDecimal <= NIGHT_START) {
              horasDia = endDecimal - startDecimal;
            } else {
              horasDia = NIGHT_START - startDecimal;
              horasNoche = endDecimal - NIGHT_START;
            }

            const montoCancha = (horasDia * precioProfDia) + (horasNoche * precioProfNoche);
            
            if (montoCancha > 0 && clase.fecha) {
              const [y, m, d] = clase.fecha.split('-').map(Number);
              const weekNumber = Math.ceil(d / 7);
              const boundedWeek = Math.min(Math.max(1, weekNumber), 5);
              weeks[boundedWeek] += montoCancha;
              debtTotal += montoCancha;
            }
          }
        });
      }

      const formattedWeeks = Object.keys(weeks)
        .map(w => parseInt(w))
        .filter(weekNum => {
           if (weekNum === 5 && lastDayOfMonth.getDate() <= 28) return false;
           return true;
        })
        .map(weekNum => {
          const isLastWeek = weekNum === 5 || (weekNum === 4 && lastDayOfMonth.getDate() === 28);
          const startDay = (weekNum - 1) * 7 + 1;
          const endDay = isLastWeek ? lastDayOfMonth.getDate() : weekNum * 7;
          return {
            weekNumber: weekNum,
            label: `Semana ${weekNum} (Días ${startDay} al ${endDay})`,
            amount: weeks[weekNum]
          };
        }).sort((a, b) => a.weekNumber - b.weekNumber);

      // 2. Fetch Clases Disponibles (ya se trajo arriba, así que usamos la misma variable clasesData)

      let totalEarnings = 0;
      let totalOccupancyCount = 0;
      let totalMaxCapacity = 0;
      let activeStudents = 0;
      let emptyClassesCount = 0;
      let fixedClassesCount = 0;

      if (clasesData) {
        fixedClassesCount = clasesData.length;
        clasesData.forEach(clase => {
          totalMaxCapacity += clase.cupo_maximo || 0;
          const validBookings = clase.reservas_clases?.filter((r: any) => r.estado_pago !== 'Rechazado' && r.estado_pago !== 'Reembolsado') || [];
          const bookingCount = validBookings.length;
          
          if (bookingCount === 0) emptyClassesCount++;
          
          activeStudents += bookingCount;
          totalOccupancyCount += bookingCount;
          totalEarnings += bookingCount * (clase.precio_clase || 0);
        });
      }

      const occupancyPercentage = totalMaxCapacity > 0 ? Math.round((totalOccupancyCount / totalMaxCapacity) * 100) : 0;

      setMetrics({
        totalEarnings,
        occupancyPercentage,
        activeStudents,
        emptyClassesCount,
        fixedClassesCount,
        totalDebt: debtTotal,
        weeklyDebt: formattedWeeks,
        monthName
      });

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, monthOffset]);

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
        <ActivityIndicator size="large" color={Brand.orange} />
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.orange} />}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <View>
          <Text style={styles.headerGreeting}>
            Hola, {user?.nombre || 'Profesor'} 👋
          </Text>
          <Text style={styles.headerTitle}>Mi Dashboard</Text>
          <Text style={{color: '#9ca3af', fontSize: 13, marginTop: 4}}>Métricas de {metrics.monthName}</Text>
        </View>
      </View>

      <View style={styles.content}>
        
        {/* KPIs Row 1 */}
        <View style={styles.row}>
          <View style={[styles.smallCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.iconCircleSmall, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
              <Ionicons name="trending-up" size={18} color="#22c55e" />
            </View>
            <Text style={[styles.smallCardValue, { color: theme.text }]}>
              ${metrics.totalEarnings.toLocaleString('es-AR')}
            </Text>
            <Text style={[styles.smallCardLabel, { color: theme.textSecondary }]}>Ganancias</Text>
          </View>

          <View style={[styles.smallCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.iconCircleSmall, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
              <Ionicons name="people" size={18} color="#3b82f6" />
            </View>
            <Text style={[styles.smallCardValue, { color: theme.text }]}>
              {metrics.activeStudents}
            </Text>
            <Text style={[styles.smallCardLabel, { color: theme.textSecondary }]}>Alumnos Activos</Text>
          </View>
        </View>

        {/* KPIs Row 2 */}
        <View style={styles.row}>
          <View style={[styles.smallCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.iconCircleSmall, { backgroundColor: 'rgba(168, 85, 247, 0.1)' }]}>
              <Ionicons name="pie-chart" size={18} color="#a855f7" />
            </View>
            <Text style={[styles.smallCardValue, { color: theme.text }]}>
              {metrics.occupancyPercentage}%
            </Text>
            <Text style={[styles.smallCardLabel, { color: theme.textSecondary }]}>Ocupación</Text>
          </View>

          <View style={[styles.smallCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.iconCircleSmall, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
              <Ionicons name="alert-circle" size={18} color="#ef4444" />
            </View>
            <Text style={[styles.smallCardValue, { color: '#ef4444' }]}>
              {metrics.emptyClassesCount}
            </Text>
            <Text style={[styles.smallCardLabel, { color: theme.textSecondary }]}>Clases Vacías</Text>
          </View>
        </View>

        {/* Clases Fijas */}
        <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View>
            <Text style={[styles.infoCardTitle, { color: theme.text }]}>Clases Programadas</Text>
            <Text style={[styles.infoCardSub, { color: theme.textSecondary }]}>Total de clases fijas en {metrics.monthName}</Text>
          </View>
          <View style={[styles.infoCardBadge, { backgroundColor: theme.background }]}>
            <Text style={[styles.infoCardBadgeText, { color: theme.text }]}>{metrics.fixedClassesCount}</Text>
          </View>
        </View>

        {/* Deuda Total Card (Month Navigation) */}
        <View style={[styles.card, { backgroundColor: Brand.orange, marginTop: Spacing.sm }, Shadow.md]}>
          <View style={[styles.cardHeaderRow, { justifyContent: 'space-between', alignItems: 'center' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.iconCircle}>
                <Ionicons name="cash-outline" size={24} color={Brand.orange} />
              </View>
              <Text style={styles.cardTitleWhite}>Deuda Canchas</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <TouchableOpacity onPress={() => setMonthOffset(prev => prev - 1)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16, textTransform: 'capitalize' }}>{metrics.monthName}</Text>
              <TouchableOpacity onPress={() => setMonthOffset(prev => prev + 1)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Ionicons name="chevron-forward" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.amountWhite}>
            ${metrics.totalDebt.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>

        {/* Desglose Semanal */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Desglose Deuda por Semana</Text>
        
        {metrics.weeklyDebt.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="checkmark-circle-outline" size={40} color={Brand.green} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No tienes deudas registradas.</Text>
          </View>
        ) : (
          metrics.weeklyDebt.map((week, index) => (
            <View key={index} style={[styles.weekCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.weekLeft}>
                <Ionicons name="calendar-outline" size={20} color={Brand.orange} />
                <Text style={[styles.weekLabel, { color: theme.text }]}>{week.label}</Text>
              </View>
              <Text style={[styles.weekAmount, { color: theme.text }]}>
                ${week.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ))
        )}

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: Spacing.xxxl + Spacing.md,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  headerGreeting: { color: '#a3a3a3', fontSize: 16, fontWeight: '500', marginBottom: 4 },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },
  content: { padding: Spacing.base, gap: Spacing.md, paddingBottom: 100 },
  
  row: { flexDirection: 'row', gap: Spacing.sm },
  smallCard: { flex: 1, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  iconCircleSmall: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  smallCardValue: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  smallCardLabel: { fontSize: 12, fontWeight: '500' },

  infoCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  infoCardTitle: { fontSize: 15, fontWeight: '700' },
  infoCardSub: { fontSize: 12, marginTop: 2 },
  infoCardBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.md },
  infoCardBadgeText: { fontSize: 18, fontWeight: '800' },

  card: { borderRadius: Radius.xl, padding: Spacing.xl, marginBottom: Spacing.xs },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  cardTitleWhite: { color: '#fff', fontSize: 16, fontWeight: '600', opacity: 0.9 },
  amountWhite: { color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginTop: Spacing.sm, marginBottom: Spacing.xs },
  emptyCard: { padding: Spacing.xl, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  emptyText: { fontSize: 15, fontWeight: '500' },
  weekCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base, borderRadius: Radius.lg, borderWidth: 1, marginBottom: Spacing.sm },
  weekLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  weekLabel: { fontSize: 15, fontWeight: '600' },
  weekAmount: { fontSize: 16, fontWeight: '700' },
});
