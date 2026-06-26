import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { Brand, Spacing, Radius, Shadow } from '@/constants/theme';

export default function StaffScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStaff = useCallback(async () => {
    if (!user?.club_id) return;
    try {
      const { data, error } = await supabase
        .from('miembros_organizacion')
        .select('usuario_id, organizacion_id, usuario:perfiles_usuarios(id, nombre, email, rol, roles)')
        .eq('organizacion_id', user.club_id);
        
      if (error) throw error;
      
      if (data) {
        // Filter out SuperAdmin
        const filtered = data.filter(m => {
           const u = Array.isArray(m.usuario) ? m.usuario[0] : m.usuario;
           if (!u) return false;
           return u.rol !== 'SuperAdmin' && (!u.roles || !u.roles.includes('SuperAdmin'));
        });

        // Fetch extra stats in bulk
        const teacherIds = filtered.map(f => f.usuario_id);
        
        const { data: canchas } = await supabase.from('canchas').select('id').eq('organizacion_id', user.club_id);
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

        setStaff(enriched);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const renderMember = ({ item }: { item: any }) => {
    const u = Array.isArray(item.usuario) ? item.usuario[0] : item.usuario;
    if (!u) return null;
    
    // Determine visual roles
    let displayRoles = u.roles && u.roles.length > 0 ? u.roles.filter((r:string) => r !== 'Jugador').join(', ') : (u.rol || 'Staff');
    
    return (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, Shadow.sm]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{u.nombre?.charAt(0)?.toUpperCase() || 'S'}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>{u.nombre || 'Sin nombre'}</Text>
          <Text style={[styles.cardEmail, { color: theme.textSecondary }]} numberOfLines={1}>{u.email}</Text>
          <View style={styles.roleContainer}>
            <View style={[styles.roleBadge, { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
              <Text style={[styles.roleText, { color: Brand.green }]}>{displayRoles}</Text>
            </View>
          </View>
          {(u.deuda > 0 || u.reservasSemana > 0) && (
            <View style={styles.statsContainer}>
              {u.reservasSemana > 0 && (
                <View style={styles.statItem}>
                  <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                  <Text style={[styles.statText, { color: theme.textSecondary }]}>{u.reservasSemana} hs/sem</Text>
                </View>
              )}
              {u.deuda > 0 && (
                <View style={styles.statItem}>
                  <Ionicons name="alert-circle-outline" size={14} color={Brand.orange} />
                  <Text style={[styles.statText, { color: Brand.orange, fontWeight: '700' }]}>Deuda: ${u.deuda}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }}>
          <View>
            <Text style={styles.headerTitle}>Staff del Club</Text>
            <Text style={styles.headerSubtitle}>Tus profesores y administradores</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[styles.altaBtn, { borderColor: theme.border, flex: 1, justifyContent: 'center' }]}
            onPress={() => router.push('/(organizador)/deudas' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="cash-outline" size={16} color={Brand.orange} />
            <Text style={[styles.altaBtnText, { color: Brand.orange }]}>Deudas</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.altaBtn, { borderColor: theme.border, flex: 1, justifyContent: 'center' }]}
            onPress={() => router.push('/(organizador)/nuevo-staff' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="person-add-outline" size={16} color={Brand.green} />
            <Text style={styles.altaBtnText}>Nuevo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.green} />
        </View>
      ) : (
        <FlatList
          data={staff}
          renderItem={renderMember}
          keyExtractor={(item, index) => item.usuario_id || index.toString()}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStaff(); }} tintColor={Brand.green} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No hay profesores ni staff registrados en el club
              </Text>
              <TouchableOpacity
                style={[styles.createBtn, { backgroundColor: Brand.green }]}
                onPress={() => router.push('/(organizador)/nuevo-staff' as any)}
              >
                <Text style={styles.createBtnText}>Agregar Profesor</Text>
              </TouchableOpacity>
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
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { color: '#9ca3af', fontSize: 14, marginTop: 2 },
  altaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  altaBtnText: { color: '#10b981', fontWeight: '700', fontSize: 13 },
  list: { padding: Spacing.base, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  card: { 
    borderRadius: Radius.lg, 
    borderWidth: 1, 
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#10b981',
    fontSize: 20,
    fontWeight: '800'
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  cardEmail: { fontSize: 13, marginBottom: 8 },
  roleContainer: { flexDirection: 'row' },
  roleBadge: {
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.md,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  statsContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    flexWrap: 'wrap'
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  statText: {
    fontSize: 12,
    fontWeight: '600'
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: Spacing.xxxl, gap: Spacing.base },
  emptyText: { fontSize: 15, textAlign: 'center', paddingHorizontal: Spacing.xl },
  createBtn: { borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: 12, marginTop: Spacing.sm },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
