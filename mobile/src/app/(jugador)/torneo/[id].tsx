import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { Brand, Spacing, Radius, Shadow } from '@/constants/theme';
import { ConfirmModal } from '@/components/confirm-modal';

type Partido = {
  id: string;
  ronda: number;
  estado: string;
  fecha_hora: string | null;
  ganador_pareja: number | null;
  resultado_set1: string | null;
  resultado_set2: string | null;
  resultado_set3: string | null;
  pareja1?: { jugador1?: { nombre: string; apellido: string }; jugador2?: { nombre: string; apellido: string } };
  pareja2?: { jugador1?: { nombre: string; apellido: string }; jugador2?: { nombre: string; apellido: string } };
};

type Torneo = {
  id: string;
  nombre: string;
  deporte: string;
  estado: string;
  fecha_inicio: string;
  fecha_fin: string;
  precio_inscripcion: number;
  max_parejas: number;
  club?: { nombre: string };
  tarifas?: {
    precio_single: number;
    precio_dobles: number;
    precio_ambos: number;
  }[];
};

type Inscripcion = { id: string } | null;

const ESTADO_PARTIDO: Record<string, string> = {
  pendiente: '⏳ Pendiente',
  jugando: '🟢 En juego',
  finalizado: '✅ Finalizado',
};

export default function TorneoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { user } = useAuth();
  const [torneo, setTorneo] = useState<Torneo | null>(null);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [inscripcion, setInscripcion] = useState<Inscripcion>(null);
  const [loading, setLoading] = useState(true);
  const [inscribiendo, setInscribiendo] = useState(false);

  // Modality selection state
  const [selectedModalidad, setSelectedModalidad] = useState<'Single' | 'Dobles' | 'Ambos'>('Single');

  useEffect(() => {
    if (!id) return;
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [torneoRes, partidosRes, inscrRes] = await Promise.all([
        supabase
          .from('torneos')
          .select('*, nombre:nombre_torneo, estado:fase_actual, club:organizaciones(nombre), tarifas:tarifas_torneo(precio_single, precio_dobles, precio_ambos)')
          .eq('id', id)
          .single(),
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
          .order('ronda', { ascending: true }),
        user
          ? supabase
              .from('inscripciones_torneo')
              .select('id')
              .eq('torneo_id', id)
              .eq('usuario_id', user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (torneoRes.data) {
        const t = torneoRes.data as any;
        setTorneo(t);
      }
      if (partidosRes.data) setPartidos(partidosRes.data as any);
      if (inscrRes.data) setInscripcion(inscrRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getSelectedPrice = () => {
    if (!torneo?.tarifas?.[0]) return 0;
    const rate = torneo.tarifas[0];
    if (selectedModalidad === 'Dobles') return Number(rate.precio_dobles) || 0;
    if (selectedModalidad === 'Ambos') return Number(rate.precio_ambos) || 0;
    return Number(rate.precio_single) || 0;
  };

  const [confirmVisible, setConfirmVisible] = useState(false);

  const handleInscribirse = () => {
    if (!user || !torneo) return;
    setConfirmVisible(true);
  };

  const confirmInscripcion = async () => {
    if (!user || !torneo) return;
    setInscribiendo(true);
    setConfirmVisible(false);
    try {
      const price = getSelectedPrice();
      const { error } = await supabase.from('inscripciones_torneo').insert({
        torneo_id: torneo.id,
        usuario_id: user.id,
        modalidad: selectedModalidad,
        monto_total_pagado: price,
        comision_plataforma: price * 0.1,
        monto_neto_club: price * 0.9,
        estado_pago: 'Aprobado',
        fecha_pago: new Date().toISOString()
      });
      if (error) throw error;
      Alert.alert('¡Inscripto!', 'Te has inscripto al torneo correctamente.');
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo inscribir');
    } finally {
      setInscribiendo(false);
    }
  };

  const getNombrePareja = (pareja: any) => {
    if (!pareja) return 'Por definir';
    const j1 = pareja.jugador1 ? `${pareja.jugador1.nombre} ${pareja.jugador1.apellido}` : '';
    const j2 = pareja.jugador2 ? `${pareja.jugador2.nombre} ${pareja.jugador2.apellido}` : '';
    return j1 && j2 ? `${j1} / ${j2}` : j1 || 'Por definir';
  };

  const parseSet = (setStr: string | null) => {
    if (!setStr) return null;
    const [a, b] = setStr.split('-').map(Number);
    if (isNaN(a) || isNaN(b)) return null;
    return { a, b };
  };

  const renderSets = (partido: Partido, teamNum: number) => {
    const sets = [partido.resultado_set1, partido.resultado_set2, partido.resultado_set3];
    return sets.map((setStr, i) => {
      const parsed = parseSet(setStr);
      if (!parsed) return null;
      const myScore = teamNum === 1 ? parsed.a : parsed.b;
      const theirScore = teamNum === 1 ? parsed.b : parsed.a;
      const isWinner = myScore > theirScore;
      return (
        <View
          key={i}
          style={[
            styles.setBox,
            { backgroundColor: isWinner ? Brand.green : theme.backgroundElement },
          ]}
        >
          <Text style={[styles.setScore, { color: isWinner ? '#fff' : theme.textSecondary }]}>
            {myScore}
          </Text>
        </View>
      );
    });
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={Brand.green} />
      </View>
    );
  }

  if (!torneo) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Torneo no encontrado</Text>
      </View>
    );
  }

  const rondas = [...new Set(partidos.map((p) => p.ronda))].sort((a, b) => a - b);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{torneo.nombre}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color={Brand.green} />
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              {(torneo.club as any)?.nombre || 'Club'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color={Brand.green} />
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              {torneo.fecha_inicio
                ? new Date(torneo.fecha_inicio).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
                : '--'}
            </Text>
          </View>
          {getSelectedPrice() > 0 && (
            <View style={styles.infoRow}>
              <Ionicons name="cash-outline" size={16} color={Brand.green} />
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                ${getSelectedPrice().toLocaleString('es-AR')}
              </Text>
            </View>
          )}
        </View>

        {/* Modality Selector */}
        {!inscripcion && (torneo.estado === 'Inscripcion' || torneo.estado === 'inscripcion_abierta') && (
          <View style={[styles.modalitySection, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.modalityTitle, { color: theme.text }]}>Selecciona Modalidad</Text>
            <View style={styles.modalityRow}>
              {(['Single', 'Dobles', 'Ambos'] as const).map((mod) => {
                const priceKey = mod === 'Single' ? 'precio_single' : mod === 'Dobles' ? 'precio_dobles' : 'precio_ambos';
                const price = torneo.tarifas?.[0]?.[priceKey] || 0;
                
                // Only render if price > 0 or it's 'Single' as fallback
                if (price === 0 && mod !== 'Single') return null;

                const isSelected = selectedModalidad === mod;
                return (
                  <TouchableOpacity
                    key={mod}
                    style={[
                      styles.modalityChip,
                      isSelected ? { backgroundColor: Brand.orange, borderColor: Brand.orange } : { backgroundColor: theme.background, borderColor: theme.border },
                    ]}
                    onPress={() => setSelectedModalidad(mod)}
                  >
                    <Text style={[styles.modalityLabel, isSelected ? { color: '#fff' } : { color: theme.text }]}>
                      {mod}
                    </Text>
                    <Text style={[styles.modalityPrice, isSelected ? { color: '#fff' } : { color: Brand.orange }]}>
                      ${price}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Inscripción */}
        {(torneo.estado === 'Inscripcion' || torneo.estado === 'inscripcion_abierta') && (
          <TouchableOpacity
            style={[styles.inscribirBtn, inscripcion && styles.inscribirBtnDone, inscribiendo && styles.btnDisabled]}
            onPress={inscripcion ? undefined : handleInscribirse}
            disabled={!!inscripcion || inscribiendo}
            activeOpacity={0.85}
          >
            {inscribiendo ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name={inscripcion ? 'checkmark-circle' : 'add-circle-outline'} size={20} color="#fff" />
                <Text style={styles.inscribirBtnText}>
                  {inscripcion ? 'Inscripto ✓' : 'Inscribirse'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Bracket */}
        {partidos.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🏆 Bracket</Text>
            {rondas.map((ronda) => (
              <View key={ronda} style={styles.rondaGroup}>
                <Text style={[styles.rondaLabel, { color: theme.textSecondary }]}>
                  Ronda {ronda}
                </Text>
                {partidos.filter((p) => p.ronda === ronda).map((partido) => (
                  <View
                    key={partido.id}
                    style={[styles.matchCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                  >
                    {/* Pareja 1 */}
                    <View style={styles.teamRow}>
                      <Text
                        style={[
                          styles.teamName,
                          { color: partido.ganador_pareja === 1 ? Brand.green : theme.text },
                          partido.ganador_pareja === 1 && styles.winnerName,
                        ]}
                        numberOfLines={1}
                      >
                        {partido.ganador_pareja === 1 && '🏆 '}
                        {getNombrePareja(partido.pareja1)}
                      </Text>
                      <View style={styles.setsRow}>
                        {renderSets(partido, 1)}
                      </View>
                    </View>

                    <View style={[styles.matchDivider, { backgroundColor: theme.border }]} />

                    {/* Pareja 2 */}
                    <View style={styles.teamRow}>
                      <Text
                        style={[
                          styles.teamName,
                          { color: partido.ganador_pareja === 2 ? Brand.green : theme.text },
                          partido.ganador_pareja === 2 && styles.winnerName,
                        ]}
                        numberOfLines={1}
                      >
                        {partido.ganador_pareja === 2 && '🏆 '}
                        {getNombrePareja(partido.pareja2)}
                      </Text>
                      <View style={styles.setsRow}>
                        {renderSets(partido, 2)}
                      </View>
                    </View>

                    <View style={[styles.matchFooter, { borderTopColor: theme.border }]}>
                      <Text style={[styles.matchEstado, { color: theme.textMuted }]}>
                        {ESTADO_PARTIDO[partido.estado] || partido.estado}
                      </Text>
                      {partido.fecha_hora && (
                        <Text style={[styles.matchFecha, { color: theme.textMuted }]}>
                          {new Date(partido.fecha_hora).toLocaleString('es-AR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {partidos.length === 0 && torneo.estado === 'inscripcion_abierta' && (
          <View style={styles.emptyBracket}>
            <Text style={styles.emptyBracketIcon}>🎾</Text>
            <Text style={[styles.emptyBracketText, { color: theme.textSecondary }]}>
              El bracket se generará cuando cierre la inscripción
            </Text>
          </View>
        )}
      </ScrollView>

      <ConfirmModal
        visible={confirmVisible}
        title="Inscribirse al Torneo"
        message={torneo ? `¿Deseas solicitar tu inscripción al torneo "${torneo.nombre}"?\n\n🏢 Club: ${(torneo.club as any)?.nombre || 'Club'}\n🏆 Deporte: ${torneo.deporte}\n⚔️ Modalidad: ${selectedModalidad}\n💰 Precio: $${getSelectedPrice().toLocaleString('es-AR')}` : ''}
        confirmText="Confirmar Inscripción"
        loading={inscribiendo}
        onConfirm={confirmInscripcion}
        onCancel={() => setConfirmVisible(false)}
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
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl, gap: Spacing.base },
  infoCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  infoText: { fontSize: 14 },
  modalitySection: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  modalityTitle: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalityRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modalityChip: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  modalityLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalityPrice: {
    fontSize: 12,
    fontWeight: '800',
  },
  inscribirBtn: {
    backgroundColor: Brand.green,
    borderRadius: Radius.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    shadowColor: Brand.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  inscribirBtnDone: { backgroundColor: '#10b981', shadowColor: '#10b981' },
  btnDisabled: { opacity: 0.7 },
  inscribirBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  section: { gap: Spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: Spacing.xs },
  rondaGroup: { gap: Spacing.sm },
  rondaLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  matchCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: 10,
    gap: Spacing.sm,
  },
  teamName: { flex: 1, fontSize: 14, fontWeight: '600' },
  winnerName: { fontWeight: '800' },
  setsRow: { flexDirection: 'row', gap: 4 },
  setBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setScore: { fontSize: 13, fontWeight: '700' },
  matchDivider: { height: 1, marginHorizontal: Spacing.base },
  matchFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
  },
  matchEstado: { fontSize: 11 },
  matchFecha: { fontSize: 11 },
  emptyBracket: { alignItems: 'center', paddingVertical: Spacing.xxxl, gap: Spacing.base },
  emptyBracketIcon: { fontSize: 48 },
  emptyBracketText: { fontSize: 14, textAlign: 'center' },
});
