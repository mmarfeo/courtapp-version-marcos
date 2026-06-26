import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  TextInput,
  ScrollView,
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
  categoria_torneo: string;
  club?: { nombre: string };
};

const ESTADO_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  Inscripcion: { label: 'Inscripción', color: '#fff', bg: Brand.green },
  Dieciseisavos: { label: 'Dieciseisavos', color: '#fff', bg: '#3b82f6' },
  Octavos: { label: 'Octavos', color: '#fff', bg: '#3b82f6' },
  Cuartos: { label: 'Cuartos', color: '#fff', bg: '#3b82f6' },
  Semifinal: { label: 'Semifinal', color: '#fff', bg: '#3b82f6' },
  Final: { label: 'Final', color: '#fff', bg: '#3b82f6' },
};

const DEPORTE_ICON: Record<string, string> = {
  tenis: '🎾',
  padel: '🏓',
  tenis_padel: '🎾',
};

const CATEGORIES = ['Todas', 'SuperA', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D'];

export default function TorneosJugadorScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [inscritosIds, setInscritosIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');

  const fetchTorneos = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('torneos')
        .select('id, nombre:nombre_torneo, deporte, estado:fase_actual, fecha_inicio, categoria_torneo, club:organizaciones(nombre)')
        .eq('activo', true)
        .order('fecha_inicio', { ascending: true });

      const { data: inscData, error: inscError } = await supabase
        .from('inscripciones_torneo')
        .select('torneo_id')
        .eq('usuario_id', user.id);

      if (!error && data) {
        setTorneos(data as any);
      } else if (error) {
        console.error(error);
      }

      if (!inscError && inscData) {
        setInscritosIds(inscData.map((i: any) => i.torneo_id));
      } else if (inscError) {
        console.error(inscError);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchTorneos(); }, [fetchTorneos]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTorneos();
  };

  // Filter tournaments locally
  const filteredTorneos = torneos.filter((torneo) => {
    // 0. Exclude if user is already enrolled
    if (inscritosIds.includes(torneo.id)) return false;

    // 1. Only show tournaments where registration is currently open
    // (Fase Inscripcion and start date is either not defined or in the future)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isRegistrationOpen =
      torneo.estado === 'Inscripcion' &&
      (!torneo.fecha_inicio || new Date(torneo.fecha_inicio + 'T00:00:00') >= today);

    if (!isRegistrationOpen) return false;

    // 2. Search filter (by tournament name or club name)
    const clubName = torneo.club?.nombre || '';
    const matchesSearch =
      torneo.nombre.toLowerCase().includes(search.toLowerCase()) ||
      clubName.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    // 3. Sport filter
    if (selectedSport && torneo.deporte.toLowerCase() !== selectedSport.toLowerCase()) {
      return false;
    }

    // 4. Category filter
    if (selectedCategory !== 'Todas' && torneo.categoria_torneo !== selectedCategory) {
      return false;
    }

    return true;
  });

  const renderTorneo = ({ item }: { item: Torneo }) => {
    const estado = ESTADO_BADGE[item.estado] || { label: item.estado, color: '#fff', bg: '#6b7280' };
    const icon = DEPORTE_ICON[item.deporte] || '🏅';
    const fechaInicio = item.fecha_inicio
      ? new Date(item.fecha_inicio).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
      : '--';

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, Shadow.sm]}
        onPress={() => router.push(`/(jugador)/torneo/${item.id}` as any)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.sportIcon}>{icon}</Text>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
              {item.nombre}
            </Text>
            <Text style={[styles.cardClub, { color: theme.textSecondary }]}>
              {item.club?.nombre || 'Club'} · {fechaInicio}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: estado.bg }]}>
            <Text style={[styles.badgeText, { color: estado.color }]}>{estado.label}</Text>
          </View>
        </View>
        <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
          <Text style={[styles.cardDeporte, { color: theme.textMuted }]}>
            {item.deporte?.charAt(0).toUpperCase() + item.deporte?.slice(1)} · Cat {item.categoria_torneo}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <View>
          <Text style={styles.headerGreeting}>
            Hola, {user?.nombre || 'Jugador'} 👋
          </Text>
          <Text style={styles.headerTitle}>Torneos vigentes</Text>
        </View>
      </View>

      {/* Search & Filters */}
      <View style={[styles.filtersSection, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        {/* Search Input */}
        <View style={[styles.searchBar, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={18} color={theme.textMuted} />
          <TextInput
            placeholder="Buscar por torneo, club..."
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
          <TouchableOpacity
            style={[
              styles.filterTab,
              selectedSport === null && { backgroundColor: Brand.green + '20', borderColor: Brand.green },
              { borderColor: theme.border }
            ]}
            onPress={() => setSelectedSport(null)}
          >
            <Text style={[styles.filterTabText, { color: selectedSport === null ? Brand.green : theme.textSecondary }]}>
              Todos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              selectedSport === 'tenis' && { backgroundColor: Brand.green + '20', borderColor: Brand.green },
              { borderColor: theme.border }
            ]}
            onPress={() => setSelectedSport('tenis')}
          >
            <Text style={[styles.filterTabText, { color: selectedSport === 'tenis' ? Brand.green : theme.textSecondary }]}>
              🎾 Tenis
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              selectedSport === 'padel' && { backgroundColor: Brand.green + '20', borderColor: Brand.green },
              { borderColor: theme.border }
            ]}
            onPress={() => setSelectedSport('padel')}
          >
            <Text style={[styles.filterTabText, { color: selectedSport === 'padel' ? Brand.green : theme.textSecondary }]}>
              🏓 Padel
            </Text>
          </TouchableOpacity>
        </View>

        {/* Categories horizontal filter */}
        <View style={{ marginTop: 4 }}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Categorías</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    isSelected
                      ? { backgroundColor: Brand.orange, borderColor: Brand.orange }
                      : { backgroundColor: theme.background, borderColor: theme.border },
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.categoryLabel, { color: isSelected ? '#fff' : theme.textSecondary }]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.green} />
        </View>
      ) : (
        <FlatList
          data={filteredTorneos}
          renderItem={renderTorneo}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.green} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏆</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No hay torneos disponibles en inscripción
              </Text>
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
    paddingTop: Spacing.xxxl + Spacing.xl,
    paddingBottom: Spacing.base,
    paddingHorizontal: Spacing.base,
  },
  headerGreeting: { color: '#9ca3af', fontSize: 13, marginBottom: 2 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  categoriesContainer: {
    gap: Spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  list: { padding: Spacing.base, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  card: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: Spacing.md },
  sportIcon: { fontSize: 24 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  cardClub: { fontSize: 12 },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  cardDeporte: { fontSize: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: Spacing.xxxl * 2, gap: Spacing.base },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 14, textAlign: 'center', maxWidth: 220 },
});
