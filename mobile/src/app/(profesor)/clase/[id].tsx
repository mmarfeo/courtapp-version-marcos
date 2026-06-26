import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { Brand, Spacing, Radius } from '@/constants/theme';

export default function DetallesClaseScreen() {
  const { id } = useLocalSearchParams();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [clase, setClase] = useState<any>(null);

  useEffect(() => {
    fetchClase();
  }, [id]);

  const fetchClase = async () => {
    try {
      const { data, error } = await supabase
        .from('clases_disponibles')
        .select(`
          *,
          cancha:canchas(nombre_club, numero_cancha),
          reservas:reservas_clases(
            id, estado_pago, 
            usuario:perfiles_usuarios!alumno_id(nombre, email, telefono)
          )
        `)
        .eq('id', id)
        .single();
      
      if (data) setClase(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={Brand.green} />
      </View>
    );
  }

  if (!clase) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textSecondary }}>Clase no encontrada</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const alumnos = clase.reservas?.filter((r: any) => r.estado !== 'cancelada') || [];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <TouchableOpacity style={styles.backIcon} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalles de Clase</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>
            {clase.deporte?.toUpperCase()} - Categoria {clase.categoria_target}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {clase.fecha?.substring(0, 10)} • {clase.hora_inicio?.slice(0, 5)} a {clase.hora_fin?.slice(0, 5)}
          </Text>
          <Text style={[styles.cancha, { color: theme.textSecondary }]}>
            📍 {((clase.cancha as any)?.nombre_club ? `${(clase.cancha as any)?.nombre_club} (C${(clase.cancha as any)?.numero_cancha})` : 'Sin cancha')}
          </Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{alumnos.length} / {clase.cupo_maximo}</Text>
              <Text style={styles.statLabel}>Inscriptos</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>${clase.precio_clase}</Text>
              <Text style={styles.statLabel}>Por Alumno</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Lista de Alumnos</Text>

        {clase.reservas && clase.reservas.length > 0 ? (
          clase.reservas.map((res: any) => (
            <View key={res.id} style={[styles.alumnoRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.avatar, { backgroundColor: Brand.green + '20' }]}>
                <Text style={{ color: Brand.green, fontWeight: '700' }}>
                  {res.usuario?.nombre?.charAt(0) || 'U'}
                </Text>
              </View>
              <View style={styles.alumnoInfo}>
                <Text style={[styles.alumnoName, { color: theme.text }]}>
                  {res.usuario?.nombre || 'Usuario'}
                </Text>
                <Text style={[styles.alumnoEmail, { color: theme.textSecondary }]}>
                  {res.usuario?.telefono ? res.usuario.telefono : 'Sin teléfono'}
                </Text>
              </View>
              <View style={[
                styles.statusBadge, 
                { backgroundColor: res.estado_pago === 'Rechazado' || res.estado_pago === 'Reembolsado' ? '#ef444420' : '#22c55e20' }
              ]}>
                <Text style={[
                  styles.statusText,
                  { color: res.estado_pago === 'Rechazado' || res.estado_pago === 'Reembolsado' ? '#ef4444' : '#22c55e' }
                ]}>
                  {res.estado_pago}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.emptyBox, { borderColor: theme.border }]}>
            <Text style={{ color: theme.textSecondary }}>Aún no hay inscriptos</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.xxxl + Spacing.md,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
  },
  backIcon: { padding: Spacing.xs },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  backBtn: { marginTop: Spacing.md, padding: Spacing.sm, backgroundColor: Brand.green, borderRadius: Radius.md },
  backBtnText: { color: '#fff', fontWeight: 'bold' },
  content: { padding: Spacing.base, gap: Spacing.lg },
  card: { padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.xs },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 14, fontWeight: '600' },
  cancha: { fontSize: 13, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  statBox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.05)', padding: Spacing.sm, borderRadius: Radius.md, alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '800', color: Brand.green },
  statLabel: { fontSize: 11, fontWeight: '600', color: '#9ca3af', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginLeft: 4 },
  emptyBox: { padding: Spacing.xl, borderWidth: 1, borderRadius: Radius.lg, borderStyle: 'dashed', alignItems: 'center' },
  alumnoRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  alumnoInfo: { flex: 1 },
  alumnoName: { fontSize: 14, fontWeight: '700' },
  alumnoEmail: { fontSize: 11, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: '700' },
});
