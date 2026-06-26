import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-notifications';
import { Brand, Spacing, Radius } from '@/constants/theme';

import { ConfirmModal } from '@/components/confirm-modal';

const DEPORTES = ['Tenis', 'Padel'];
const NIVELES = ['Todas', 'SuperA', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D'];
const HORAS = Array.from({ length: 17 }, (_, i) => `${String(i + 7).padStart(2, '0')}:00`);
const DURACIONES = [0.5, 1, 1.5, 2];

export default function NuevaClaseScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { sendNotificationToNivel, sendNotificationToAll } = useNotifications();
  
  const [canchas, setCanchas] = useState<any[]>([]);
  const [horasDisponibles, setHorasDisponibles] = useState<string[]>([]);
  const [clubes, setClubes] = useState<{ id: number, nombre: string }[]>([]);
  const [loadingCanchas, setLoadingCanchas] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [enviarNotificacion, setEnviarNotificacion] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState({ title: '', message: '', isSuccess: false, shouldGoBack: false });

  const [form, setForm] = useState({
    deporte: 'Tenis',
    categoria_target: 'Todas',
    organizacion_id: null as number | null,
    cancha_id: null as number | null,
    fecha: (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })(),
    hora_inicio: '10:00',
    duracion_horas: 1.5,
    cupo_maximo: '4',
    precio_clase: '10000',
    es_semanal: false,
  });

  useEffect(() => {
    const fetchCanchas = async () => {
      if (!user) return;

      // Obtener organizaciones a las que pertenece el usuario
      const { data: userOrgs } = await supabase
        .from('miembros_organizacion')
        .select('organizacion_id')
        .eq('usuario_id', user?.id);

      const orgIds = userOrgs?.map(o => o.organizacion_id) || [];

      let query = supabase
        .from('canchas')
        .select('id, numero_cancha, superficie, organizacion_id, organizaciones(nombre)')
        .order('numero_cancha');

      if (orgIds.length > 0) {
        query = query.in('organizacion_id', orgIds);
      } else {
        // Si no tiene organizaciones asignadas, no mostramos nada
        query = query.in('organizacion_id', [-1]);
      }

      const { data, error } = await query;
      
      if (data) {
        setCanchas(data);
        
        // Extraer organizaciones (clubes) unicas
        const uniqueClubs = new Map();
        data.forEach(c => {
          if (c.organizacion_id) {
            uniqueClubs.set(c.organizacion_id, {
              id: c.organizacion_id,
              nombre: (c.organizaciones as any)?.nombre || 'Sede ' + c.organizacion_id
            });
          }
        });
        const clubsArray = Array.from(uniqueClubs.values());
        setClubes(clubsArray);

        if (clubsArray.length > 0) {
          const firstClubId = clubsArray[0].id;
          
          const firstCancha = data.find(c => c.organizacion_id === firstClubId);
          setForm(prev => ({ 
            ...prev, 
            organizacion_id: firstClubId,
            cancha_id: firstCancha ? firstCancha.id : null 
          }));
        }
      }
      setLoadingCanchas(false);
    };
    fetchCanchas();
  }, []);

  useEffect(() => {
    const fetchHorasDisponibles = async () => {
      if (!user) return;
      
      const targetDateObj = new Date(form.fecha + 'T12:00:00');
      const targetDay = targetDateObj.getDay();
      
      const { data } = await supabase
        .from('alquileres_cancha')
        .select('hora_inicio, hora_fin, fecha, es_semanal, fecha_fin_recurrencia')
        .eq('usuario_id', user?.id);
      
      if (data && data.length > 0) {
        const allowed: string[] = [];
        data.forEach(alquiler => {
          let applies = false;
          if (alquiler.fecha === form.fecha) {
            applies = true;
          } else if (alquiler.es_semanal) {
            const alqDate = new Date(alquiler.fecha + 'T12:00:00');
            const alqEnd = alquiler.fecha_fin_recurrencia ? new Date(alquiler.fecha_fin_recurrencia + 'T12:00:00') : new Date('2099-01-01');
            if (alqDate.getDay() === targetDay && targetDateObj >= alqDate && targetDateObj <= alqEnd) {
              applies = true;
            }
          }

          if (applies) {
            const startH = parseInt(alquiler.hora_inicio.split(':')[0]);
            const endH = parseInt(alquiler.hora_fin.split(':')[0]);
            for (let i = startH; i < endH; i++) {
              const hStr = `${String(i).padStart(2, '0')}:00`;
              if (!allowed.includes(hStr)) allowed.push(hStr);
            }
          }
        });
        
        setHorasDisponibles(allowed.sort());
        if (allowed.length > 0 && !allowed.includes(form.hora_inicio)) {
          setForm(f => ({ ...f, hora_inicio: allowed[0] }));
        }
      } else {
        setHorasDisponibles([]);
      }
    };
    fetchHorasDisponibles();
  }, [user, form.fecha]);

  const handleSave = async () => {
    if (!form.cancha_id || !form.cupo_maximo || !form.precio_clase || !form.organizacion_id) {
      setModalConfig({ title: 'Error', message: 'Completá todos los campos', isSuccess: false, shouldGoBack: false });
      setModalVisible(true);
      return;
    }

    setSaving(true);
    
    // Calculate end time
    const [h, m] = form.hora_inicio.split(':').map(Number);
    const totalMinutes = h * 60 + m + (form.duracion_horas * 60);
    const endH = Math.floor(totalMinutes / 60);
    const endM = totalMinutes % 60;
    const hora_fin = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;
    const hora_inicio_full = `${form.hora_inicio}:00`;

    try {
      // 1. Chequeo de superposición de clases
      const targetDateObj = new Date(form.fecha + 'T00:00:00');
      const targetDay = targetDateObj.getDay();

      const { data: existingClasses } = await supabase
        .from('clases_disponibles')
        .select('hora_inicio, hora_fin, fecha, es_semanal')
        .eq('profesor_id', user?.id);

      if (existingClasses) {
        const newStart = parseInt(h.toString()) + parseInt(m.toString()) / 60;
        const newEnd = newStart + form.duracion_horas;

        const hasOverlap = existingClasses.some(c => {
          const classDateStr = c.fecha ? c.fecha.substring(0, 10) : '';
          let isSameDay = false;
          
          if (classDateStr === form.fecha) {
            isSameDay = true;
          } else if (c.es_semanal) {
            const classStartDay = new Date(classDateStr + 'T00:00:00').getDay();
            if (classStartDay === targetDay && classDateStr <= form.fecha) {
              isSameDay = true;
            }
          }

          if (isSameDay) {
            const [c_h, c_m] = c.hora_inicio.split(':').map(Number);
            const [c_eh, c_em] = c.hora_fin.split(':').map(Number);
            const classStart = c_h + c_m / 60;
            const classEnd = c_eh + c_em / 60;

            // Check overlap: (StartA < EndB) and (EndA > StartB)
            return newStart < classEnd && newEnd > classStart;
          }
          return false;
        });

        if (hasOverlap) {
          setModalConfig({ title: 'Horario Superpuesto', message: 'Ya tienes una clase en este horario, no puedes superponerla.', isSuccess: false, shouldGoBack: false });
          setModalVisible(true);
          setSaving(false);
          return;
        }
      }

      // 2. Insertar clase
      const { data, error } = await supabase
        .from('clases_disponibles')
        .insert([{
          profesor_id: user?.id,
          organizacion_id: form.organizacion_id,
          cancha_id: form.cancha_id,
          deporte: form.deporte,
          categoria_target: form.categoria_target,
          fecha: form.fecha,
          hora_inicio: hora_inicio_full,
          hora_fin: hora_fin,
          cupo_maximo: parseInt(form.cupo_maximo),
          precio_clase: parseFloat(form.precio_clase),
          es_semanal: form.es_semanal,
          activa: true
        }])
        .select('id')
        .single();

      if (error) throw error;
      
      // Enviar notificación push si se seleccionó
      if (enviarNotificacion && data) {
        const title = `Nueva clase de ${form.deporte} disponible`;
        const clubSeleccionado = clubes.find(c => c.id === form.organizacion_id);
        const nombreClub = clubSeleccionado ? clubSeleccionado.nombre : 'el club';
        const body = `El profesor ${user?.nombre || ''} ha publicado una clase en ${nombreClub} para el nivel ${form.categoria_target} el día ${form.fecha} a las ${form.hora_inicio} hs.`;
        
        if (form.categoria_target === 'Todas') {
          sendNotificationToAll(title, body, { type: 'nueva_clase', claseId: data.id });
        } else {
          sendNotificationToNivel(form.categoria_target, title, body, { type: 'nueva_clase', claseId: data.id });
        }
      }
      
      setModalConfig({ title: '¡Éxito!', message: 'Clase publicada correctamente.', isSuccess: true, shouldGoBack: true });
      setModalVisible(true);
    } catch (err: any) {
      console.error(err);
      setModalConfig({ title: 'Error', message: err.message || 'No se pudo crear la clase', isSuccess: false, shouldGoBack: false });
      setModalVisible(true);
    } finally {
      setSaving(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      setForm(prev => ({ ...prev, fecha: `${y}-${m}-${d}` }));
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const h = String(selectedTime.getHours()).padStart(2, '0');
      const m = String(selectedTime.getMinutes()).padStart(2, '0');
      
      // Validación: el profesor solo puede elegir horas que tenga reservadas
      const blockStr = `${h}:00`;
      if (!horasDisponibles.includes(blockStr)) {
        setModalConfig({ title: 'Horario Inválido', message: 'Solo puedes dar clases dentro de los horarios que ya tienes reservados para este día.', isSuccess: false, shouldGoBack: false });
        setModalVisible(true);
        return;
      }

      setForm(prev => ({ ...prev, hora_inicio: `${h}:${m}` }));
    }
  };

  const filteredCanchas = canchas.filter(c => c.organizacion_id === form.organizacion_id);

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Publicar Clase</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Date */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Fecha</Text>
          <TouchableOpacity 
            style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{form.fecha}</Text>
            <Ionicons name="calendar-outline" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={new Date(form.fecha + 'T12:00:00')}
              mode="date"
              display="default"
              onChange={onDateChange}
              minimumDate={new Date()}
            />
          )}
        </View>

        {horasDisponibles.length === 0 ? (
          <View style={{ marginTop: Spacing.xl, alignItems: 'center', padding: Spacing.xl, backgroundColor: theme.card, borderRadius: Radius.md, borderWidth: 1, borderColor: theme.border }}>
            <Ionicons name="calendar-clear-outline" size={48} color={theme.textSecondary} style={{ marginBottom: Spacing.sm }} />
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>Sin reservas activas</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 4 }}>
              No tienes canchas reservadas para esta fecha. Selecciona otro día o reserva una cancha primero para poder publicar tu clase.
            </Text>
          </View>
        ) : (
          <View style={{ gap: Spacing.xl }}>
            {/* Hora */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Hora de Inicio</Text>
            <TouchableOpacity 
              style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{form.hora_inicio}</Text>
              <Ionicons name="time-outline" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker
                value={(() => {
                  const [h, m] = form.hora_inicio.split(':');
                  const d = new Date();
                  d.setHours(parseInt(h || '10'), parseInt(m || '0'), 0, 0);
                  return d;
                })()}
                mode="time"
                display="default"
                onChange={onTimeChange}
              />
            )}
          </View>

            {/* Deporte */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Deporte</Text>
              <View style={styles.chipsWrap}>
                {DEPORTES.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.chip, form.deporte === d ? { backgroundColor: Brand.green, borderColor: Brand.green } : { borderColor: theme.border }]}
                    onPress={() => setForm(prev => ({ ...prev, deporte: d }))}
                  >
                    <Text style={[styles.chipText, { color: form.deporte === d ? '#fff' : theme.text }]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Categoría */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Nivel / Categoría</Text>
              <View style={styles.chipsWrap}>
                {NIVELES.map(n => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.chip, form.categoria_target === n ? { backgroundColor: Brand.green, borderColor: Brand.green } : { borderColor: theme.border }]}
                    onPress={() => setForm(prev => ({ ...prev, categoria_target: n }))}
                  >
                    <Text style={[styles.chipText, { color: form.categoria_target === n ? '#fff' : theme.text }]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Duración */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Duración</Text>
              <View style={styles.chipsWrap}>
                {DURACIONES.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.chip, form.duracion_horas === d ? { backgroundColor: Brand.green, borderColor: Brand.green } : { borderColor: theme.border }]}
                    onPress={() => setForm(prev => ({ ...prev, duracion_horas: d }))}
                  >
                    <Text style={[styles.chipText, { color: form.duracion_horas === d ? '#fff' : theme.text }]}>{d} hs</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Club / Organización */}
            {clubes.length > 1 && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Sede / Club</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsWrap}>
                  {clubes.map(club => (
                    <TouchableOpacity
                      key={club.id}
                      style={[styles.chip, form.organizacion_id === club.id ? { backgroundColor: Brand.green, borderColor: Brand.green } : { borderColor: theme.border }]}
                      onPress={() => {
                        const firstCancha = canchas.find(c => c.organizacion_id === club.id);
                        setForm(prev => ({ 
                          ...prev, 
                          organizacion_id: club.id, 
                          cancha_id: firstCancha ? firstCancha.id : null 
                        }));
                      }}
                    >
                      <Text style={[styles.chipText, { color: form.organizacion_id === club.id ? '#fff' : theme.text }]}>{club.nombre}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Cancha */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Cancha</Text>
              {loadingCanchas ? <ActivityIndicator color={Brand.green} /> : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsWrap}>
                  {filteredCanchas.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.chip, form.cancha_id === c.id ? { backgroundColor: Brand.green, borderColor: Brand.green } : { borderColor: theme.border }]}
                      onPress={() => setForm(prev => ({ ...prev, cancha_id: c.id }))}
                    >
                      <Text style={[styles.chipText, { color: form.cancha_id === c.id ? '#fff' : theme.text }]}>Cancha {c.numero_cancha}</Text>
                    </TouchableOpacity>
                  ))}
                  {filteredCanchas.length === 0 && (
                    <Text style={{ color: theme.textMuted, fontSize: 13, padding: 8 }}>No hay canchas para este club.</Text>
                  )}
                </ScrollView>
              )}
            </View>

            {/* Precio y Cupos */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Cupo (Alumnos)</Text>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                  value={form.cupo_maximo}
                  onChangeText={(v) => setForm(prev => ({ ...prev, cupo_maximo: v.replace(/[^0-9]/g, '') }))}
                  keyboardType="number-pad"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Precio ARS</Text>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                  value={form.precio_clase}
                  onChangeText={(v) => setForm(prev => ({ ...prev, precio_clase: v.replace(/[^0-9]/g, '') }))}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Es Semanal */}
            <TouchableOpacity 
              style={styles.checkboxRow}
              onPress={() => setForm(prev => ({ ...prev, es_semanal: !prev.es_semanal }))}
            >
              <View style={[styles.checkbox, form.es_semanal ? { backgroundColor: Brand.green, borderColor: Brand.green } : { borderColor: theme.border }]}>
                {form.es_semanal && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={[styles.checkboxLabel, { color: theme.text }]}>
                Clase Semanal Fija (Se repite todas las semanas)
              </Text>
            </TouchableOpacity>

            {/* Enviar Notificación */}
            <TouchableOpacity 
              style={styles.checkboxRow}
              onPress={() => setEnviarNotificacion(!enviarNotificacion)}
            >
              <View style={[styles.checkbox, enviarNotificacion ? { backgroundColor: Brand.green, borderColor: Brand.green } : { borderColor: theme.border }]}>
                {enviarNotificacion && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={[styles.checkboxLabel, { color: theme.text }]}>
                Notificar a jugadores del mismo nivel ({form.categoria_target})
              </Text>
            </TouchableOpacity>

            {/* Save Button */}
            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: Brand.green }]} 
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Publicar Clase</Text>}
            </TouchableOpacity>
          </View>
        )}
        
      </ScrollView>

      <ConfirmModal
        visible={modalVisible}
        title={modalConfig.title}
        message={modalConfig.message}
        type="info"
        confirmText="Aceptar"
        onConfirm={() => {
          setModalVisible(false);
          if (modalConfig.shouldGoBack) router.back();
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.xxxl + Spacing.md,
    paddingBottom: Spacing.base,
    paddingHorizontal: Spacing.base,
  },
  backBtn: { padding: Spacing.xs, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  content: { padding: Spacing.xl, gap: Spacing.xl, paddingBottom: 100 },
  inputGroup: { gap: Spacing.xs },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 16,
    fontWeight: '600',
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: Radius.full,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', gap: Spacing.md },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkboxLabel: { fontSize: 14, fontWeight: '500' },
  saveBtn: {
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    shadowColor: Brand.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
