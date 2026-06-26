import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { Brand, Spacing, Radius, Shadow } from '@/constants/theme';
import CourtUpModal from '@/components/CourtUpModal';
import { ConfirmModal } from '@/components/confirm-modal';

type ClaseDisponible = {
  id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  deporte: string;
  categoria_target: string;
  cupo_maximo: number;
  precio_clase: number;
  cancha?: { nombre: string };
  reservas_clases?: { id: string, estado_pago: string }[];
};

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function AgendaScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [clases, setClases] = useState<ClaseDisponible[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [deudaAlquiler, setDeudaAlquiler] = useState(0);

  // Edit Modal States
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingClase, setEditingClase] = useState<ClaseDisponible | null>(null);
  const [editHoraInicio, setEditHoraInicio] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  
  type ConfirmState = {
    visible: boolean;
    title: string;
    message: string;
    type: 'info' | 'confirm';
    onConfirm?: () => void;
  };
  const [confirmConfig, setConfirmConfig] = useState<ConfirmState>({ visible: false, title: '', message: '', type: 'info' });

  const [weekStartDate, setWeekStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1);
    d.setHours(0,0,0,0);
    return d;
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + i);
    return d;
  });

  const prevWeek = () => {
    setWeekStartDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const nextWeek = () => {
    setWeekStartDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const fetchClases = useCallback(async () => {
    if (!user) return;
    
    const d = selectedDay;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    try {
      const { data } = await supabase
        .from('clases_disponibles')
        .select(`
          *,
          cancha:canchas(nombre_club, numero_cancha),
          reservas_clases(id, estado_pago)
        `)
        .eq('profesor_id', user.id)
        .eq('fecha', dateStr)
        .order('hora_inicio');

      if (data) setClases(data as any);

      // Fetch Deuda explícita de alquileres
      const { data: alquileres } = await supabase
        .from('alquileres_cancha')
        .select('monto_total, hora_inicio, hora_fin, cancha:canchas(precio_profesor_hora_dia, precio_hora_dia, precio_profesor_hora_noche, precio_hora_noche)')
        .eq('usuario_id', user.id)
        .eq('fecha', dateStr)
        .in('estado_pago', ['Pendiente', 'Aprobado']);
      
      let totalDeuda = 0;
      if (alquileres) {
        alquileres.forEach(alquiler => {
          let amount = Number(alquiler.monto_total) || 0;
          
          if (amount === 0 && alquiler.cancha) {
             const canchaInfo = alquiler.cancha as any;
             const precioProfDia = Number(canchaInfo.precio_profesor_hora_dia) || Number(canchaInfo.precio_hora_dia) || 0;
             const precioProfNoche = Number(canchaInfo.precio_profesor_hora_noche) || Number(canchaInfo.precio_hora_noche) || 0;
             
             const [hInicio, mInicio] = (alquiler.hora_inicio || '00:00').split(':').map(Number);
             const [hFin, mFin] = (alquiler.hora_fin || '00:00').split(':').map(Number);
             const startDecimal = hInicio + mInicio / 60;
             const endDecimal = hFin + mFin / 60;
             
             let horasDia = 0;
             let horasNoche = 0;
             const NIGHT_START = 18;

             if (startDecimal >= NIGHT_START) {
               horasNoche = endDecimal - startDecimal;
             } else if (endDecimal <= NIGHT_START) {
               horasDia = endDecimal - startDecimal;
             } else {
               horasDia = NIGHT_START - startDecimal;
               horasNoche = endDecimal - NIGHT_START;
             }
             amount = (horasDia * precioProfDia) + (horasNoche * precioProfNoche);
          }
          
          totalDeuda += amount;
        });
      }

      // Fetch Deuda implícita de clases del día
      const { data: clasesParaDeuda } = await supabase
        .from('clases_disponibles')
        .select('hora_inicio, hora_fin, cancha:canchas(precio_profesor_hora_dia, precio_hora_dia, precio_profesor_hora_noche, precio_hora_noche)')
        .eq('profesor_id', user.id)
        .eq('fecha', dateStr);

      if (clasesParaDeuda) {
        clasesParaDeuda.forEach(clase => {
          const canchaInfo = clase.cancha as any;
          if (canchaInfo) {
            const precioProfDia = Number(canchaInfo.precio_profesor_hora_dia) || Number(canchaInfo.precio_hora_dia) || 0;
            const precioProfNoche = Number(canchaInfo.precio_profesor_hora_noche) || Number(canchaInfo.precio_hora_noche) || 0;
            
            const [hInicio, mInicio] = (clase.hora_inicio || '00:00').split(':').map(Number);
            const [hFin, mFin] = (clase.hora_fin || '00:00').split(':').map(Number);
            const startDecimal = hInicio + mInicio / 60;
            const endDecimal = hFin + mFin / 60;
            
            let horasDia = 0;
            let horasNoche = 0;
            const NIGHT_START = 18;

            if (startDecimal >= NIGHT_START) {
              horasNoche = endDecimal - startDecimal;
            } else if (endDecimal <= NIGHT_START) {
              horasDia = endDecimal - startDecimal;
            } else {
              horasDia = NIGHT_START - startDecimal;
              horasNoche = endDecimal - NIGHT_START;
            }

            const montoCancha = (horasDia * precioProfDia) + (horasNoche * precioProfNoche);
            totalDeuda += montoCancha;
          }
        });
      }

      setDeudaAlquiler(totalDeuda);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, selectedDay]);

  useFocusEffect(
    useCallback(() => {
      fetchClases();
    }, [fetchClases])
  );

  const handleSaveEdit = async () => {
    if (!editingClase) return;
    
    const hasActiveStudents = editingClase.reservas_clases && editingClase.reservas_clases.some((r: any) => r.estado_pago !== 'Rechazado' && r.estado_pago !== 'Reembolsado');
    if (hasActiveStudents) {
      setEditModalVisible(false);
      setConfirmConfig({ visible: true, title: 'No permitido', message: 'No puedes modificar una clase que ya tiene alumnos inscriptos. El alumno debe darse de baja primero.', type: 'info', onConfirm: () => setConfirmConfig(prev => ({...prev, visible: false})) });
      return;
    }

    setSavingEdit(true);

    try {
      if (editHoraInicio === editingClase.hora_inicio.slice(0, 5)) {
        setEditModalVisible(false);
        setConfirmConfig({ visible: true, title: 'Sin cambios', message: 'No modificaste la hora de la clase.', type: 'info', onConfirm: () => setConfirmConfig(prev => ({...prev, visible: false})) });
        return;
      }

      const [h, m] = editHoraInicio.split(':').map(Number);
      const newStart = h + m / 60;
      const originalStart = parseInt(editingClase.hora_inicio.split(':')[0]) + parseInt(editingClase.hora_inicio.split(':')[1]) / 60;
      const originalEnd = parseInt(editingClase.hora_fin.split(':')[0]) + parseInt(editingClase.hora_fin.split(':')[1]) / 60;
      const dur = originalEnd - originalStart;
      const newEnd = newStart + dur;

      const { data: existingClasses } = await supabase
        .from('clases_disponibles')
        .select('id, hora_inicio, hora_fin, fecha, es_semanal')
        .eq('profesor_id', user?.id);

      if (existingClasses) {
        const targetDateObj = new Date(editingClase.fecha + 'T00:00:00');
        const targetDay = targetDateObj.getDay();

        const hasOverlap = existingClasses.some(c => {
          if (c.id === editingClase.id) return false;
          const classDateStr = c.fecha ? c.fecha.substring(0, 10) : '';
          let isSameDay = false;
          if (classDateStr === editingClase.fecha) isSameDay = true;
          else if (c.es_semanal) {
            const classStartDay = new Date(classDateStr + 'T00:00:00').getDay();
            if (classStartDay === targetDay && classDateStr <= editingClase.fecha) isSameDay = true;
          }

          if (isSameDay) {
            const [c_h, c_m] = c.hora_inicio.split(':').map(Number);
            const [c_eh, c_em] = c.hora_fin.split(':').map(Number);
            const classStart = c_h + c_m / 60;
            const classEnd = c_eh + c_em / 60;
            return newStart < classEnd && newEnd > classStart;
          }
          return false;
        });

        if (hasOverlap) {
          setConfirmConfig({ visible: true, title: 'Horario Superpuesto', message: 'Ya tienes otra clase en este horario, no puedes superponerla.', type: 'info', onConfirm: () => setConfirmConfig(prev => ({...prev, visible: false})) });
          setSavingEdit(false);
          return;
        }
      }

      const endHStr = Math.floor(newEnd).toString().padStart(2, '0');
      const endMStr = Math.round((newEnd % 1) * 60).toString().padStart(2, '0');
      
      const { data, error } = await supabase
        .from('clases_disponibles')
        .update({
          hora_inicio: `${editHoraInicio}:00`,
          hora_fin: `${endHStr}:${endMStr}:00`
        })
        .eq('id', editingClase.id)
        .select();

      if (error) {
        console.error('Error updating class:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        throw new Error('No se pudo actualizar la base de datos (0 filas modificadas).');
      }
      
      console.log('Update successful, data[0]:', JSON.stringify(data[0]));
      
      // Actualización local usando la respuesta real de la BD
      setClases(prev => prev.map(c => 
        c.id === editingClase.id 
          ? { ...c, ...data[0] } 
          : c
      ));

      setEditModalVisible(false);
      setConfirmConfig({ visible: true, title: '¡Actualizado!', message: 'El horario de la clase fue modificado correctamente.', type: 'info', onConfirm: () => setConfirmConfig(prev => ({...prev, visible: false})) });
    } catch (err: any) {
      setConfirmConfig({ visible: true, title: 'Error', message: err.message || 'No se pudo editar', type: 'info', onConfirm: () => setConfirmConfig(prev => ({...prev, visible: false})) });
    } finally {
      setSavingEdit(false);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (event?.type === 'set' && selectedTime) {
      const hStr = String(selectedTime.getHours()).padStart(2, '0');
      const mStr = String(selectedTime.getMinutes()).padStart(2, '0');
      setEditHoraInicio(`${hStr}:${mStr}`);
    }
  };

  const handleDeleteClase = async () => {
    if (!editingClase) return;

    const hasActiveStudents = editingClase.reservas_clases && editingClase.reservas_clases.some((r: any) => r.estado_pago !== 'Rechazado' && r.estado_pago !== 'Reembolsado');
    if (hasActiveStudents) {
      setEditModalVisible(false);
      setConfirmConfig({ visible: true, title: 'No permitido', message: 'No puedes eliminar una clase que ya tiene alumnos inscriptos. El alumno debe darse de baja primero.', type: 'info', onConfirm: () => setConfirmConfig(prev => ({...prev, visible: false})) });
      return;
    }

    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('clases_disponibles')
        .delete()
        .eq('id', editingClase.id);

      if (error) throw error;
      
      setEditModalVisible(false);
      setClases(prev => prev.filter(c => c.id !== editingClase.id));
      setConfirmConfig({ visible: true, title: '¡Clase Eliminada!', message: 'La clase ha sido eliminada correctamente.', type: 'info', onConfirm: () => setConfirmConfig(prev => ({...prev, visible: false})) });
    } catch (err: any) {
      setConfirmConfig({ visible: true, title: 'Error', message: err.message || 'No se pudo eliminar la clase', type: 'info', onConfirm: () => setConfirmConfig(prev => ({...prev, visible: false})) });
    } finally {
      setSavingEdit(false);
    }
  };

  // KPIs
  const totalClases = clases.length;
  const totalAlumnos = clases.reduce((acc, c) => acc + (c.reservas_clases?.filter(r => r.estado_pago !== 'Rechazado' && r.estado_pago !== 'Reembolsado').length || 0), 0);
  const totalCupos = clases.reduce((acc, c) => acc + (c.cupo_maximo || 0), 0);
  const ocupacion = totalCupos > 0 ? Math.round((totalAlumnos / totalCupos) * 100) : 0;
  const ganancias = clases.reduce((acc, c) => acc + ((c.reservas_clases?.filter(r => r.estado_pago !== 'Rechazado' && r.estado_pago !== 'Reembolsado').length || 0) * (c.precio_clase || 0)), 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerGreeting}>Hola, {user?.nombre} 👋</Text>
          <Text style={styles.headerTitle}>Mi Agenda</Text>
        </View>
        <TouchableOpacity 
          style={styles.nuevaClaseBtn}
          onPress={() => router.push('/(profesor)/nueva')}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.nuevaClaseText}>Nueva Clase</Text>
        </TouchableOpacity>
      </View>



      <View style={{ backgroundColor: '#0a0a0a', paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.sm }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
          {MESES[weekStartDate.getMonth()]} {weekStartDate.getFullYear()}
        </Text>
      </View>

      {/* Week selector */}
      <View style={[styles.weekRow, { backgroundColor: '#0a0a0a', borderBottomColor: '#1a1a1a', borderBottomWidth: 1 }]}>
        <TouchableOpacity onPress={prevWeek} style={styles.arrowBtn}>
          <Ionicons name="chevron-back" size={24} color="#9ca3af" />
        </TouchableOpacity>
        {weekDays.map((day, i) => {
          const isSelected = day.toDateString() === selectedDay.toDateString();
          const isToday = day.toDateString() === new Date().toDateString();
          return (
            <TouchableOpacity
              key={i}
              style={[styles.dayBtn, isSelected && { backgroundColor: Brand.green, borderRadius: Radius.md }]}
              onPress={() => setSelectedDay(day)}
            >
              <Text style={[styles.dayName, { color: isSelected ? '#fff' : '#9ca3af' }]}>
                {DIAS[day.getDay()]}
              </Text>
              <Text style={[styles.dayNum, { color: isSelected ? '#fff' : isToday ? Brand.green : '#fff' }]}>
                {day.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity onPress={nextWeek} style={styles.arrowBtn}>
          <Ionicons name="chevron-forward" size={24} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.green} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchClases(); }} tintColor={Brand.green} />
          }
        >
          <Text style={[styles.dateLabelText, { color: theme.textSecondary }]}>
            {DIAS[selectedDay.getDay()]}, {selectedDay.getDate()} de {MESES[selectedDay.getMonth()]}
          </Text>

          {/* Stats Cards */}
          <View style={[styles.statsRow, { flexWrap: 'wrap' }]}>
            <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border, width: '48%', marginBottom: Spacing.sm }]}>
              <View style={[styles.statIconWrap, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                <Ionicons name="people" size={20} color={Brand.green} />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{totalAlumnos} / {totalCupos}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Alumnos ({ocupacion}%)</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border, width: '48%', marginBottom: Spacing.sm }]}>
              <View style={[styles.statIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Ionicons name="wallet" size={20} color="#3b82f6" />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>${ganancias.toLocaleString('es-AR')}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Ganancias hoy</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border, width: '100%' }]}>
              <View style={[styles.statIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <Ionicons name="alert-circle" size={20} color="#ef4444" />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>${deudaAlquiler.toLocaleString('es-AR')}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Deuda Alquiler de Canchas</Text>
            </View>
          </View>

          {clases.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={48} color={theme.textMuted} style={{ marginBottom: 16 }} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No tenés clases este día</Text>
            </View>
          ) : (
            clases.map((clase) => {
              const inscriptos = (clase.reservas_clases?.filter(r => r.estado_pago !== 'Rechazado' && r.estado_pago !== 'Reembolsado') || []).length;
              const porcentaje = clase.cupo_maximo > 0 ? (inscriptos / clase.cupo_maximo) * 100 : 0;
              return (
                <TouchableOpacity
                  key={clase.id}
                  style={[styles.claseCard, { backgroundColor: theme.card, borderColor: theme.border }, Shadow.sm]}
                  onPress={() => router.push(`/(profesor)/clase/${clase.id}` as any)}
                >
                  {/* Edit Pencil & Delete */}
                  {(() => {
                    const now = new Date();
                    const [y, mo, d] = (clase.fecha || '').split('-').map(Number);
                    const [h, m] = (clase.hora_inicio || '00:00').split(':').map(Number);
                    const classDate = new Date(y, mo - 1, d, h, m, 0);
                    const canEdit = (classDate.getTime() - now.getTime()) > 5 * 60 * 1000;
                    if (!canEdit) return null;
                    return (
                      <View style={{ position: 'absolute', top: Spacing.sm, right: Spacing.sm, zIndex: 10, flexDirection: 'row', gap: Spacing.sm }}>
                        <TouchableOpacity 
                          style={{ padding: Spacing.xs, backgroundColor: theme.card, borderRadius: Radius.full, borderWidth: 1, borderColor: theme.border }}
                          onPress={(e) => {
                            e.stopPropagation();
                            setEditingClase(clase);
                            setConfirmConfig({
                              visible: true,
                              title: 'Eliminar Clase',
                              message: '¿Estás seguro que deseas eliminar esta clase? Esta acción no se puede deshacer.',
                              type: 'confirm',
                              onConfirm: () => {
                                setConfirmConfig(prev => ({ ...prev, visible: false }));
                                handleDeleteClase();
                              }
                            });
                          }}
                        >
                          <Ionicons name="trash-outline" size={16} color="#ef4444" />
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={{ padding: Spacing.xs, backgroundColor: theme.card, borderRadius: Radius.full, borderWidth: 1, borderColor: theme.border }}
                          onPress={(e) => {
                            e.stopPropagation();
                            setEditingClase(clase);
                            setEditHoraInicio(clase.hora_inicio.slice(0, 5));
                            setEditModalVisible(true);
                          }}
                        >
                          <Ionicons name="pencil" size={16} color={theme.textMuted} />
                        </TouchableOpacity>
                      </View>
                    );
                  })()}
                  <View style={[styles.claseHour, { backgroundColor: Brand.green + '15' }]}>
                    <Text style={[styles.claseHourText, { color: Brand.green }]}>
                      {clase.hora_inicio?.slice(0, 5)}
                    </Text>
                    <Text style={[styles.claseDur, { color: theme.textMuted }]}>
                      {clase.hora_fin?.slice(0, 5)}
                    </Text>
                  </View>
                  <View style={styles.claseInfo}>
                    <Text style={[styles.claseTitle, { color: theme.text }]}>
                      {clase.deporte?.charAt(0).toUpperCase() + clase.deporte?.slice(1)} — {clase.categoria_target}
                    </Text>
                    <Text style={[styles.claseCancha, { color: theme.textSecondary }]}>
                      📍 {((clase.cancha as any)?.nombre_club ? `${(clase.cancha as any)?.nombre_club} (C${(clase.cancha as any)?.numero_cancha})` : 'Sin cancha')} • ${clase.precio_clase}
                    </Text>
                    <View style={styles.cupoRow}>
                      <View style={[styles.cupoBar, { backgroundColor: theme.border }]}>
                        <View style={[styles.cupoFill, { width: `${porcentaje}%` as any, backgroundColor: porcentaje >= 80 ? '#ef4444' : Brand.green }]} />
                      </View>
                      <Text style={[styles.cupoText, { color: theme.textMuted }]}>
                        {inscriptos}/{clase.cupo_maximo}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Modal Edit Time */}
      <CourtUpModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        title="Editar Clase"
        position="center"
        height="auto"
      >
        <View style={{ paddingTop: Spacing.xs, gap: Spacing.xl }}>
          <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
            Modifica el horario. Solo permitido hasta 5 minutos antes del inicio.
          </Text>

          <View style={{ gap: Spacing.xs }}>
            <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '700' }}>Nueva Hora de Inicio</Text>
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, backgroundColor: theme.background, borderRadius: Radius.md, borderWidth: 1, borderColor: theme.border }}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{editHoraInicio}</Text>
              <Ionicons name="time-outline" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {showTimePicker && (
            <DateTimePicker
              value={(() => {
                const [h, m] = editHoraInicio.split(':');
                const d = new Date();
                d.setHours(parseInt(h || '10'), parseInt(m || '0'), 0, 0);
                return d;
              })()}
              mode="time"
              display="default"
              onChange={onTimeChange}
            />
          )}

          <TouchableOpacity 
            style={[styles.nuevaClaseBtn, { justifyContent: 'center', marginTop: Spacing.xs, paddingVertical: 14 }]}
            onPress={handleSaveEdit}
            disabled={savingEdit}
          >
            {savingEdit ? <ActivityIndicator color="#fff" /> : <Text style={styles.nuevaClaseText}>Guardar Horario</Text>}
          </TouchableOpacity>
        </View>
      </CourtUpModal>

      <ConfirmModal
        visible={confirmConfig.visible}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
        confirmText="Aceptar"
        onConfirm={() => confirmConfig.onConfirm ? confirmConfig.onConfirm() : setConfirmConfig(prev => ({...prev, visible: false}))}
        onCancel={() => setConfirmConfig(prev => ({...prev, visible: false}))}
      />
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
    paddingBottom: Spacing.base,
    paddingHorizontal: Spacing.xl,
  },
  headerGreeting: { color: '#9ca3af', fontSize: 14, marginBottom: 2 },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  nuevaClaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.green,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    gap: 4,
  },
  nuevaClaseText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  arrowBtn: { justifyContent: 'center', paddingHorizontal: Spacing.xs },
  dayBtn: { alignItems: 'center', paddingHorizontal: Spacing.xs, paddingVertical: Spacing.xs, minWidth: 38 },
  dayName: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  dayNum: { fontSize: 16, fontWeight: '700' },
  dateLabelText: { fontSize: 15, fontWeight: '700', marginBottom: Spacing.xs },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.base,
  },
  statIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statValue: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  statLabel: { fontSize: 12, fontWeight: '500' },
  claseCard: { flexDirection: 'row', borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  claseHour: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    gap: 2,
  },
  claseHourText: { fontSize: 14, fontWeight: '800' },
  claseDur: { fontSize: 11, fontWeight: '600' },
  claseInfo: { flex: 1, padding: Spacing.md, gap: Spacing.xs },
  claseTitle: { fontSize: 15, fontWeight: '700' },
  claseCancha: { fontSize: 12 },
  cupoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
  cupoBar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  cupoFill: { height: '100%', borderRadius: 2 },
  cupoText: { fontSize: 11, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: Spacing.xxxl, gap: Spacing.base },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15 },
  editBtnCard: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    padding: Spacing.xs,
    zIndex: 10,
    backgroundColor: '#ffffff00'
  }
});
