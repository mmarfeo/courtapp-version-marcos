import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { Brand, Spacing, Radius, Shadow } from '@/constants/theme';

type Torneo = {
  id: string;
  nombre: string;
  deporte: string;
  estado: string;
  fecha_inicio: string;
  max_parejas: number;
  _count?: { inscripciones: number };
};

const ESTADOS: Record<string, { label: string; color: string }> = {
  Inscripcion: { label: 'Inscripción', color: Brand.green },
  Dieciseisavos: { label: 'Dieciseisavos', color: '#3b82f6' },
  Octavos: { label: 'Octavos', color: '#3b82f6' },
  Cuartos: { label: 'Cuartos', color: '#3b82f6' },
  Semifinal: { label: 'Semifinal', color: '#3b82f6' },
  Final: { label: 'Final', color: '#f59e0b' },
};

const getBaseTournamentName = (name: string) => {
  if (!name) return '';
  const regex = /\s*-\s*Cat\s+|\s*-\s*Categor[ií]a\s+|\s+Cat\s+|\s*-\s*/i;
  const parts = name.split(regex);
  return parts[0].trim();
};

export default function OrganizadorTorneosScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [torneos, setTorneos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [selectedSport, setSelectedSport] = useState<string | null>(null);

  const fetchTorneos = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('torneos')
        .select('id, nombre:nombre_torneo, deporte, estado:fase_actual, fecha_inicio, categoria_torneo')
        .eq('organizacion_id', user.club_id)
        .order('creado_at', { ascending: false });
      
      if (error) {
        console.error("Error fetching torneos:", error);
      }
      
      if (data) setTorneos(data as any);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchTorneos(); }, [fetchTorneos]);

  // Filter tournaments locally
  const filteredTorneos = torneos.filter((torneo) => {
    const matchesSearch = torneo.nombre.toLowerCase().includes(search.toLowerCase());
    const matchesSport = selectedSport
      ? torneo.deporte.toLowerCase() === selectedSport.toLowerCase()
      : true;
    return matchesSearch && matchesSport;
  });

  const groupedTorneos = React.useMemo(() => {
    const groups: Record<string, {
      baseName: string;
      deporte: string;
      fecha_inicio: string;
      categorias: { id: string; categoria: string; estado: string }[];
    }> = {};

    filteredTorneos.forEach(torneo => {
      const baseName = getBaseTournamentName(torneo.nombre);
      const key = `${baseName}_${torneo.deporte}`;

      if (!groups[key]) {
        groups[key] = {
          baseName,
          deporte: torneo.deporte,
          fecha_inicio: torneo.fecha_inicio,
          categorias: []
        };
      }

      groups[key].categorias.push({
        id: torneo.id,
        categoria: torneo.categoria_torneo,
        estado: torneo.estado
      });
    });

    const result = Object.values(groups);
    result.forEach(g => {
      g.categorias.sort((a, b) => a.categoria.localeCompare(b.categoria));
    });
    return result;
  }, [filteredTorneos]);

  const renderGroupedTorneo = ({ item }: { item: any }) => {
    return (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, Shadow.sm]}>
        <View style={styles.cardTop}>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
              {item.baseName}
            </Text>
            <Text style={[styles.cardDeporte, { color: theme.textSecondary }]}>
              {item.deporte?.charAt(0).toUpperCase() + item.deporte?.slice(1)} ·{' '}
              {item.fecha_inicio
                ? new Date(item.fecha_inicio).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
                : '--'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: Spacing.base, paddingBottom: Spacing.base }}>
          {item.categorias.map((cat: any) => {
            const estado = ESTADOS[cat.estado] || { label: cat.estado, color: '#6b7280' };
            return (
              <TouchableOpacity
                key={cat.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: Brand.orange + '10',
                  borderColor: Brand.orange,
                  borderWidth: 1,
                  borderRadius: Radius.full,
                  paddingHorizontal: Spacing.md,
                  paddingVertical: 6,
                  gap: 4
                }}
                onPress={() => router.push(`/(organizador)/torneo/${cat.id}` as any)}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: Brand.orange }}>
                  Cat {cat.categoria} ({estado.label})
                </Text>
                <Ionicons name="chevron-forward" size={12} color={Brand.orange} />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            Selecciona una categoría para ver detalles y gestionar
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <View>
          <Text style={styles.headerGreeting}>Hola, {user?.nombre || 'Organizador'} 👋</Text>
          <Text style={styles.headerTitle}>Mis Torneos</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/(organizador)/nuevo-torneo' as any)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search & Filters */}
      <View style={[styles.filtersSection, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={18} color={theme.textMuted} />
          <TextInput
            placeholder="Buscar torneo..."
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Sports filter tabs */}
        <View style={styles.quickFilters}>
          {(['Todos', 'Tenis', 'Padel'] as const).map(sport => {
            const isSel = sport === 'Todos' ? selectedSport === null : selectedSport === sport;
            return (
              <TouchableOpacity
                key={sport}
                style={[
                  styles.filterTab,
                  isSel && { backgroundColor: Brand.orange + '20', borderColor: Brand.orange },
                  { borderColor: theme.border }
                ]}
                onPress={() => setSelectedSport(sport === 'Todos' ? null : sport)}
              >
                <Text style={[styles.filterTabText, { color: isSel ? Brand.orange : theme.textSecondary }]}>
                  {sport === 'Tenis' ? '🎾 Tenis' : sport === 'Padel' ? '🏓 Pádel' : 'Todos'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.green} />
        </View>
      ) : (
        <FlatList
          data={groupedTorneos}
          renderItem={renderGroupedTorneo}
          keyExtractor={(item) => item.baseName + '_' + item.deporte}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTorneos(); }} tintColor={Brand.green} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏆</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {search || selectedSport ? 'No se encontraron torneos' : 'No tenés torneos creados aún'}
              </Text>
              {!search && !selectedSport && (
                <TouchableOpacity
                  style={[styles.createBtn, { backgroundColor: Brand.green }]}
                  onPress={() => router.push('/(organizador)/nuevo-torneo' as any)}
                >
                  <Text style={styles.createBtnText}>Crear primer torneo</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.xxxl + Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  headerGreeting: { color: '#9ca3af', fontSize: 14, marginBottom: 2 },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  headerBtn: {
    padding: Spacing.sm,
    backgroundColor: Brand.orange,
    borderRadius: Radius.full,
  },
  filtersSection: {
    padding: Spacing.base,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 40,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  quickFilters: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  filterTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  altaStaffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  altaStaffText: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 12,
  },
  logoutBtn: { padding: Spacing.sm },
  list: { padding: Spacing.base, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  card: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: Spacing.md },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  cardDeporte: { fontSize: 13 },
  estadoBadge: { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  estadoText: { fontSize: 11, fontWeight: '700' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  footerText: { fontSize: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: Spacing.xxxl, gap: Spacing.base },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16 },
  createBtn: { borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: 12, marginTop: Spacing.sm },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
