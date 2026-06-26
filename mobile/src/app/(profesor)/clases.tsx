import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { Brand, Spacing, Radius, Shadow } from '@/constants/theme';

type ClaseDisponible = {
  id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  deporte: string;
  categoria_target: string;
  cupo_maximo: number;
  precio_clase: number;
  es_semanal: boolean;
  cancha?: { nombre: string };
};

export default function ClasesScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [clases, setClases] = useState<ClaseDisponible[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState<'Todas' | 'Próximas' | 'Pasadas'>('Próximas');
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const fetchClases = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('clases_disponibles')
        .select(`
          id, fecha, hora_inicio, hora_fin, deporte, categoria_target, cupo_maximo, precio_clase, es_semanal,
          cancha:canchas(nombre_club, numero_cancha)
        `)
        .eq('profesor_id', user.id)
        .order('fecha', { ascending: false })
        .order('hora_inicio', { ascending: false });
      
      if (data) setClases(data as any);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Refetch when returning to the tab
  useFocusEffect(
    useCallback(() => {
      fetchClases();
    }, [fetchClases])
  );

  const deleteClase = (id: number) => {
    Alert.alert('Eliminar clase', '¿Estás seguro de que quieres cancelar esta clase?', [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('clases_disponibles').delete().eq('id', id);
          if (error) {
            Alert.alert('Error', 'No se pudo eliminar la clase');
          } else {
            fetchClases();
          }
        },
      },
    ]);
  };

  const renderClase = ({ item }: { item: ClaseDisponible }) => {
    return (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, Shadow.sm]}>
        <View style={styles.cardLeft}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            {item.deporte?.charAt(0).toUpperCase() + item.deporte?.slice(1)} — {item.categoria_target}
            {item.es_semanal && <Text style={{color: Brand.green}}> (Fija)</Text>}
          </Text>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            📅 {item.fecha} • {item.hora_inicio?.slice(0, 5)} a {item.hora_fin?.slice(0, 5)}
          </Text>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            📍 {((item.cancha as any)?.nombre_club ? `${(item.cancha as any)?.nombre_club} (C${(item.cancha as any)?.numero_cancha})` : 'Sin cancha')} • 👥 {item.cupo_maximo} cupos • ${item.precio_clase}
          </Text>
        </View>
        <TouchableOpacity onPress={() => deleteClase(item.id)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <Text style={styles.headerTitle}>Historial de Clases</Text>
        <View style={styles.filterRow}>
          {['Todas', 'Próximas', 'Pasadas'].map((f) => (
            <TouchableOpacity 
              key={f}
              style={[styles.filterChip, filtro === f && { backgroundColor: Brand.green, borderColor: Brand.green }]}
              onPress={() => setFiltro(f as any)}
            >
              <Text style={[styles.filterText, filtro === f && { color: '#fff' }]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date Filter */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, gap: Spacing.sm }}>
          <TouchableOpacity 
            style={[styles.dateFilterBtn, dateFilter && { backgroundColor: Brand.green, borderColor: Brand.green }]} 
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={16} color={dateFilter ? '#fff' : theme.textMuted} />
            <Text style={[styles.filterText, dateFilter && { color: '#fff' }]}>
              {dateFilter ? dateFilter.toLocaleDateString() : 'Filtrar por Fecha'}
            </Text>
          </TouchableOpacity>
          
          {dateFilter && (
            <TouchableOpacity onPress={() => setDateFilter(null)} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          )}

          {showDatePicker && (
            <DateTimePicker
              value={dateFilter || new Date()}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (event.type === 'set' && selectedDate) {
                  setDateFilter(selectedDate);
                }
              }}
            />
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.green} />
        </View>
      ) : (
        <FlatList
          data={clases.filter(c => {
            // Apply Date Filter if selected
            if (dateFilter) {
              const fY = dateFilter.getFullYear();
              const fM = String(dateFilter.getMonth() + 1).padStart(2, '0');
              const fD = String(dateFilter.getDate()).padStart(2, '0');
              const filterDateStr = `${fY}-${fM}-${fD}`;
              if (c.fecha !== filterDateStr) return false;
            }

            if (filtro === 'Todas') return true;
            
            const now = new Date();
            const localY = now.getFullYear();
            const localM = String(now.getMonth() + 1).padStart(2, '0');
            const localD = String(now.getDate()).padStart(2, '0');
            const localHoyStr = `${localY}-${localM}-${localD}`;
            
            let isPast = false;
            if (c.fecha < localHoyStr) {
               isPast = true;
            } else if (c.fecha === localHoyStr) {
               const [h, m] = c.hora_inicio.split(':').map(Number);
               if (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes())) {
                 isPast = true;
               }
            }
            
            if (filtro === 'Próximas') return !isPast;
            if (filtro === 'Pasadas') return isPast;
            return true;
          })}
          renderItem={renderClase}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchClases(); }} tintColor={Brand.green} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📚</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No creaste clases aún</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: Brand.green }]}
        onPress={() => router.push('/(profesor)/nueva')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: Spacing.xxxl + Spacing.xl, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.xl },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: Spacing.md },
  filterRow: { flexDirection: 'row', gap: Spacing.sm },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#333', backgroundColor: '#1a1a1a' },
  filterText: { color: '#9ca3af', fontSize: 14, fontWeight: '600' },
  dateFilterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#333', backgroundColor: '#1a1a1a', alignSelf: 'flex-start' },
  list: { padding: Spacing.base, paddingBottom: 100, gap: Spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.base,
    gap: Spacing.base,
  },
  cardLeft: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 13 },
  deleteBtn: { padding: Spacing.xs },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: Spacing.xxxl, gap: Spacing.base },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15 },
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Brand.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
});
