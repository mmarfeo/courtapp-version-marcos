import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { Brand, Spacing, Radius, Shadow } from '@/constants/theme';
import CourtUpModal from '@/components/CourtUpModal';

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

const ESTADO_PARTIDO: Record<string, string> = {
  pendiente: '⏳ Pendiente',
  jugando: '🟢 En juego',
  finalizado: '✅ Finalizado',
};

interface BracketModalProps {
  visible: boolean;
  torneoId: string;
  torneoNombre: string;
  onClose: () => void;
}

export function BracketModal({ visible, torneoId, torneoNombre, onClose }: BracketModalProps) {
  const theme = useTheme();
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPartidos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
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
        .eq('torneo_id', torneoId)
        .order('ronda', { ascending: true });

      if (error) throw error;
      setPartidos((data as any) || []);
    } catch (e) {
      console.error('Error fetching partidos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && torneoId) {
      fetchPartidos();
    }
  }, [visible, torneoId]);

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

  const rondas = [...new Set(partidos.map((p) => p.ronda))].sort((a, b) => a - b);

  return (
    <CourtUpModal
      visible={visible}
      onClose={onClose}
      title={torneoNombre}
    >
      <View style={{ flex: 1 }}>
        {/* Accent Orange Bar */}
        <View style={styles.accentBar} />

        {/* Content */}
        {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={Brand.orange} />
            </View>
          ) : partidos.length === 0 ? (
            <View style={styles.center}>
              <Text style={{ fontSize: 48 }}>🎾</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                El bracket aún no está disponible.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>🏆 Cuadro del Torneo</Text>
              {rondas.map((ronda) => (
                <View key={ronda} style={styles.rondaGroup}>
                  <Text style={[styles.rondaLabel, { color: theme.textSecondary }]}>
                    Ronda {ronda}
                  </Text>
                  {partidos.filter((p) => p.ronda === ronda).map((partido) => (
                    <View
                      key={partido.id}
                      style={[styles.matchCard, { backgroundColor: theme.background, borderColor: theme.border }]}
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
            </ScrollView>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.closeFooterBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.closeFooterBtnText}>Cerrar Cuadro</Text>
            </TouchableOpacity>
          </View>
      </View>
    </CourtUpModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  container: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadow.lg,
    flexDirection: 'column',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: Brand.orange,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
    paddingRight: Spacing.md,
  },
  closeBtn: {
    padding: 4,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: Spacing.xs,
  },
  rondaGroup: {
    gap: Spacing.sm,
  },
  rondaLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: 10,
    gap: Spacing.sm,
  },
  teamName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  winnerName: {
    fontWeight: '800',
  },
  setsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  setBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setScore: {
    fontSize: 13,
    fontWeight: '700',
  },
  matchDivider: {
    height: 1,
    marginHorizontal: Spacing.base,
  },
  matchFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
  },
  matchEstado: {
    fontSize: 11,
  },
  matchFecha: {
    fontSize: 11,
  },
  footer: {
    padding: Spacing.lg,
  },
  closeFooterBtn: {
    backgroundColor: Brand.orange,
    height: 48,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeFooterBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
