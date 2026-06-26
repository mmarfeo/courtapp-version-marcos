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
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-notifications';
import { Brand, Spacing, Radius, Shadow } from '@/constants/theme';
import { ConfirmModal } from '@/components/confirm-modal';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const formatDateLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

type ClaseDisponible = {
  id: number;
  profesor_id: string;
  deporte: string;
  categoria_target: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  precio_clase: number;
  cupo_maximo: number;
  es_semanal: boolean;
  canchas?: {
    numero_cancha: number;
    tipo_superficie?: string;
  };
  reservas_clases?: any[];
  profesor?: {
    nombre: string;
  };
  organizacion?: {
    nombre: string;
  };
};

export default function ClasesJugadorScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { sendNotificationToUser } = useNotifications();
  const [clases, setClases] = useState<ClaseDisponible[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasOpenedDeepLink, setHasOpenedDeepLink] = useState(false);
  const { openClaseId } = useLocalSearchParams<{ openClaseId: string }>();

  // Modal State
  type ConfirmState = {
    visible: boolean;
    title: string;
    message: string;
    type: 'info' | 'confirm';
    onConfirm?: () => void;
  };
  const [confirmConfig, setConfirmConfig] = useState<ConfirmState>({ visible: false, title: '', message: '', type: 'info' });
  const [selectedClase, setSelectedClase] = useState<ClaseDisponible | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Search State
  const [search, setSearch] = useState('');

  // Date State
  const [selectedDay, setSelectedDay] = useState(new Date());
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
    try {
      const { data, error } = await supabase
        .from('clases_disponibles')
        .select(`
          *,
          canchas(*),
          reservas_clases(*),
          profesor:perfiles_usuarios(nombre),
          organizacion:organizaciones(nombre)
        `)
        .eq('activa', true)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true });

      if (error) throw error;
      
      // Filtrar para ocultar las clases ya completamente reservadas/pagadas (orden de llegada), EXCEPTO si el usuario actual ya está inscripto
      const availableClases = (data || []).filter((clase: any) => {
        const approvedBookings = (clase.reservas_clases || []).filter((r: any) => r.estado_pago === 'Aprobado').length;
        const isBookedByMe = (clase.reservas_clases || []).some((r: any) => r.alumno_id === user?.id);
        return isBookedByMe || approvedBookings < (clase.cupo_maximo || 1);
      });

      setClases(availableClases);
    } catch (e) {
      console.error('Error al obtener clases:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchClases();
  }, [fetchClases]);

  useEffect(() => {
    if (openClaseId && clases.length > 0 && !hasOpenedDeepLink) {
      const targetClase = clases.find(c => c.id.toString() === openClaseId);
      if (targetClase) {
        setHasOpenedDeepLink(true);
        setTimeout(() => {
          // Si el día de la clase no es el día seleccionado, actualizamos el día seleccionado
          const classDate = new Date(targetClase.fecha + 'T12:00:00');
          setSelectedDay(classDate);
          
          handleBookClase(targetClase);
        }, 500);
      }
    }
  }, [openClaseId, clases, hasOpenedDeepLink]);

  const handleBookClase = (clase: ClaseDisponible) => {
    if (!user) return;
    
    // Check if already booked
    const hasReserved = (clase.reservas_clases || []).some(
      (r: any) => r.alumno_id === user.id
    );

    if (hasReserved) {
      setConfirmConfig({ visible: true, title: 'Clase ya reservada', message: 'Ya estás inscripto en esta clase.', type: 'info', onConfirm: () => setConfirmConfig(prev => ({...prev, visible: false})) });
      return;
    }

    const currentBookings = (clase.reservas_clases || []).length;
    if (currentBookings >= (clase.cupo_maximo || 1)) {
      setConfirmConfig({ visible: true, title: 'Clase Completa', message: 'No quedan cupos disponibles para esta clase.', type: 'info', onConfirm: () => setConfirmConfig(prev => ({...prev, visible: false})) });
      return;
    }

    setSelectedClase(clase);
    setConfirmConfig({
      visible: true,
      title: 'Reservar Clase',
      message: `¿Deseas reservar tu cupo para la clase de ${clase.deporte} (${clase.categoria_target})?\n\n🏢 Club: ${clase.organizacion?.nombre || 'Club'}\n🎓 Profesor: ${clase.profesor?.nombre || 'Profesor'}\n💰 Precio: $${clase.precio_clase}`,
      type: 'confirm'
    });
  };

  const confirmBooking = async () => {
    if (!user || !selectedClase) return;
    setBookingLoading(true);
    try {
      const { error } = await supabase
        .from('reservas_clases')
        .insert([{
          clase_id: selectedClase.id,
          alumno_id: user.id,
          estado_pago: 'Aprobado',
          monto_neto_club: selectedClase.precio_clase,
          monto_total_pagado: selectedClase.precio_clase,
          comision_plataforma: 0,
          fecha_pago: new Date().toISOString()
        }]);

      if (error) throw error;

      // Enviar notificación push al profesor
      try {
        const title = `Clase Reservada y Pagada`;
        const body = `El alumno ${user.nombre || 'Un jugador'} ha reservado y pagado la clase de ${selectedClase.deporte} del día ${selectedClase.fecha} a las ${selectedClase.hora_inicio.substring(0,5)} hs.`;
        await sendNotificationToUser(selectedClase.profesor_id, title, body);
      } catch (notiError) {
        console.error('Error al notificar al profesor:', notiError);
      }

      setConfirmConfig({ visible: true, title: '¡Éxito!', message: 'Tu clase ha sido reservada con éxito.', type: 'info', onConfirm: () => setConfirmConfig(prev => ({...prev, visible: false})) });
      fetchClases();
    } catch (err: any) {
      setConfirmConfig({ visible: true, title: 'Error al reservar', message: err.message || 'No se pudo reservar la clase.', type: 'info', onConfirm: () => setConfirmConfig(prev => ({...prev, visible: false})) });
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelClase = async (clase: ClaseDisponible) => {
    if (!user) return;
    
    // Check 12 hour restriction
    const classDateStr = `${clase.fecha}T${clase.hora_inicio}`;
    const classTime = new Date(classDateStr).getTime();
    const now = new Date().getTime();
    const hoursDiff = (classTime - now) / (1000 * 60 * 60);

    if (hoursDiff < 12) {
      setConfirmConfig({ visible: true, title: 'No permitido', message: 'No puedes darte de baja con menos de 12 horas de anticipación. Por favor contacta al profesor para la devolución del dinero o reprogramación.', type: 'info', onConfirm: () => setConfirmConfig(prev => ({...prev, visible: false})) });
      return;
    }

    setConfirmConfig({
      visible: true,
      title: 'Darse de baja',
      message: '¿Estás seguro que deseas cancelar tu inscripción a esta clase?',
      type: 'confirm',
      onConfirm: async () => {
        setConfirmConfig(prev => ({...prev, visible: false}));
        setBookingLoading(true);
        try {
          const { error } = await supabase
            .from('reservas_clases')
            .update({ estado_pago: 'Cancelado', estado: 'cancelada' })
            .eq('clase_id', clase.id)
            .eq('alumno_id', user.id);
            
          if (error) throw error;
          
          setConfirmConfig({ visible: true, title: 'Baja exitosa', message: 'Te has dado de baja de la clase.', type: 'info', onConfirm: () => setConfirmConfig(prev => ({...prev, visible: false})) });
          fetchClases();
        } catch (err: any) {
          setConfirmConfig({ visible: true, title: 'Error', message: err.message || 'No se pudo cancelar la clase.', type: 'info', onConfirm: () => setConfirmConfig(prev => ({...prev, visible: false})) });
        } finally {
          setBookingLoading(false);
        }
      }
    });
  };

  const filteredClases = clases.filter((clase) => {
    const matchesSearch =
      (clase.profesor?.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
      (clase.organizacion?.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
      (clase.deporte || '').toLowerCase().includes(search.toLowerCase());
      
    const selectedDateStr = formatDateLocal(selectedDay);
    const matchesDate = clase.fecha === selectedDateStr;
    
    const today = new Date();
    const todayStr = formatDateLocal(today);
    const isPastDate = selectedDateStr < todayStr;
    const isBooked = (clase.reservas_clases || []).some((r: any) => r.alumno_id === user?.id);

    if (isPastDate && !isBooked) return false;

    // Filter past times for today
    if (clase.fecha === todayStr && !isBooked) {
      const nowH = today.getHours();
      const nowM = today.getMinutes();
      const [cH, cM] = clase.hora_inicio.split(':').map(Number);
      if (cH < nowH || (cH === nowH && cM <= nowM)) {
        return false;
      }
    }

    return matchesSearch && matchesDate;
  });

  const renderClase = ({ item }: { item: ClaseDisponible }) => {
    const approvedBookings = (item.reservas_clases || []).filter(r => r.estado_pago === 'Aprobado').length;
    const isBooked = (item.reservas_clases || []).some(r => r.alumno_id === user?.id);

    return (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, Shadow.sm]}>
        <View style={styles.cardLeft}>
          <View style={styles.titleRow}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Clase de {item.deporte}
            </Text>
            <Text style={styles.badge}>Cat {item.categoria_target}</Text>
            {item.es_semanal && <Text style={styles.weeklyBadge}>Fija</Text>}
          </View>
          
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            📅 {new Date(item.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} • ⏱ {item.hora_inicio.substring(0,5)} - {item.hora_fin.substring(0,5)}
          </Text>
          
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            🏢 Club: {item.organizacion?.nombre || 'Club'} {item.canchas ? `• Cancha ${item.canchas.numero_cancha}` : ''}
          </Text>

          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            🎓 Profesor: {item.profesor?.nombre || 'Profesor'}
          </Text>

          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            👥 Cupos: {approvedBookings}/{item.cupo_maximo} Alumnos
          </Text>
        </View>

        <View style={styles.cardRight}>
          <Text style={styles.price}>${item.precio_clase}</Text>
          <TouchableOpacity
            style={[
              styles.bookBtn,
              isBooked ? styles.btnBooked : (approvedBookings >= item.cupo_maximo ? styles.btnFull : null)
            ]}
            onPress={() => isBooked ? handleCancelClase(item) : handleBookClase(item)}
            disabled={!isBooked && approvedBookings >= item.cupo_maximo}
            activeOpacity={0.8}
          >
            <Text style={[styles.bookBtnText, isBooked && styles.btnBookedText]}>
              {isBooked ? 'Inscripto' : (approvedBookings >= item.cupo_maximo ? 'Completo' : 'Reservar')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <Text style={styles.headerTitle}>Clases Disponibles</Text>
      </View>

      {/* Search Input Area */}
      <View style={[styles.filtersSection, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={18} color={theme.textMuted} />
          <TextInput
            placeholder="Buscar por profesor, club..."
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Week selector */}
      <View style={[styles.weekRow, { backgroundColor: theme.card, borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
        <TouchableOpacity onPress={prevWeek} style={styles.arrowBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.textMuted} />
        </TouchableOpacity>
        {weekDays.map((day, i) => {
          const isSelected = formatDateLocal(day) === formatDateLocal(selectedDay);
          const isToday = formatDateLocal(day) === formatDateLocal(new Date());
          return (
            <TouchableOpacity
              key={i}
              style={[styles.dayBtn, isSelected && { backgroundColor: Brand.green, borderRadius: Radius.md }]}
              onPress={() => setSelectedDay(day)}
            >
              <Text style={[styles.dayName, { color: isSelected ? '#fff' : theme.textMuted }]}>
                {DIAS[day.getDay()]}
              </Text>
              <Text style={[styles.dayNum, { color: isSelected ? '#fff' : isToday ? Brand.green : theme.text }]}>
                {day.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity onPress={nextWeek} style={styles.arrowBtn}>
          <Ionicons name="chevron-forward" size={24} color={theme.textMuted} />
        </TouchableOpacity>
      </View>

      {loading && clases.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.green} />
        </View>
      ) : (
        <FlatList
          data={filteredClases}
          renderItem={renderClase}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchClases();
              }}
              tintColor={Brand.green}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🎾</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {search ? 'No se encontraron clases que coincidan con la búsqueda.' : 'No hay clases disponibles en este momento.'}
              </Text>
            </View>
          }
        />
      )}

      <ConfirmModal
        visible={confirmConfig.visible}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
        confirmText={confirmConfig.type === 'confirm' ? "Confirmar Reserva" : "Aceptar"}
        loading={bookingLoading}
        onConfirm={() => {
          if (confirmConfig.type === 'confirm') {
            confirmBooking();
          } else {
            setConfirmConfig(prev => ({...prev, visible: false}));
          }
        }}
        onCancel={() => setConfirmConfig(prev => ({...prev, visible: false}))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: Spacing.xxxl + Spacing.xl, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.xl },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  filtersSection: {
    padding: Spacing.base,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 40,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  list: { padding: Spacing.base, paddingBottom: 100, gap: Spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.base,
    gap: Spacing.md,
  },
  cardLeft: { flex: 1, gap: 5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
    color: '#ff6b35',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  weeklyBadge: {
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    color: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  cardSub: { fontSize: 13, fontWeight: '500' },
  cardRight: { alignItems: 'flex-end', justifyContent: 'center', gap: Spacing.sm },
  price: { fontSize: 18, fontWeight: '900', color: '#10b981' },
  bookBtn: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.md,
    minWidth: 85,
    alignItems: 'center',
  },
  bookBtnText: { color: '#fff', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  btnBooked: { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderWidth: 1, borderColor: '#10b981' },
  btnBookedText: { color: '#10b981' },
  btnFull: { backgroundColor: '#4b5563', opacity: 0.6 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: Spacing.xxxl, gap: Spacing.base },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, textAlign: 'center', paddingHorizontal: Spacing.xl },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  arrowBtn: { padding: Spacing.xs },
  dayBtn: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10 },
  dayName: { fontSize: 12, marginBottom: 4, fontWeight: '500' },
  dayNum: { fontSize: 16, fontWeight: 'bold' },
});
