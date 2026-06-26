import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { Brand, Spacing, Radius, Shadow } from '@/constants/theme';
import { ConfirmModal } from '@/components/confirm-modal';
import CourtUpModal from '@/components/CourtUpModal';
import StatusCanchas from '@/components/StatusCanchas';

const HOURS = Array.from({ length: 17 }, (_, i) => `${String(i + 7).padStart(2, '0')}:00`);
const DAYS_EN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAY_LABELS: Record<string, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

type Cancha = {
  id: string;
  numero_cancha: number;
  superficie: string;
  deporte: string;
  activa: boolean;
};

export default function CanchasScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mainTab, setMainTab] = useState<'gestion' | 'status'>('gestion');

  const fetchCanchas = useCallback(async () => {
    if (!user?.club_id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const { data } = await supabase
        .from('canchas')
        .select('id, numero_cancha, superficie, deporte, activa')
        .eq('organizacion_id', user.club_id)
        .order('numero_cancha');
      if (data) setCanchas(data as any);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchCanchas(); }, [fetchCanchas]);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [canchaToToggle, setCanchaToToggle] = useState<Cancha | null>(null);

  // Availability Modal State
  const [availModalVisible, setAvailModalVisible] = useState(false);
  const [selectedCancha, setSelectedCancha] = useState<Cancha | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [savingAvail, setSavingAvail] = useState(false);
  const [localAvail, setLocalAvail] = useState<{ [key: string]: boolean }>({});
  const [selectedAvailDay, setSelectedAvailDay] = useState<string>('lunes');

  const toggleEstado = (cancha: Cancha) => {
    setCanchaToToggle(cancha);
    setConfirmVisible(true);
  };

  const handleConfirmToggle = async () => {
    if (!canchaToToggle) return;
    setConfirmVisible(false);
    try {
      await supabase.from('canchas').update({ activa: !canchaToToggle.activa }).eq('id', canchaToToggle.id);
      fetchCanchas();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'No se pudo cambiar el estado de la cancha.');
    } finally {
      setCanchaToToggle(null);
    }
  };

  const openAvailabilityModal = async (cancha: Cancha) => {
    setSelectedCancha(cancha);
    setAvailModalVisible(true);
    setLoadingAvail(true);
    try {
      const { data, error } = await supabase
        .from('disponibilidad_cancha_semanal')
        .select('dia_semana, hora_inicio')
        .eq('cancha_id', cancha.id);

      if (error) throw error;

      const mapping: { [key: string]: boolean } = {};
      data?.forEach((slot: any) => {
        const hr = slot.hora_inicio.substring(0, 5);
        mapping[`${slot.dia_semana.toLowerCase()}_${hr}`] = true;
      });
      setLocalAvail(mapping);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo cargar la disponibilidad.');
    } finally {
      setLoadingAvail(false);
    }
  };

  const toggleHourSlot = (hour: string) => {
    const key = `${selectedAvailDay}_${hour}`;
    setLocalAvail(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const copyDayAvailabilityToAll = () => {
    setLocalAvail(prev => {
      const updated = { ...prev };
      DAYS_EN.forEach(day => {
        if (day !== selectedAvailDay) {
          HOURS.forEach(hour => {
            const sourceKey = `${selectedAvailDay}_${hour}`;
            const targetKey = `${day}_${hour}`;
            updated[targetKey] = prev[sourceKey] || false;
          });
        }
      });
      return updated;
    });
    Alert.alert('Copiado', `El horario del ${DAY_LABELS[selectedAvailDay]} ha sido copiado a todos los demás días de la semana.`);
  };

  const copyDayAvailabilityToWeekdays = () => {
    setLocalAvail(prev => {
      const updated = { ...prev };
      const weekdays = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
      weekdays.forEach(day => {
        if (day !== selectedAvailDay) {
          HOURS.forEach(hour => {
            const sourceKey = `${selectedAvailDay}_${hour}`;
            const targetKey = `${day}_${hour}`;
            updated[targetKey] = prev[sourceKey] || false;
          });
        }
      });
      return updated;
    });
    Alert.alert('Copiado', `El horario del ${DAY_LABELS[selectedAvailDay]} ha sido copiado a los días de semana (Lunes a Viernes).`);
  };

  const copyDayAvailabilityToWeekends = () => {
    setLocalAvail(prev => {
      const updated = { ...prev };
      const weekends = ['sabado', 'domingo'];
      weekends.forEach(day => {
        if (day !== selectedAvailDay) {
          HOURS.forEach(hour => {
            const sourceKey = `${selectedAvailDay}_${hour}`;
            const targetKey = `${day}_${hour}`;
            updated[targetKey] = prev[sourceKey] || false;
          });
        }
      });
      return updated;
    });
    Alert.alert('Copiado', `El horario del ${DAY_LABELS[selectedAvailDay]} ha sido copiado al fin de semana (Sábado y Domingo).`);
  };

  const handleSaveAvailability = async () => {
    if (!selectedCancha) return;
    setSavingAvail(true);
    try {
      const proposals = [];
      for (const [key, isSelected] of Object.entries(localAvail)) {
        if (isSelected) {
          const [day, hour] = key.split('_');
          const [h, m] = hour.split(':');
          proposals.push({
            cancha_id: Number(selectedCancha.id),
            dia_semana: day,
            hora_inicio: `${h}:${m}:00`,
            hora_fin: `${(parseInt(h) + 1).toString().padStart(2, '0')}:${m}:00`
          });
        }
      }

      // Delete existing slots
      const { error: deleteError } = await supabase
        .from('disponibilidad_cancha_semanal')
        .delete()
        .eq('cancha_id', Number(selectedCancha.id));

      if (deleteError) throw deleteError;

      // Insert new slots
      if (proposals.length > 0) {
        const { error: insertError } = await supabase
          .from('disponibilidad_cancha_semanal')
          .insert(proposals);

        if (insertError) throw insertError;
      }

      setAvailModalVisible(false);
      Alert.alert('Éxito', 'La disponibilidad ha sido guardada correctamente.');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message || 'No se pudo guardar la disponibilidad.');
    } finally {
      setSavingAvail(false);
    }
  };

  const renderCancha = ({ item }: { item: Cancha }) => {
    const color = item.activa ? Brand.green : '#f59e0b';
    const estadoTxt = item.activa ? 'disponible' : 'mantenimiento';
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, Shadow.sm]}
        onPress={() => openAvailabilityModal(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardLeft}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Cancha {item.numero_cancha}</Text>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            {item.deporte} · {item.superficie}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.estadoBtn, { backgroundColor: color + '20', borderColor: color }]}
          onPress={() => toggleEstado(item)}
        >
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={[styles.estadoText, { color }]}>{estadoTxt}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <View>
          <Text style={styles.headerTitle}>Canchas</Text>
          <Text style={[styles.headerSub, { color: '#9ca3af' }]}>{canchas.length} canchas</Text>
        </View>
        {mainTab === 'gestion' && (
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/(organizador)/nueva-cancha' as any)}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.mainTabs, { borderBottomColor: theme.border }]}>
        <TouchableOpacity 
          style={[styles.mainTab, mainTab === 'gestion' && { borderBottomColor: Brand.orange }]}
          onPress={() => setMainTab('gestion')}
        >
          <Text style={[styles.mainTabText, { color: mainTab === 'gestion' ? Brand.orange : theme.textSecondary }]}>Gestión</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.mainTab, mainTab === 'status' && { borderBottomColor: Brand.orange }]}
          onPress={() => setMainTab('status')}
        >
          <Text style={[styles.mainTabText, { color: mainTab === 'status' ? Brand.orange : theme.textSecondary }]}>Status (Hoy)</Text>
        </TouchableOpacity>
      </View>

      {mainTab === 'status' ? (
        <StatusCanchas />
      ) : (
        <>


      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.orange} />
        </View>
      ) : !user?.club_id ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No estás asociado a ningún club
          </Text>
        </View>
      ) : (
        <FlatList
          data={canchas}
          renderItem={renderCancha}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchCanchas(); }}
              tintColor={Brand.orange}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏟️</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No hay canchas cargadas</Text>
            </View>
          }
        />
      )}

      <ConfirmModal
        visible={confirmVisible}
        title="Cambiar estado"
        message={`¿Estás seguro de que deseas cambiar la "Cancha ${canchaToToggle?.numero_cancha}" a ${canchaToToggle?.activa ? 'mantenimiento' : 'disponible'}?`}
        confirmText="Confirmar"
        cancelText="Cancelar"
        onConfirm={handleConfirmToggle}
        onCancel={() => {
          setConfirmVisible(false);
          setCanchaToToggle(null);
        }}
      />

      {/* Availability Modal */}
      <CourtUpModal
        visible={availModalVisible}
        title="Disponibilidad Semanal"
        subtitle={`Cancha ${selectedCancha?.numero_cancha} (${selectedCancha?.deporte})`}
        onClose={() => setAvailModalVisible(false)}
      >

            {/* Horizontal Day Tabs */}
            <View style={[styles.modalTabsContainer, { borderBottomColor: theme.border }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalTabsScroll}>
                {DAYS_EN.map((day, idx) => {
                  const isActive = selectedAvailDay === day;
                  const label = DAYS_ES[idx];
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.modalTab,
                        isActive ? { backgroundColor: Brand.orange } : { backgroundColor: theme.backgroundElement }
                      ]}
                      onPress={() => setSelectedAvailDay(day)}
                    >
                      <Text style={[styles.modalTabLabel, { color: isActive ? '#fff' : theme.textSecondary }]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Day Title and Action */}
            <View style={styles.dayHeaderRow}>
              <Text style={[styles.dayHeaderTitle, { color: theme.text }]}>
                Horarios del {DAY_LABELS[selectedAvailDay]}
              </Text>
            </View>

            {/* Quick Actions ScrollView */}
            <View style={styles.quickActionsContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.xs }}>
                <TouchableOpacity onPress={copyDayAvailabilityToAll} style={styles.copyDayBtn}>
                  <Ionicons name="copy-outline" size={12} color={Brand.orange} />
                  <Text style={styles.copyDayText}>Copiar a toda la semana</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={copyDayAvailabilityToWeekdays} style={styles.copyDayBtn}>
                  <Ionicons name="copy-outline" size={12} color={Brand.orange} />
                  <Text style={styles.copyDayText}>Lunes a Viernes</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={copyDayAvailabilityToWeekends} style={styles.copyDayBtn}>
                  <Ionicons name="copy-outline" size={12} color={Brand.orange} />
                  <Text style={styles.copyDayText}>Fin de Semana</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Hours list */}
            {loadingAvail ? (
              <View style={styles.modalCenter}>
                <ActivityIndicator size="large" color={Brand.orange} />
                <Text style={{ color: theme.textSecondary, marginTop: 10, fontSize: 13 }}>Cargando disponibilidad...</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.hoursListScroll}>
                {HOURS.map(hour => {
                  const key = `${selectedAvailDay}_${hour}`;
                  const isAvailable = !!localAvail[key];
                  const [h, m] = hour.split(':');
                  const nextHourStr = `${(parseInt(h) + 1).toString().padStart(2, '0')}:${m}`;

                  return (
                    <TouchableOpacity
                      key={hour}
                      style={[
                        styles.hourRow,
                        { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                        isAvailable && { backgroundColor: Brand.orange + '10', borderColor: Brand.orange }
                      ]}
                      onPress={() => toggleHourSlot(hour)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.hourInfo}>
                        <Ionicons name="time-outline" size={16} color={isAvailable ? Brand.orange : theme.textMuted} />
                        <Text style={[styles.hourText, { color: theme.text }]}>
                          {hour} hs - {nextHourStr} hs
                        </Text>
                      </View>
                      <View style={[
                        styles.checkbox,
                        isAvailable ? { backgroundColor: Brand.orange, borderColor: Brand.orange } : { borderColor: theme.borderStrong }
                      ]}>
                        {isAvailable && <Ionicons name="checkmark" size={12} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Actions Footer */}
            <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: theme.border }]}
                onPress={() => setAvailModalVisible(false)}
                disabled={savingAvail}
              >
                <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: Brand.orange }]}
                onPress={handleSaveAvailability}
                disabled={savingAvail}
              >
                {savingAvail ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    Guardar Cambios
                  </Text>
                )}
              </TouchableOpacity>
            </View>
      </CourtUpModal>
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.xxxl + Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  headerBtn: {
    padding: Spacing.sm,
    backgroundColor: Brand.orange,
    borderRadius: Radius.full,
  },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { fontSize: 14, marginTop: 2 },
  mainTabs: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: Spacing.sm },
  mainTab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  mainTabText: { fontSize: 14, fontWeight: '700' },

  modalTabsContainer: {
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
  },
  modalTabsScroll: {
    gap: Spacing.xs,
  },
  modalTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  modalTabLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  dayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  dayHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  quickActionsContainer: {
    marginBottom: Spacing.md,
  },
  copyDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Brand.orange,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    backgroundColor: Brand.orange + '10',
  },
  copyDayText: {
    fontSize: 11,
    fontWeight: '700',
    color: Brand.orange,
  },
  modalCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hoursListScroll: {
    gap: Spacing.xs,
    paddingBottom: Spacing.xl,
  },
  hourRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  hourInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  hourText: {
    fontSize: 14,
    fontWeight: '600',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    marginTop: 'auto',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  list: { padding: Spacing.base, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.base,
    gap: Spacing.base,
  },
  cardLeft: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  cardSub: { fontSize: 13 },
  estadoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  estadoText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: Spacing.xxxl, gap: Spacing.base },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, textAlign: 'center' },
});
