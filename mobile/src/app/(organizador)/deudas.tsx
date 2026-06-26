import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { Brand, Spacing, Radius, Shadow } from '@/constants/theme';

type Deuda = {
  usuario_id: string;
  nombre: string;
  email: string;
  total_adeudado: number;
};

export default function DeudasScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDeudas = useCallback(async () => {
    try {
      const { data: canchas } = await supabase.from('canchas').select('id').eq('organizacion_id', user?.club_id);
      if (!canchas || canchas.length === 0) {
        setDeudas([]);
        return;
      }
      const canchaIds = canchas.map(c => c.id);

      const { data, error } = await supabase
        .from('alquileres_cancha')
        .select('usuario_id, monto_total, perfiles_usuarios!inner(nombre, email)')
        .in('cancha_id', canchaIds)
        .eq('estado_pago', 'Pendiente');

      if (error) throw error;

      const map: Record<string, Deuda> = {};
      data?.forEach((a: any) => {
        if (!map[a.usuario_id]) {
          map[a.usuario_id] = {
            usuario_id: a.usuario_id,
            nombre: a.perfiles_usuarios.nombre,
            email: a.perfiles_usuarios.email,
            total_adeudado: 0,
          };
        }
        map[a.usuario_id].total_adeudado += Number(a.monto_total);
      });

      setDeudas(Object.values(map));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchDeudas(); }, [fetchDeudas]);

  const handleMarcarPagado = async (usuario_id: string) => {
    Alert.alert('Marcar como pagado', '¿Confirmar el pago de toda la deuda pendiente?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: async () => {
        const { data: canchas } = await supabase.from('canchas').select('id').eq('organizacion_id', user?.club_id);
        const canchaIds = canchas?.map(c => c.id) || [];
        await supabase
          .from('alquileres_cancha')
          .update({ estado_pago: 'Aprobado', fecha_pago: new Date().toISOString() })
          .eq('usuario_id', usuario_id)
          .eq('estado_pago', 'Pendiente')
          .in('cancha_id', canchaIds);
        fetchDeudas();
      }}
    ]);
  };

  const renderItem = ({ item }: { item: Deuda }) => (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, Shadow.sm]}>
      <View style={styles.cardInfo}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>{item.nombre}</Text>
        <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{item.email}</Text>
        <Text style={[styles.cardAmount, { color: Brand.orange }]}>Deuda: ${item.total_adeudado.toFixed(2)}</Text>
      </View>
      <TouchableOpacity style={styles.payBtn} onPress={() => handleMarcarPagado(item.usuario_id)}>
        <Text style={styles.payBtnText}>Saldar</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Deudas de Profesores</Text>
        </View>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Brand.orange} /></View>
      ) : (
        <FlatList
          data={deudas}
          keyExtractor={item => item.usuario_id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDeudas(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No hay profesores con deuda pendiente.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: Spacing.xxxl + Spacing.xl, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.xl, gap: Spacing.md },
  backBtn: { padding: Spacing.sm, backgroundColor: Brand.orange, borderRadius: Radius.full },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  list: { padding: Spacing.base, gap: Spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.base, gap: Spacing.base, justifyContent: 'space-between' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  cardSub: { fontSize: 13, marginBottom: 4 },
  cardAmount: { fontSize: 15, fontWeight: '800' },
  payBtn: { backgroundColor: Brand.orange, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  payBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: Spacing.xxxl, gap: Spacing.base },
  emptyText: { fontSize: 15, textAlign: 'center' },
});
