import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { Brand, Spacing, Radius } from '@/constants/theme';

type Partido = {
  id: string;
  ronda: number;
  estado: string;
  fecha_hora: string | null;
  ganador_pareja: number | null;
  resultado_set1: string | null;
  resultado_set2: string | null;
  resultado_set3: string | null;
  pareja1?: any;
  pareja2?: any;
};

type Inscripcion = {
  id: string;
  estado: string;
  usuario: { nombre: string; apellido: string; email: string };
};

export default function OrganizadorTorneoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [torneo, setTorneo] = useState<any>(null);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'partidos' | 'inscripciones'>('partidos');
  const [editingPartido, setEditingPartido] = useState<Partido | null>(null);
  const [set1, setSet1] = useState('');
  const [set2, setSet2] = useState('');
  const [set3, setSet3] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [torneoRes, partidosRes, inscrRes] = await Promise.all([
        supabase.from('torneos').select('*, nombre:nombre_torneo, estado:fase_actual, club:organizaciones(nombre)').eq('id', id).single(),
        supabase
          .from('partidos')
          .select(`
            id, ronda, estado, fecha_hora, ganador_pareja,
            resultado_set1, resultado_set2, resultado_set3,
            pareja1:parejas!partidos_pareja1_id_fkey(
              jugador1:usuarios!parejas_jugador1_id_fkey(nombre, apellido),
              jugador2:usuarios!parejas_jugador2_id_fkey(nombre, apellido)
            ),
            pareja2:parejas!partidos_pareja2_id_fkey(
              jugador1:usuarios!parejas_jugador1_id_fkey(nombre, apellido),
              jugador2:usuarios!parejas_jugador2_id_fkey(nombre, apellido)
            )
          `)
          .eq('torneo_id', id)
          .order('ronda'),
        supabase
          .from('inscripciones_torneo')
          .select('id, estado:estado_pago, usuario:perfiles_usuarios(nombre, email)')
          .eq('torneo_id', id),
      ]);

      if (torneoRes.data) setTorneo(torneoRes.data);
      if (partidosRes.data) setPartidos(partidosRes.data as any);
      if (inscrRes.data) setInscripciones(inscrRes.data as any);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getNombrePareja = (pareja: any) => {
    if (!pareja) return 'Por definir';
    const j1 = pareja.jugador1 ? `${pareja.jugador1.nombre} ${pareja.jugador1.apellido}` : '';
    const j2 = pareja.jugador2 ? `${pareja.jugador2.nombre} ${pareja.jugador2.apellido}` : '';
    return j1 && j2 ? `${j1} / ${j2}` : j1 || 'Por definir';
  };

  const openEditPartido = (partido: Partido) => {
    setEditingPartido(partido);
    setSet1(partido.resultado_set1 || '');
    setSet2(partido.resultado_set2 || '');
    setSet3(partido.resultado_set3 || '');
  };

  const calcularGanador = (s1: string, s2: string, s3: string) => {
    let wins1 = 0, wins2 = 0;
    const sets = [s1, s2, s3].filter(Boolean);
    for (const set of sets) {
      const [a, b] = set.split('-').map(Number);
      if (!isNaN(a) && !isNaN(b)) {
        if (a > b) wins1++;
        else if (b > a) wins2++;
      }
    }
    if (wins1 > wins2) return 1;
    if (wins2 > wins1) return 2;
    return null;
  };

  const saveResultado = async () => {
    if (!editingPartido) return;
    setSaving(true);
    try {
      const ganador = set1 ? calcularGanador(set1, set2, set3) : null;
      const { error } = await supabase
        .from('partidos')
        .update({
          resultado_set1: set1 || null,
          resultado_set2: set2 || null,
          resultado_set3: set3 || null,
          ganador_pareja: ganador,
          estado: ganador ? 'finalizado' : 'en_curso',
        })
        .eq('id', editingPartido.id);

      if (error) throw error;
      Alert.alert('✅ Guardado', 'Resultado actualizado correctamente');
      setEditingPartido(null);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const confirmarInscripcion = async (inscrId: string) => {
    try {
      await supabase.from('inscripciones_torneo').update({ estado_pago: 'Aprobado' }).eq('id', inscrId);
      fetchData();
    } catch (e) {
      Alert.alert('Error', 'No se pudo confirmar');
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={Brand.green} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{torneo?.nombre}</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: theme.backgroundElement, borderBottomColor: theme.border }]}>
        {(['partidos', 'inscripciones'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && { borderBottomColor: Brand.green, borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? Brand.green : theme.textSecondary }]}>
              {t === 'partidos' ? `Partidos (${partidos.length})` : `Inscriptos (${inscripciones.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'partidos' && (
          <>
            {partidos.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>⏳</Text>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  El bracket aún no fue generado
                </Text>
              </View>
            )}
            {partidos.map((partido) => (
              <TouchableOpacity
                key={partido.id}
                style={[styles.matchCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => openEditPartido(partido)}
                activeOpacity={0.8}
              >
                <View style={styles.matchHeader}>
                  <Text style={[styles.rondaLabel, { color: theme.textMuted }]}>Ronda {partido.ronda}</Text>
                  <Text style={[styles.estadoLabel, { color: partido.estado === 'finalizado' ? Brand.green : '#f59e0b' }]}>
                    {partido.estado === 'finalizado' ? '✅ Finalizado' : partido.estado === 'en_curso' ? '🟢 En Curso' : '⏳ Pendiente'}
                  </Text>
                </View>
                <View style={[styles.matchDivider, { backgroundColor: theme.border }]} />
                <View style={styles.teamRow}>
                  <Text style={[styles.teamName, { color: partido.ganador_pareja === 1 ? Brand.green : theme.text }]}>
                    {partido.ganador_pareja === 1 ? '🏆 ' : ''}{getNombrePareja(partido.pareja1)}
                  </Text>
                  <Text style={[styles.setResult, { color: theme.textSecondary }]}>
                    {partido.resultado_set1?.split('-')[0] ?? '--'}
                    {partido.resultado_set2 ? ` ${partido.resultado_set2.split('-')[0]}` : ''}
                    {partido.resultado_set3 ? ` ${partido.resultado_set3.split('-')[0]}` : ''}
                  </Text>
                </View>
                <View style={styles.teamRow}>
                  <Text style={[styles.teamName, { color: partido.ganador_pareja === 2 ? Brand.green : theme.text }]}>
                    {partido.ganador_pareja === 2 ? '🏆 ' : ''}{getNombrePareja(partido.pareja2)}
                  </Text>
                  <Text style={[styles.setResult, { color: theme.textSecondary }]}>
                    {partido.resultado_set1?.split('-')[1] ?? '--'}
                    {partido.resultado_set2 ? ` ${partido.resultado_set2.split('-')[1]}` : ''}
                    {partido.resultado_set3 ? ` ${partido.resultado_set3.split('-')[1]}` : ''}
                  </Text>
                </View>
                <View style={[styles.editHint, { borderTopColor: theme.border }]}>
                  <Ionicons name="pencil-outline" size={13} color={theme.textMuted} />
                  <Text style={[styles.editHintText, { color: theme.textMuted }]}>Tap para ingresar resultado</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {tab === 'inscripciones' && (
          <>
            {inscripciones.map((inscr) => (
              <View
                key={inscr.id}
                style={[styles.inscrCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              >
                <View style={styles.inscrInfo}>
                  <Text style={[styles.inscrName, { color: theme.text }]}>
                    {(inscr.usuario as any)?.nombre} {(inscr.usuario as any)?.apellido}
                  </Text>
                  <Text style={[styles.inscrEmail, { color: theme.textSecondary }]}>
                    {(inscr.usuario as any)?.email}
                  </Text>
                </View>
                {(inscr.estado === 'Pendiente' || inscr.estado === 'pendiente') ? (
                  <TouchableOpacity
                    style={[styles.confirmarBtn, { backgroundColor: Brand.green }]}
                    onPress={() => confirmarInscripcion(inscr.id)}
                  >
                    <Text style={styles.confirmarText}>Confirmar</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.confirmarBtnDone]}>
                    <Ionicons name="checkmark-circle" size={20} color={Brand.green} />
                    <Text style={{ color: Brand.green, fontSize: 12, fontWeight: '700' }}>OK</Text>
                  </View>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Edit Modal */}
      {editingPartido && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Ingresar Resultado</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              {getNombrePareja(editingPartido.pareja1)} vs {getNombrePareja(editingPartido.pareja2)}
            </Text>
            <Text style={[styles.modalLabel, { color: theme.textMuted }]}>
              Formato: "6-4" (pareja1-pareja2)
            </Text>

            <SetInput label="Set 1 *" value={set1} onChange={setSet1} theme={theme} />
            <SetInput label="Set 2" value={set2} onChange={setSet2} theme={theme} />
            <SetInput label="Set 3 (si aplica)" value={set3} onChange={setSet3} theme={theme} />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: theme.border, borderWidth: 1 }]}
                onPress={() => setEditingPartido(null)}
              >
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: Brand.green }]}
                onPress={saveResultado}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function SetInput({ label, value, onChange, theme }: any) {
  return (
    <View style={{ marginBottom: Spacing.sm }}>
      <Text style={{ color: theme.textMuted, fontSize: 12, marginBottom: 4 }}>{label}</Text>
      <TextInput
        style={[styles.setInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
        value={value}
        onChangeText={onChange}
        placeholder="ej: 6-4"
        placeholderTextColor={theme.textMuted}
        keyboardType="numbers-and-punctuation"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.xxxl + Spacing.xl,
    paddingBottom: Spacing.base,
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
  },
  backBtn: { padding: Spacing.xs, width: 38 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  tabText: { fontSize: 14, fontWeight: '600' },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  matchCard: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  rondaLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  estadoLabel: { fontSize: 12, fontWeight: '700' },
  matchDivider: { height: 1 },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: 10,
  },
  teamName: { flex: 1, fontSize: 14, fontWeight: '600' },
  setResult: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
  },
  editHintText: { fontSize: 11 },
  inscrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.base,
    gap: Spacing.base,
  },
  inscrInfo: { flex: 1 },
  inscrName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  inscrEmail: { fontSize: 12 },
  confirmarBtn: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  confirmarBtnDone: { alignItems: 'center', gap: 2 },
  confirmarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: Spacing.xxxl, gap: Spacing.base },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15 },
  // Modal
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modal: {
    width: '100%',
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: Spacing.xs },
  modalSubtitle: { fontSize: 13, marginBottom: Spacing.sm },
  modalLabel: { fontSize: 12, marginBottom: Spacing.sm },
  setInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.base,
  },
  modalBtn: {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
