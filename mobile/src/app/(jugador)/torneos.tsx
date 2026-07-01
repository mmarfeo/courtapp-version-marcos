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
  useColorScheme,
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

const getBaseTournamentName = (name: string) => {
  if (!name) return '';
  const regex = /\s*-\s*Cat\s+|\s*-\s*Categor[ií]a\s+|\s+Cat\s+|\s*-\s*/i;
  const parts = name.split(regex);
  return parts[0].trim();
};

export default function TorneosJugadorScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
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

  const groupedTorneos = React.useMemo(() => {
    const groups: Record<string, {
      baseName: string;
      deporte: string;
      fecha_inicio: string;
      club?: { nombre: string };
      categorias: { id: string; categoria: string; estado: string }[];
    }> = {};

    filteredTorneos.forEach(torneo => {
      const baseName = getBaseTournamentName(torneo.nombre);
      const key = `${baseName}_${torneo.deporte}_${torneo.club?.nombre || ''}`;

      if (!groups[key]) {
        groups[key] = {
          baseName,
          deporte: torneo.deporte,
          fecha_inicio: torneo.fecha_inicio,
          club: torneo.club,
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
    const icon = DEPORTE_ICON[item.deporte] || '🏅';
    const fechaInicio = item.fecha_inicio
      ? new Date(item.fecha_inicio).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
      : '--';

    return (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, Shadow.sm]}>
        <View style={styles.cardHeader}>
          <Text style={styles.sportIcon}>{icon}</Text>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
              {item.baseName}
            </Text>
            <Text style={[styles.cardClub, { color: theme.textSecondary }]}>
              {item.club?.nombre || 'Club'} · {fechaInicio}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: Spacing.base, paddingBottom: Spacing.base }}>
          {item.categorias.map((cat: any) => (
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
              onPress={() => router.push(`/(jugador)/torneo/${cat.id}` as any)}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: Brand.orange }}>
                Cat {cat.categoria}
              </Text>
              <Ionicons name="add-circle-outline" size={14} color={Brand.orange} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
          <Text style={[styles.cardDeporte, { color: theme.textMuted }]}>
            {item.deporte?.charAt(0).toUpperCase() + item.deporte?.slice(1)}
          </Text>
          <Text style={{ fontSize: 12, color: theme.textMuted }}>
            Selecciona una categoría para inscribirte
          </Text>
        </View>
      </View>
    );
  };

  const isDark = scheme === 'dark';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.headerGreeting, { color: theme.textSecondary }]}>
            Hola, {user?.nombre || 'Jugador'} 👋
          </Text>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Torneos vigentes</Text>
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
          data={groupedTorneos}
          renderItem={renderGroupedTorneo}
          keyExtractor={(item) => item.baseName + '_' + item.deporte + '_' + (item.club?.nombre || '')}
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
      {/* Floating Chat Bubble */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: Brand.orange,
          justifyContent: 'center',
          alignItems: 'center',
          elevation: 5,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          zIndex: 9999,
        }}
        onPress={() => router.push('/(jugador)/chat')}
        activeOpacity={0.8}
      >
        <Ionicons name="chatbubbles" size={24} color="#fff" />
      </TouchableOpacity>
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
