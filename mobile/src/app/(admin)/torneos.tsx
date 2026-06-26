import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { Brand, Spacing, Radius, Shadow } from '@/constants/theme';

type Torneo = {
  id: string;
  nombre: string;
  deporte: string;
  estado: string;
  fecha_inicio: string;
  club?: { nombre: string };
};

const ESTADOS: Record<string, { label: string; color: string }> = {
  borrador: { label: 'Borrador', color: '#6b7280' },
  inscripcion_abierta: { label: 'Inscripción', color: Brand.green },
  en_curso: { label: 'En Curso', color: '#3b82f6' },
  finalizado: { label: 'Finalizado', color: '#f59e0b' },
};

export default function AdminTorneosScreen() {
  const theme = useTheme();
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTorneos = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('torneos')
        .select('id, nombre:nombre_torneo, deporte, estado, fecha_inicio, club:organizaciones(nombre)')
        .order('creado_at', { ascending: false })
        .limit(50);
      if (data) setTorneos(data as any);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchTorneos(); }, [fetchTorneos]);

  const renderTorneo = ({ item }: { item: Torneo }) => {
    const estado = ESTADOS[item.estado] || { label: item.estado, color: '#6b7280' };
    return (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, Shadow.sm]}>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>{item.nombre}</Text>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            {(item.club as any)?.nombre || 'Club'} · {item.deporte}
          </Text>
        </View>
        <View style={[styles.estadoBadge, { backgroundColor: estado.color + '20', borderColor: estado.color }]}>
          <Text style={[styles.estadoText, { color: estado.color }]}>{estado.label}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <Text style={styles.headerTitle}>Todos los Torneos</Text>
        <Text style={[styles.headerSub, { color: '#9ca3af' }]}>{torneos.length} torneos</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.green} />
        </View>
      ) : (
        <FlatList
          data={torneos}
          renderItem={renderTorneo}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTorneos(); }} tintColor={Brand.green} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏆</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No hay torneos</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: Spacing.xxxl + Spacing.xl, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.xl },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },
  headerSub: { fontSize: 14, marginTop: 2 },
  list: { padding: Spacing.base, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.base,
    gap: Spacing.md,
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  cardSub: { fontSize: 12 },
  estadoBadge: { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  estadoText: { fontSize: 11, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: Spacing.xxxl, gap: Spacing.base },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15 },
});
