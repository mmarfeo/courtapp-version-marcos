import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  ScrollView,
  StatusBar,
  Linking,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { Brand, Spacing, Radius, Shadow } from '@/constants/theme';
import { ConfirmModal } from '@/components/confirm-modal';

type Cancha = {
  id: number;
  organizacion_id: number;
  nombre_club: string;
  numero_cancha: number;
  superficie: string;
  deporte: string;
  activa: boolean;
  precio_hora_dia: number;
  precio_hora_noche: number;
  hora_inicio_noche: string;
  organizacion?: {
    nombre: string;
  };
};

type Alquiler = {
  cancha_id: number;
  hora_inicio: string;
  hora_fin: string;
  fecha: string;
  es_semanal?: boolean;
  fecha_fin_recurrencia?: string | null;
};

const getWeekdayUTC = (dateStr: string) => {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return d.getUTCDay();
};

const START_TIMES = [
  '08:00:00', '08:30:00', '09:00:00', '09:30:00', '10:00:00', '10:30:00', '11:00:00', '11:30:00',
  '12:00:00', '12:30:00', '14:00:00', '14:30:00', '15:00:00', '15:30:00', '16:00:00', '16:30:00',
  '17:00:00', '17:30:00', '18:00:00', '18:30:00', '19:00:00', '19:30:00', '20:00:00', '20:30:00',
  '21:00:00', '21:30:00', '22:00:00'
];

const DURATIONS = [
  { label: '60m', value: 60 },
  { label: '90m', value: 90 },
  { label: '120m', value: 120 },
];

export default function AlquilerCanchasScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'alquilar' | 'mis_alquileres'>('alquilar');
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [rentals, setRentals] = useState<Alquiler[]>([]);
  const [misAlquileres, setMisAlquileres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedSport, setSelectedSport] = useState<string | null>(null);

  const [dates, setDates] = useState<{ label: string; dateStr: string; dayName: string }[]>([]);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [confirmStartTime, setConfirmStartTime] = useState<string>('18:00:00');
  const [selectedDuration, setSelectedDuration] = useState(90);
  const [esSemanal, setEsSemanal] = useState(false);

  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const minutesToTime = (m: number) => {
    const h = Math.floor(m / 60);
    const mins = m % 60;
    return `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
  };

  const calculatePriceForTime = (cancha: Cancha, startTime: string) => {
    const startMins = timeToMinutes(startTime);
    const endMins = startMins + selectedDuration;
    const nightStartMins = timeToMinutes(cancha.hora_inicio_noche);

    let dayMins = 0;
    let nightMins = 0;

    if (endMins <= nightStartMins) {
      dayMins = selectedDuration;
    } else if (startMins >= nightStartMins) {
      nightMins = selectedDuration;
    } else {
      dayMins = nightStartMins - startMins;
      nightMins = endMins - nightStartMins;
    }

    return (dayMins / 60) * cancha.precio_hora_dia + (nightMins / 60) * cancha.precio_hora_noche;
  };

  useEffect(() => {
    const days = [];
    const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dayName = i === 0 ? 'Hoy' : weekdays[d.getDay()];
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = `${d.getDate()} ${d.toLocaleString('es-AR', { month: 'short' }).replace('.', '')}`;
      days.push({ label, dateStr, dayName });
    }
    setDates(days);
  }, []);

  const fetchData = useCallback(async () => {
    if (dates.length === 0) return;
    try {
      const activeDate = dates[selectedDateIndex].dateStr;
      
      const { data: canchasData, error: canchasError } = await supabase
        .from('canchas')
        .select('*, organizacion:organizaciones(nombre)')
        .eq('activa', true);

      if (canchasError) throw canchasError;

      const [
        { data: rentalsData, error: rentalsError },
        { data: clasesData, error: clasesError }
      ] = await Promise.all([
        supabase
          .from('alquileres_cancha')
          .select('cancha_id, hora_inicio, hora_fin, fecha, es_semanal, fecha_fin_recurrencia')
          .or(`fecha.eq.${activeDate},es_semanal.eq.true`)
          .in('estado_pago', ['Aprobado', 'Pendiente']),
        supabase
          .from('clases_disponibles')
          .select('cancha_id, hora_inicio, hora_fin, fecha, es_semanal')
          .or(`fecha.eq.${activeDate},es_semanal.eq.true`)
          .eq('activa', true)
      ]);

      if (rentalsError) throw rentalsError;
      if (clasesError) throw clasesError;

      const combined = [
        ...(rentalsData || []),
        ...(clasesData || []).map((c: any) => ({
          ...c,
          fecha_fin_recurrencia: null,
          estado_pago: 'Aprobado'
        }))
      ];

      setCanchas(canchasData || []);
      setRentals(combined);

      // Cargar mis alquileres
      if (user) {
        const { data: myRentals, error: myRentalsError } = await supabase
          .from('alquileres_cancha')
          .select('id, fecha, hora_inicio, hora_fin, monto_total, estado_pago, es_semanal, cancha:canchas(numero_cancha, deporte, superficie, nombre_club, organizaciones(nombre))')
          .eq('usuario_id', user.id)
          .order('fecha', { ascending: false })
          .order('hora_inicio', { ascending: false });

        if (myRentalsError) throw myRentalsError;
        setMisAlquileres(myRentals || []);
      }
    } catch (e) {
      console.error('Error fetching courts/rentals:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dates, selectedDateIndex, user]);

  const handleCancelRental = async (rentalId: number) => {
    Alert.alert(
      'Cancelar Alquiler',
      '¿Estás seguro de que deseas cancelar esta reserva de cancha?',
      [
        { text: 'Atrás', style: 'cancel' },
        {
          text: 'Confirmar Cancelación',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { data } = await supabase.auth.getSession();
              const token = data.session?.access_token;
              if (!token) throw new Error('Sesión no encontrada');

              const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://courtup-web.vercel.app';
              const res = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/canchas/cancelar`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ alquiler_id: rentalId }),
              });

              const resData = await res.json();
              if (!res.ok) throw new Error(resData.error || 'Error al cancelar');

              Alert.alert('Reserva Cancelada', resData.mensaje || 'Tu reserva fue cancelada con éxito.');
              fetchData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo cancelar el alquiler.');
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const isFutureRental = (fecha: string, horaInicio: string) => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      if (fecha > todayStr) return true;
      if (fecha === todayStr) {
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const [h, m] = horaInicio.split(':').map(Number);
        const startMins = h * 60 + m;
        return startMins > currentMins;
      }
      return false;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const isTimeSlotRented = (canchaId: number, startMins: number, endMins: number, activeDateStr: string) => {
    const activeDay = getWeekdayUTC(activeDateStr);
    return rentals.some((rental) => {
      if (rental.cancha_id !== canchaId) return false;
      let matchesDate = false;
      if (rental.es_semanal) {
        const rentalDay = getWeekdayUTC(rental.fecha);
        const withinRecurrence = (
          activeDateStr >= rental.fecha &&
          (!rental.fecha_fin_recurrencia || activeDateStr <= rental.fecha_fin_recurrencia)
        );
        matchesDate = (activeDay === rentalDay && withinRecurrence);
      } else {
        matchesDate = (rental.fecha === activeDateStr);
      }
      if (!matchesDate) return false;
      const rStart = timeToMinutes(rental.hora_inicio);
      const rEnd = timeToMinutes(rental.hora_fin);
      return (startMins < rEnd && endMins > rStart);
    });
  };

  const groupedCanchas = useMemo(() => {
    const activeDateStr = dates[selectedDateIndex]?.dateStr;
    if (!activeDateStr) return [];

    const filtered = canchas.filter((cancha) => {
      const clubName = cancha.organizacion?.nombre || cancha.nombre_club || '';
      const matchesSearch =
        clubName.toLowerCase().includes(search.toLowerCase()) ||
        cancha.superficie?.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;
      if (selectedSport && cancha.deporte.toLowerCase() !== selectedSport.toLowerCase()) return false;
      return true;
    });

    const groups: { [key: string]: { clubName: string; canchas: any[] } } = {};
    
    filtered.forEach(cancha => {
      const clubName = cancha.organizacion?.nombre || cancha.nombre_club || 'Sin Club';
      if (!groups[clubName]) {
        groups[clubName] = { clubName, canchas: [] };
      }
      
      const availableSlots = START_TIMES.filter(time => {
        const startMins = timeToMinutes(time);
        const endMins = startMins + selectedDuration;
        return !isTimeSlotRented(cancha.id, startMins, endMins, activeDateStr);
      });

      if (availableSlots.length > 0) {
        groups[clubName].canchas.push({ ...cancha, availableSlots });
      }
    });

    const result = Object.values(groups).filter(g => g.canchas.length > 0);
    result.forEach(g => {
      g.canchas.sort((a, b) => a.numero_cancha - b.numero_cancha);
    });
    return result;
  }, [canchas, search, selectedSport, selectedDuration, dates, selectedDateIndex, rentals]);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [selectedCancha, setSelectedCancha] = useState<Cancha | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  const handleBookCancha = (cancha: Cancha, startTime: string) => {
    setSelectedCancha(cancha);
    setConfirmStartTime(startTime);
    setConfirmVisible(true);
  };

  const confirmBooking = async () => {
    if (!user || !selectedCancha) return;
    const activeDate = dates[selectedDateIndex];
    const price = calculatePriceForTime(selectedCancha, confirmStartTime);
    const startTimeMins = timeToMinutes(confirmStartTime);
    const endTimeMins = startTimeMins + selectedDuration;

    setBookingLoading(true);
    try {
      const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://courtup-web.vercel.app';
      const endpointUrl = `${apiBaseUrl.replace(/\/$/, '')}/api/pagos/alquiler`;
      const webhookUrl = `${apiBaseUrl.replace(/\/$/, '')}/api/webhooks/mercadopago`;

      const res = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cancha_id: selectedCancha.id,
          fecha: activeDate.dateStr,
          hora_inicio: minutesToTime(startTimeMins),
          duracion_minutos: selectedDuration,
          usuario_id: user.id,
          webhook_url: webhookUrl,
          success_url: 'courtup://',
          es_semanal: esSemanal,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar el pago y reserva.');
      }

      setConfirmVisible(false);
      
      if (data.init_point) {
        Linking.openURL(data.init_point);
      } else {
        Alert.alert('Reserva iniciada', 'Por favor abona en la recepción del club para confirmar.');
      }
      
      fetchData();
    } catch (err: any) {
      console.error('Error reserving court:', err);
      Alert.alert('Error al reservar', err.message || 'No se pudo completar el alquiler.');
    } finally {
      setBookingLoading(false);
    }
  };

  const isDark = scheme === 'dark';

  const listData = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const upcoming = misAlquileres.filter(r => r.fecha >= todayStr && r.estado_pago !== 'Rechazado');
    const past = misAlquileres.filter(r => r.fecha < todayStr || r.estado_pago === 'Rechazado');

    const items = [];
    if (upcoming.length > 0) {
      items.push({ type: 'header', key: 'head_upcoming', title: '📅 Próximos Alquileres' });
      upcoming.forEach(r => items.push({ type: 'rental', key: `rent_${r.id}`, data: r }));
    }
    if (past.length > 0) {
      items.push({ type: 'header', key: 'head_past', title: '🕒 Historial de Alquileres' });
      past.forEach(r => items.push({ type: 'rental', key: `rent_${r.id}`, data: r, isPast: true }));
    }
    return items;
  }, [misAlquileres]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      <View style={[styles.header, { backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Alquileres</Text>
      </View>

      {/* Segmented Tab Selector */}
      <View style={[styles.tabBarContainer, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'alquilar' && { borderBottomColor: Brand.green }]}
          onPress={() => setActiveTab('alquilar')}
        >
          <Text style={[styles.tabText, activeTab === 'alquilar' ? { color: Brand.green, fontWeight: '700' } : { color: theme.textSecondary }]}>
            Alquilar Cancha
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'mis_alquileres' && { borderBottomColor: Brand.green }]}
          onPress={() => setActiveTab('mis_alquileres')}
        >
          <Text style={[styles.tabText, activeTab === 'mis_alquileres' ? { color: Brand.green, fontWeight: '700' } : { color: theme.textSecondary }]}>
            Mis Alquileres
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'alquilar' ? (
        <>
          <View style={{ backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: Spacing.md }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysContainer}>
              {dates.map((item, index) => {
                const isSelected = selectedDateIndex === index;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.dayCard, isSelected ? { backgroundColor: Brand.green } : { backgroundColor: theme.backgroundElement }]}
                    onPress={() => { setSelectedDateIndex(index); setLoading(true); }}
                  >
                    <Text style={[styles.dayName, { color: isSelected ? '#fff' : theme.textSecondary }]}>{item.dayName}</Text>
                    <Text style={[styles.dayLabel, { color: isSelected ? '#fff' : theme.text }]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.selectorsContainer}>
              <View style={styles.durationsContainer}>
                {DURATIONS.map((dur) => (
                  <TouchableOpacity
                    key={dur.value}
                    style={[styles.durationBtn, selectedDuration === dur.value ? { backgroundColor: Brand.blue } : { backgroundColor: theme.backgroundElement }]}
                    onPress={() => setSelectedDuration(dur.value)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: selectedDuration === dur.value ? '#fff' : theme.textSecondary }}>{dur.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {user?.role === 'profesor' && (
                <TouchableOpacity
                  style={styles.recurrentRow}
                  onPress={() => setEsSemanal(!esSemanal)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.checkbox,
                    esSemanal ? { backgroundColor: Brand.orange, borderColor: Brand.orange } : { borderColor: theme.border }
                  ]}>
                    {esSemanal && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </View>
                  <Text style={[styles.recurrentLabel, { color: theme.text }]}>
                    Alquiler Semanal Fijo
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={[styles.filtersSection, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <View style={[styles.searchBar, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Ionicons name="search-outline" size={18} color={theme.textMuted} />
              <TextInput placeholder="Buscar por club..." placeholderTextColor={theme.textMuted} style={[styles.searchInput, { color: theme.text }]} value={search} onChangeText={setSearch} />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.quickFilters}>
              {['Todos', 'Tenis', 'Padel'].map(sport => {
                const isSel = sport === 'Todos' ? selectedSport === null : selectedSport === sport;
                return (
                  <TouchableOpacity
                    key={sport}
                    style={[styles.filterTab, isSel && { backgroundColor: Brand.green + '20', borderColor: Brand.green }, { borderColor: theme.border }]}
                    onPress={() => setSelectedSport(sport === 'Todos' ? null : sport)}
                  >
                    <Text style={[styles.filterTabText, { color: isSel ? Brand.green : theme.textSecondary }]}>
                      {sport === 'Tenis' ? '🎾 Tenis' : sport === 'Padel' ? '🏓 Padel' : 'Todos'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={Brand.green} />
            </View>
          ) : (
            <FlatList
              data={groupedCanchas}
              keyExtractor={(item) => item.clubName}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.green} />}
              renderItem={({ item: club }) => (
                <View style={styles.clubSection}>
                  <Text style={[styles.clubSectionTitle, { color: theme.text }]}>🏢 {club.clubName}</Text>
                  {club.canchas.map((cancha: any) => (
                    <View key={cancha.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, Shadow.sm]}>
                      <View style={styles.cardHeader}>
                        <View>
                          <Text style={[styles.canchaDetails, { color: theme.text }]}>Cancha {cancha.numero_cancha} · {cancha.deporte}</Text>
                          <Text style={[styles.canchaSurface, { color: theme.textMuted }]}>Superficie: {cancha.superficie || 'Standard'}</Text>
                        </View>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotsContainer}>
                        {cancha.availableSlots.map((time: string) => (
                          <TouchableOpacity 
                            key={time} 
                            style={[styles.timeSlotBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
                            onPress={() => handleBookCancha(cancha, time)}
                          >
                            <Text style={[styles.timeSlotText, { color: theme.text }]}>{time.substring(0, 5)}</Text>
                            <Text style={[styles.timeSlotPrice, { color: Brand.orange }]}>${calculatePriceForTime(cancha, time).toLocaleString('es-AR')}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  ))}
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="calendar-outline" size={48} color={theme.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No hay canchas disponibles.</Text>
                </View>
              }
            />
          )}
        </>
      ) : (
        /* Tab: Mis Alquileres */
        loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Brand.green} />
          </View>
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.green} />}
            renderItem={({ item }) => {
              if (item.type === 'header') {
                return (
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '800',
                    color: theme.text,
                    marginTop: Spacing.md,
                    marginBottom: Spacing.sm,
                    marginLeft: Spacing.xs,
                  }}>
                    {item.title}
                  </Text>
                );
              }

              const { data: rental, isPast } = item;
              return (
                <View style={[
                  styles.card,
                  { backgroundColor: theme.card, borderColor: theme.border },
                  isPast && { opacity: 0.65 },
                  Shadow.sm
                ]}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.canchaDetails, { color: theme.text }]}>
                        Cancha {rental.cancha?.numero_cancha} · {rental.cancha?.deporte}
                      </Text>
                      <Text style={[styles.canchaSurface, { color: theme.textMuted, marginTop: 2 }]} numberOfLines={1}>
                        🏢 {rental.cancha?.organizaciones?.nombre || rental.cancha?.nombre_club || 'Sin Club'}
                      </Text>
                    </View>
                    <View style={[
                      styles.statusBadge,
                      rental.estado_pago === 'Aprobado' && { backgroundColor: Brand.green + '20', borderColor: Brand.green },
                      rental.estado_pago === 'Pendiente' && { backgroundColor: Brand.orange + '20', borderColor: Brand.orange },
                      rental.estado_pago === 'Rechazado' && { backgroundColor: '#ff000020', borderColor: '#ff0000' }
                    ]}>
                      <Text style={[
                        styles.statusBadgeText,
                        rental.estado_pago === 'Aprobado' && { color: Brand.green },
                        rental.estado_pago === 'Pendiente' && { color: Brand.orange },
                        rental.estado_pago === 'Rechazado' && { color: '#ff0000' }
                      ]}>
                        {rental.estado_pago === 'Rechazado' ? 'Cancelado' : rental.estado_pago}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rentalInfoRow}>
                    <Ionicons name="calendar-outline" size={15} color={theme.textMuted} />
                    <Text style={[styles.rentalInfoText, { color: theme.textSecondary }]}>
                      {rental.fecha.split('-').reverse().join('/')}
                    </Text>
                    <Ionicons name="time-outline" size={15} color={theme.textMuted} style={{ marginLeft: 16 }} />
                    <Text style={[styles.rentalInfoText, { color: theme.textSecondary }]}>
                      {rental.hora_inicio.substring(0, 5)} - {rental.hora_fin.substring(0, 5)} hs
                    </Text>
                  </View>

                  <View style={[styles.cardHeader, { marginTop: 12, marginBottom: 0, alignItems: 'center' }]}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>
                      Total: ${rental.monto_total?.toLocaleString('es-AR')}
                    </Text>
                    {!isPast && rental.estado_pago !== 'Rechazado' && (
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => handleCancelRental(rental.id)}
                      >
                        <Text style={styles.cancelBtnText}>Cancelar Reserva</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="calendar-outline" size={48} color={theme.textMuted} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No tienes alquileres registrados.</Text>
              </View>
            }
          />
        )
      )}

      <ConfirmModal
        visible={confirmVisible}
        title="Pagar y Reservar"
        message={selectedCancha ? `¿Deseas pagar la Cancha ${selectedCancha.numero_cancha} en ${selectedCancha.organizacion?.nombre}?\n\n📅 ${dates[selectedDateIndex]?.dayName} ${dates[selectedDateIndex]?.label}\n⏱ ${confirmStartTime.substring(0,5)} hs (${selectedDuration} min)\n💰 $${calculatePriceForTime(selectedCancha, confirmStartTime).toLocaleString('es-AR')}${user?.role === 'profesor' ? `\n🔄 Repetir: ${esSemanal ? 'Semanal recurrente' : 'Solo una vez'}` : ''}` : ''}
        confirmText="Ir a Mercado Pago"
        loading={bookingLoading}
        onConfirm={confirmBooking}
        onCancel={() => setConfirmVisible(false)}
      />

      {/* Floating Chat Bubble */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: Brand.orange,
          justifyContent: 'center',
          alignItems: 'center',
          elevation: 5,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          zIndex: 9999,
        }}
        onPress={() => router.push('/(jugador)/chat')}
        activeOpacity={0.8}
      >
        <Ionicons name="chatbubbles" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: Spacing.xxxl + Spacing.xl, paddingBottom: Spacing.base, paddingHorizontal: Spacing.base },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  tabBarContainer: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '600' },
  daysContainer: { paddingHorizontal: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.sm },
  dayCard: { width: 65, height: 60, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  dayName: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  dayLabel: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  selectorsContainer: { gap: Spacing.sm, paddingTop: Spacing.xs },
  durationsContainer: { flexDirection: 'row', paddingHorizontal: Spacing.base, gap: Spacing.sm, marginTop: Spacing.xs },
  durationBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Radius.md },
  filtersSection: { padding: Spacing.base, borderBottomWidth: 1, gap: Spacing.sm },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 40, gap: Spacing.sm },
  searchInput: { flex: 1, fontSize: 14 },
  quickFilters: { flexDirection: 'row', gap: Spacing.sm },
  filterTab: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.md, borderWidth: 1 },
  filterTabText: { fontSize: 12, fontWeight: '600' },
  list: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  clubSection: { gap: Spacing.sm, marginBottom: Spacing.md },
  clubSectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: Spacing.xs, marginLeft: Spacing.xs },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm, alignItems: 'center' },
  canchaDetails: { fontSize: 15, fontWeight: '700' },
  canchaSurface: { fontSize: 12 },
  slotsContainer: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  timeSlotBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
  timeSlotText: { fontSize: 14, fontWeight: '700' },
  timeSlotPrice: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxxl * 2, gap: Spacing.base },
  emptyText: { fontSize: 14, textAlign: 'center', maxWidth: 250 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recurrentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.sm,
  },
  recurrentLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  rentalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  rentalInfoText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  cancelBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.md,
    backgroundColor: '#ff000015',
    borderWidth: 1,
    borderColor: '#ff0000',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ff0000',
  },
});
