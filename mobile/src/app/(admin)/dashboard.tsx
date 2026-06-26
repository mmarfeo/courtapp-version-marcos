import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { Brand, Spacing, Radius, Shadow } from '@/constants/theme';

type Stats = {
  totalClubes: number;
  totalUsuarios: number;
  totalTorneos: number;
  torneosEnCurso: number;
  totalInscripciones: number;
};

export default function AdminDashboardScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const [clubesRes, usuariosRes, torneosRes, inscrRes] = await Promise.all([
        supabase.from('organizaciones').select('id', { count: 'exact', head: true }),
        supabase.from('perfiles_usuarios').select('id', { count: 'exact', head: true }),
        supabase.from('torneos').select('id, estado:fase_actual'),
        supabase.from('inscripciones_torneo').select('id', { count: 'exact', head: true }),
      ]);

      const torneos = torneosRes.data || [];
      setStats({
        totalClubes: clubesRes.count || 0,
        totalUsuarios: usuariosRes.count || 0,
        totalTorneos: torneos.length,
        torneosEnCurso: torneos.filter((t) => t.estado === 'en_curso').length,
        totalInscripciones: inscrRes.count || 0,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const metrics = stats
    ? [
        { label: 'Clubes', value: stats.totalClubes, icon: 'business-outline', color: '#6366f1' },
        { label: 'Usuarios', value: stats.totalUsuarios, icon: 'people-outline', color: '#3b82f6' },
        { label: 'Torneos', value: stats.totalTorneos, icon: 'trophy-outline', color: Brand.green },
        { label: 'En Curso', value: stats.torneosEnCurso, icon: 'play-circle-outline', color: '#10b981' },
        { label: 'Inscripciones', value: stats.totalInscripciones, icon: 'person-add-outline', color: '#f59e0b' },
      ]
    : [];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <View>
          <Text style={styles.headerGreeting}>SuperAdmin 👑</Text>
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.green} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStats(); }} tintColor={Brand.green} />
          }
        >
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>MÉTRICAS GLOBALES</Text>

          <View style={styles.grid}>
            {metrics.map((m, i) => (
              <View
                key={i}
                style={[styles.metricCard, { backgroundColor: theme.card, borderColor: theme.border }, Shadow.md]}
              >
                <View style={[styles.metricIcon, { backgroundColor: m.color + '20' }]}>
                  <Ionicons name={m.icon as any} size={22} color={m.color} />
                </View>
                <Text style={[styles.metricValue, { color: theme.text }]}>{m.value}</Text>
                <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>{m.label}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.infoTitle, { color: theme.text }]}>👤 Sesión activa</Text>
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              {user?.nombre} {user?.apellido}
            </Text>
            <Text style={[styles.infoText, { color: theme.textMuted }]}>{user?.email}</Text>
            <View style={[styles.rolTag, { backgroundColor: Brand.green + '20' }]}>
              <Text style={[styles.rolTagText, { color: Brand.green }]}>
                {user?.role === 'superadmin' ? 'Super Admin' : 'Admin'}
              </Text>
            </View>
          </View>
        </ScrollView>
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
  logoutBtn: { padding: Spacing.sm },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl, gap: Spacing.xl },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  metricCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.base,
    alignItems: 'center',
    gap: Spacing.xs,
    width: '47%',
  },
  metricIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  metricLabel: { fontSize: 12, fontWeight: '600' },
  infoCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.xs,
  },
  infoTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.xs },
  infoText: { fontSize: 14 },
  rolTag: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.sm,
  },
  rolTagText: { fontSize: 12, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
