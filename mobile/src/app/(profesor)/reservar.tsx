import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { Brand, Spacing, Radius, Shadow } from '@/constants/theme';
import CourtUpModal from '@/components/CourtUpModal';
import { ConfirmModal } from '@/components/confirm-modal';

type Alquiler = {
  id: number;
  cancha_id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  monto_total: number;
  estado_pago: string;
  es_semanal: boolean;
  fecha_fin_recurrencia: string | null;
  cancha?: { numero_cancha: string, deporte: string, organizaciones: { nombre: string } };
};

export default function ReservarCanchaScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'mis_reservas' | 'reservar'>('mis_reservas');

  // --- Estados de Mis Reservas ---
  const [reservas, setReservas] = useState<Alquiler[]>([]);
  const [loadingReservas, setLoadingReservas] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterDate, setFilterDate] = useState<Date | null>(null);
  const [showFilterPicker, setShowFilterPicker] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ visible: false, title: '', message: '', type: 'info' as any, onConfirm: () => {} });

  // --- Estados de Reservar Cancha ---
  const [canchas, setCanchas] = useState<any[]>([]);
  const [clubes, setClubes] = useState<{ id: number, nombre: string }[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [loadingCanchas, setLoadingCanchas] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    organizacion_id: null as number | null,
    cancha_id: null as number | null,
    fecha: new Date(),
    hora_inicio: '10:00',
    hora_fin: '11:00',
    tipo_reserva: 'unica' as 'unica' | 'fija_semanal' | 'dias_especificos',
    dias_semana: [new Date().getDay()],
    fecha_fin_recurrencia: new Date(new Date().setMonth(new Date().getMonth() + 1)),
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState({ title: '', message: '', isSuccess: false });

  // --- Funciones de Mis Reservas ---
  const fetchReservas = useCallback(async () => {
    if (!user) return;
    setLoadingReservas(true);
    try {
      const hoy = new Date().toISOString().split('T')[0];
      let query = supabase
        .from('alquileres_cancha')
        .select(`
          id, cancha_id, fecha, hora_inicio, hora_fin, monto_total, estado_pago, es_semanal, fecha_fin_recurrencia,
          cancha:canchas(numero_cancha, deporte, organizaciones(nombre))
        `)
        .eq('usuario_id', user.id);
        
      if (filterDate) {
        // Ajustamos la fecha para evitar problemas de zona horaria al filtrar
        const y = filterDate.getFullYear();
        const m = String(filterDate.getMonth() + 1).padStart(2, '0');
        const d = String(filterDate.getDate()).padStart(2, '0');
        query = query.eq('fecha', `${y}-${m}-${d}`);
      } else {
        query = query.gte('fecha', hoy);
      }
      
      query = query.order('fecha', { ascending: true }).order('hora_inicio', { ascending: true });
        
      const { data } = await query;
      if (data) setReservas(data as any);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReservas(false);
      setRefreshing(false);
    }
  }, [user, filterDate]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'mis_reservas') {
        fetchReservas();
      }
    }, [fetchReservas, activeTab])
  );

  const handleCancelReserva = (id: number) => {
    setConfirmConfig({
      visible: true,
      title: 'Cancelar Reserva',
      message: '¿Estás seguro de que quieres cancelar esta reserva de cancha?',
      type: 'confirm',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, visible: false }));
        try {
          const { error } = await supabase.from('alquileres_cancha').delete().eq('id', id);
          if (error) throw error;
          fetchReservas();
        } catch (e: any) {
          Alert.alert('Error', 'No se pudo cancelar: ' + e.message);
        }
      }
    });
  };

  const renderReserva = ({ item }: { item: Alquiler }) => {
    const clubName = (item.cancha as any)?.organizaciones?.nombre || 'Club';
    return (
      <View style={[styles.reservaCard, { backgroundColor: theme.card, borderColor: theme.border }, Shadow.sm]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.dateText, { color: theme.text }]}>📅 {item.fecha}</Text>
          <Text style={[styles.statusText, { color: Brand.orange }]}>{item.estado_pago}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.timeText, { color: theme.text }]}>⏰ {item.hora_inicio.slice(0,5)} a {item.hora_fin.slice(0,5)}</Text>
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>📍 {clubName} - Cancha {item.cancha?.numero_cancha} ({item.cancha?.deporte})</Text>
        </View>
        <View style={styles.cardFooter}>
          <TouchableOpacity style={[styles.cancelBtn, { borderColor: '#ef4444' }]} onPress={() => handleCancelReserva(item.id)}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
            <Text style={styles.cancelBtnText}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // --- Funciones de Reservar Cancha ---
  const fetchCanchas = async () => {
    if (!user) return;
    const { data: userOrgs } = await supabase.from('miembros_organizacion').select('organizacion_id').eq('usuario_id', user.id);
    if (userOrgs && userOrgs.length > 0) {
      const orgIds = userOrgs.map((o: any) => o.organizacion_id);
      const { data: canchasData } = await supabase.from('canchas').select('*, organizaciones(nombre)').in('organizacion_id', orgIds).eq('activa', true).order('numero_cancha', { ascending: true });
      if (canchasData) {
        setCanchas(canchasData);
        const uniqueClubs = new Map();
        canchasData.forEach(c => {
          if (c.organizacion_id) {
            uniqueClubs.set(c.organizacion_id, { id: c.organizacion_id, nombre: (c.organizaciones as any)?.nombre || 'Sede ' + c.organizacion_id });
          }
        });
        const clubsArray = Array.from(uniqueClubs.values());
        setClubes(clubsArray);

        const canchasIds = canchasData.map(c => c.id);
        const { data: rentalsData } = await supabase.from('alquileres_cancha').select('cancha_id, hora_inicio, hora_fin, fecha, es_semanal, fecha_fin_recurrencia').in('cancha_id', canchasIds).in('estado_pago', ['Aprobado', 'Pendiente']);
        setRentals(rentalsData || []);

        if (clubsArray.length > 0 && form.organizacion_id === null) {
          const firstClubId = clubsArray[0].id;
          const firstCancha = canchasData.find(c => c.organizacion_id === firstClubId);
          setForm(prev => ({ ...prev, organizacion_id: firstClubId, cancha_id: firstCancha ? firstCancha.id : null }));
        }
      }
    }
    setLoadingCanchas(false);
  };

  useEffect(() => {
    if (activeTab === 'reservar') {
      fetchCanchas();
    }
  }, [user, activeTab]);

  const timeToMinutes = (t: string) => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const checkGeneratedOverlap = (canchaId: number) => {
    const endDate = form.tipo_reserva !== 'unica' ? new Date(form.fecha_fin_recurrencia) : new Date(form.fecha);
    let currentDate = new Date(form.fecha);
    while (currentDate <= endDate) {
      let shouldCheck = false;
      if (form.tipo_reserva === 'unica' || form.tipo_reserva === 'diaria') shouldCheck = true;
      else if (form.tipo_reserva === 'semanal') shouldCheck = form.dias_semana.includes(currentDate.getDay());

      if (shouldCheck) {
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const d = String(currentDate.getDate()).padStart(2, '0');
        const localDate = `${y}-${m}-${d}`;
        
        const isOccupied = rentals.some(r => {
          if (r.cancha_id !== canchaId) return false;
          const rDateStr = r.fecha instanceof Date ? r.fecha.toISOString().split('T')[0] : r.fecha;
          if (rDateStr !== localDate) return false;
          
          const pStart = timeToMinutes(form.hora_inicio);
          const pEnd = timeToMinutes(form.hora_fin);
          const rStart = timeToMinutes(r.hora_inicio);
          const rEnd = timeToMinutes(r.hora_fin);
          
          if (pStart >= rEnd || pEnd <= rStart) return false;
          return true;
        });
        
        if (isOccupied) return true;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return false;
  };

  const availableCanchas = canchas.filter(c => {
    if (c.organizacion_id !== form.organizacion_id) return false;
    return !checkGeneratedOverlap(c.id);
  });

  useEffect(() => {
    if (availableCanchas.length > 0) {
      const isStillAvailable = availableCanchas.some(c => c.id === form.cancha_id);
      if (!isStillAvailable) {
        setForm(prev => ({ ...prev, cancha_id: availableCanchas[0].id }));
      }
    } else {
      setForm(prev => ({ ...prev, cancha_id: null }));
    }
  }, [form.fecha, form.hora_inicio, form.hora_fin, form.tipo_reserva, form.dias_semana, form.fecha_fin_recurrencia, canchas, rentals]);

  const handleSaveReserva = async () => {
    if (!form.cancha_id) {
      setModalConfig({ title: 'Error', message: 'Selecciona una cancha', isSuccess: false });
      setModalVisible(true);
      return;
    }
    if (form.hora_inicio >= form.hora_fin) {
      setModalConfig({ title: 'Error', message: 'La hora de fin debe ser posterior a la de inicio', isSuccess: false });
      setModalVisible(true);
      return;
    }
    setSaving(true);
    try {
      const selectedCancha = canchas.find(c => c.id === form.cancha_id);
      
      const precioProfDia = Number(selectedCancha?.precio_profesor_hora_dia) || Number(selectedCancha?.precio_hora_dia) || 0;
      const precioProfNoche = Number(selectedCancha?.precio_profesor_hora_noche) || Number(selectedCancha?.precio_hora_noche) || 0;
      
      const [hInicio, mInicio] = form.hora_inicio.split(':').map(Number);
      const [hFin, mFin] = form.hora_fin.split(':').map(Number);
      const startDecimal = hInicio + mInicio / 60;
      const endDecimal = hFin + mFin / 60;
      
      let horasDia = 0;
      let horasNoche = 0;
      const NIGHT_START = 18; // 18:00 hs empieza tarifa nocturna

      if (startDecimal >= NIGHT_START) {
        horasNoche = endDecimal - startDecimal;
      } else if (endDecimal <= NIGHT_START) {
        horasDia = endDecimal - startDecimal;
      } else {
        horasDia = NIGHT_START - startDecimal;
        horasNoche = endDecimal - NIGHT_START;
      }

      const montoCalculado = (horasDia * precioProfDia) + (horasNoche * precioProfNoche);
      
      const insertData = [];
      const currentDate = new Date(form.fecha);
      const endDate = form.tipo_reserva !== 'unica' ? new Date(form.fecha_fin_recurrencia) : new Date(form.fecha);
      
      while (currentDate <= endDate) {
        let shouldInsert = false;
        let esFijaSemanal = false;
        
        if (form.tipo_reserva === 'unica') {
          shouldInsert = true;
        } else if (form.tipo_reserva === 'dias_especificos') {
          shouldInsert = form.dias_semana.includes(currentDate.getDay());
        } else if (form.tipo_reserva === 'fija_semanal') {
          // Si es fija semanal, verificamos que sea el mismo día de la semana que el día original de la fecha
          const originalDay = new Date(form.fecha + 'T12:00:00').getDay();
          shouldInsert = currentDate.getDay() === originalDay;
          esFijaSemanal = true;
        }

        if (shouldInsert) {
          const y = currentDate.getFullYear();
          const m = String(currentDate.getMonth() + 1).padStart(2, '0');
          const d = String(currentDate.getDate()).padStart(2, '0');
          insertData.push({
            cancha_id: form.cancha_id,
            usuario_id: user?.id,
            fecha: `${y}-${m}-${d}`,
            hora_inicio: form.hora_inicio,
            hora_fin: form.hora_fin,
            monto_total: montoCalculado, 
            comision_plataforma: 0,
            monto_neto_club: montoCalculado,
            estado_pago: 'Pendiente',
            es_semanal: esFijaSemanal,
            fecha_fin_recurrencia: form.tipo_reserva !== 'unica' ? form.fecha_fin_recurrencia.toISOString().split('T')[0] : null
          });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      const { error } = await supabase.from('alquileres_cancha').insert(insertData);
      if (error) throw error;
      
      setModalConfig({ title: 'Éxito', message: 'Reserva creada correctamente', isSuccess: true });
      await fetchCanchas();
      setModalVisible(true);
    } catch (error: any) {
      setModalConfig({ title: 'Error', message: error.message || 'Error al guardar', isSuccess: false });
      setModalVisible(true);
    } finally {
      setSaving(false);
    }
  };

  const getStartTimeDate = () => {
    const d = new Date(form.fecha);
    const [h, m] = form.hora_inicio.split(':');
    d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    return d;
  };
  const getEndTimeDate = () => {
    const d = new Date(form.fecha);
    const [h, m] = form.hora_fin.split(':');
    d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    return d;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <Text style={styles.headerTitle}>Canchas</Text>
      </View>

      <View style={styles.tabsWrap}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'mis_reservas' && { backgroundColor: Brand.orange }]}
          onPress={() => setActiveTab('mis_reservas')}
        >
          <Text style={[styles.tabText, activeTab === 'mis_reservas' ? { color: '#fff', fontWeight: 'bold' } : { color: theme.textSecondary }]}>Mis Reservas</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'reservar' && { backgroundColor: Brand.orange }]}
          onPress={() => setActiveTab('reservar')}
        >
          <Text style={[styles.tabText, activeTab === 'reservar' ? { color: '#fff', fontWeight: 'bold' } : { color: theme.textSecondary }]}>Reservar Cancha</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'mis_reservas' && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
            {filterDate && (
              <TouchableOpacity style={{ marginRight: 16 }} onPress={() => setFilterDate(null)}>
                <Text style={{ color: '#ef4444', fontWeight: '600' }}>Limpiar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[styles.dateBtn, { borderColor: theme.border, padding: 8 }]} 
              onPress={() => setShowFilterPicker(true)}
            >
              <Ionicons name="filter-outline" size={16} color={theme.text} />
              <Text style={{ color: theme.text }}>{filterDate ? filterDate.toLocaleDateString() : 'Filtrar Fecha'}</Text>
            </TouchableOpacity>
          </View>
          
          {showFilterPicker && (
            <DateTimePicker
              value={filterDate || new Date()}
              mode="date"
              onChange={(_, date) => {
                setShowFilterPicker(false);
                if (date) setFilterDate(date);
              }}
            />
          )}

          {loadingReservas ? (
            <ActivityIndicator size="large" color={Brand.orange} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={reservas}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderReserva}
              contentContainerStyle={{ padding: Spacing.base, gap: Spacing.md, paddingBottom: 100 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReservas(); }} tintColor={Brand.orange} />}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', marginTop: 60 }}>
                  <Ionicons name="calendar-outline" size={48} color={theme.textMuted} style={{ marginBottom: 16 }} />
                  <Text style={{ fontSize: 15, color: theme.textSecondary }}>No tienes reservas para mostrar.</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {activeTab === 'reservar' && (
        <ScrollView contentContainerStyle={styles.content}>
          {loadingCanchas ? <ActivityIndicator color={Brand.orange} /> : (
            <>
              {clubes.length > 0 && (
                <View style={[styles.section, { backgroundColor: theme.card }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Sede / Club</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {clubes.map(club => (
                      <TouchableOpacity
                        key={club.id}
                        style={[styles.chip, form.organizacion_id === club.id ? styles.chipActive : { backgroundColor: theme.backgroundElement }]}
                        onPress={() => {
                          const firstCancha = canchas.find(c => c.organizacion_id === club.id);
                          setForm(prev => ({ ...prev, organizacion_id: club.id, cancha_id: firstCancha ? firstCancha.id : null }));
                        }}
                      >
                        <Text style={[styles.chipText, form.organizacion_id === club.id ? styles.chipTextActive : { color: theme.text }]}>{club.nombre}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={[styles.section, { backgroundColor: theme.card }]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Cancha</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {availableCanchas.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.chip, form.cancha_id === c.id ? styles.chipActive : { backgroundColor: theme.backgroundElement }]}
                      onPress={() => setForm({ ...form, cancha_id: c.id })}
                    >
                      <Text style={[styles.chipText, form.cancha_id === c.id ? styles.chipTextActive : { color: theme.text }]}>Cancha {c.numero_cancha} ({c.deporte})</Text>
                    </TouchableOpacity>
                  ))}
                  {availableCanchas.length === 0 && <Text style={{ color: theme.textSecondary, marginLeft: 8 }}>No hay canchas libres en este horario.</Text>}
                </ScrollView>
                {form.cancha_id && availableCanchas.find(c => c.id === form.cancha_id) && (
                  <View style={{ marginTop: 12, padding: 12, backgroundColor: theme.background, borderRadius: 8 }}>
                    <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 4 }}>
                      Precio Día (sin luz): <Text style={{ color: theme.text, fontWeight: 'bold' }}>${availableCanchas.find(c => c.id === form.cancha_id)?.precio_profesor_hora_dia || availableCanchas.find(c => c.id === form.cancha_id)?.precio_hora_dia || 0} / hr</Text>
                    </Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                      Precio Noche (con luz): <Text style={{ color: theme.text, fontWeight: 'bold' }}>${availableCanchas.find(c => c.id === form.cancha_id)?.precio_profesor_hora_noche || availableCanchas.find(c => c.id === form.cancha_id)?.precio_hora_noche || 0} / hr</Text>
                    </Text>
                  </View>
                )}
              </View>

              <View style={[styles.section, { backgroundColor: theme.card }]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Fecha Inicial</Text>
                <TouchableOpacity style={[styles.dateBtn, { borderColor: theme.border }]} onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={20} color={theme.text} />
                  <Text style={{ color: theme.text }}>{form.fecha.toLocaleDateString()}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker value={form.fecha} mode="date" onChange={(_, date) => { setShowDatePicker(false); if (date) setForm({ ...form, fecha: date }); }} />
                )}
              </View>

              <View style={[styles.row, { gap: 16 }]}>
                <View style={[styles.section, { flex: 1, backgroundColor: theme.card }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Desde</Text>
                  <TouchableOpacity style={[styles.dateBtn, { borderColor: theme.border }]} onPress={() => setShowStartTimePicker(true)}>
                    <Ionicons name="time-outline" size={20} color={theme.text} />
                    <Text style={{ color: theme.text, fontSize: 16 }}>{form.hora_inicio}</Text>
                  </TouchableOpacity>
                  {showStartTimePicker && (
                    <DateTimePicker value={getStartTimeDate()} mode="time" display="default" onChange={(_, date) => {
                      setShowStartTimePicker(false);
                      if (date) {
                        const hs = String(date.getHours()).padStart(2, '0');
                        const ms = String(date.getMinutes()).padStart(2, '0');
                        setForm({ ...form, hora_inicio: `${hs}:${ms}` });
                      }
                    }} />
                  )}
                </View>
                <View style={[styles.section, { flex: 1, backgroundColor: theme.card }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Hasta</Text>
                  <TouchableOpacity style={[styles.dateBtn, { borderColor: theme.border }]} onPress={() => setShowEndTimePicker(true)}>
                    <Ionicons name="time-outline" size={20} color={theme.text} />
                    <Text style={{ color: theme.text, fontSize: 16 }}>{form.hora_fin}</Text>
                  </TouchableOpacity>
                  {showEndTimePicker && (
                    <DateTimePicker value={getEndTimeDate()} mode="time" display="default" onChange={(_, date) => {
                      setShowEndTimePicker(false);
                      if (date) {
                        const hs = String(date.getHours()).padStart(2, '0');
                        const ms = String(date.getMinutes()).padStart(2, '0');
                        setForm({ ...form, hora_fin: `${hs}:${ms}` });
                      }
                    }} />
                  )}
                </View>
              </View>

              <View style={[styles.section, { backgroundColor: theme.card, gap: Spacing.sm }]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Tipo de Reserva</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {(['unica', 'fija_semanal', 'dias_especificos'] as const).map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.chip, form.tipo_reserva === t ? styles.chipActive : { backgroundColor: theme.backgroundElement }]}
                      onPress={() => setForm({ ...form, tipo_reserva: t })}
                    >
                      <Text style={[styles.chipText, form.tipo_reserva === t ? styles.chipTextActive : { color: theme.text }]}>
                        {t === 'unica' ? 'Una vez' : t === 'fija_semanal' ? 'Fija Semanal' : 'Días específicos'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {form.tipo_reserva === 'dias_especificos' && (
                <View style={[styles.section, { backgroundColor: theme.card, gap: Spacing.sm }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Días de la Semana</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    {[{l:'D', v:0}, {l:'L', v:1}, {l:'M', v:2}, {l:'M', v:3}, {l:'J', v:4}, {l:'V', v:5}, {l:'S', v:6}].map(d => {
                      const isSelected = form.dias_semana.includes(d.v);
                      return (
                        <TouchableOpacity
                          key={d.v}
                          style={[styles.dayCircle, isSelected ? { backgroundColor: Brand.orange, borderColor: Brand.orange } : { borderColor: theme.border }]}
                          onPress={() => {
                            setForm(prev => {
                              const ds = prev.dias_semana.includes(d.v) ? prev.dias_semana.filter(x => x !== d.v) : [...prev.dias_semana, d.v];
                              return { ...prev, dias_semana: ds };
                            })
                          }}
                        >
                          <Text style={[styles.dayCircleText, isSelected ? { color: '#fff' } : { color: theme.text }]}>{d.l}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {form.tipo_reserva !== 'unica' && (
                <View style={[styles.section, { backgroundColor: theme.card }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Fecha Fin (Límite)</Text>
                  <TouchableOpacity style={[styles.dateBtn, { borderColor: theme.border }]} onPress={() => setShowEndDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={20} color={theme.text} />
                    <Text style={{ color: theme.text }}>{form.fecha_fin_recurrencia.toLocaleDateString()}</Text>
                  </TouchableOpacity>
                  {showEndDatePicker && (
                    <DateTimePicker value={form.fecha_fin_recurrencia} mode="date" onChange={(_, date) => { setShowEndDatePicker(false); if (date) setForm({ ...form, fecha_fin_recurrencia: date }); }} />
                  )}
                </View>
              )}

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveReserva} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Confirmar Reserva</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}

      <CourtUpModal
        visible={modalVisible}
        title={modalConfig.title}
        onClose={() => { setModalVisible(false); if (modalConfig.isSuccess) setActiveTab('mis_reservas'); }}
        height={320}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }}>
          <Ionicons name={modalConfig.isSuccess ? "checkmark-circle" : "alert-circle"} size={70} color={modalConfig.isSuccess ? Brand.green : Brand.orange} style={{ marginBottom: Spacing.lg }} />
          <Text style={{ color: theme.text, fontSize: 16, textAlign: 'center', marginBottom: Spacing.xxl }}>{modalConfig.message}</Text>
          <TouchableOpacity style={[styles.saveBtn, { width: '100%', marginBottom: Spacing.xl }]} onPress={() => { setModalVisible(false); if (modalConfig.isSuccess) setActiveTab('mis_reservas'); }}>
            <Text style={styles.saveBtnText}>OK</Text>
          </TouchableOpacity>
        </View>
      </CourtUpModal>

      <ConfirmModal
        visible={confirmConfig.visible}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
        confirmText="Confirmar"
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: Spacing.xxxl + Spacing.xl, paddingBottom: Spacing.sm, paddingHorizontal: Spacing.xl },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },
  tabsWrap: { flexDirection: 'row', paddingHorizontal: Spacing.base, marginBottom: Spacing.md, gap: Spacing.sm },
  tab: { flex: 1, paddingVertical: 10, borderRadius: Radius.full, alignItems: 'center', backgroundColor: '#333' },
  tabText: { fontSize: 13, fontWeight: '600' },
  content: { padding: Spacing.base, gap: Spacing.md, paddingBottom: 100 },
  section: { padding: Spacing.base, borderRadius: Radius.lg },
  label: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.sm },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, marginRight: 8 },
  chipActive: { backgroundColor: Brand.orange },
  chipText: { fontSize: 14 },
  chipTextActive: { color: '#fff', fontWeight: 'bold' },
  dayCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircleText: { fontSize: 14, fontWeight: '600' },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, borderRadius: Radius.md },
  row: { flexDirection: 'row' },
  saveBtn: { backgroundColor: Brand.orange, padding: 16, borderRadius: Radius.md, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  reservaCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.base },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  dateText: { fontSize: 16, fontWeight: '700' },
  statusText: { fontSize: 13, fontWeight: '700' },
  cardBody: { gap: 4, marginBottom: Spacing.md },
  timeText: { fontSize: 15, fontWeight: '600' },
  infoText: { fontSize: 14 },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: '#333', paddingTop: Spacing.sm },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1 },
  cancelBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
});
