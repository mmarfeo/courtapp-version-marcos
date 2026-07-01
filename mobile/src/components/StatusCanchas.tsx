import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { Brand, Spacing, Radius } from '@/constants/theme';
import CourtUpModal from '@/components/CourtUpModal';

const HOUR_START = 7;
const HOUR_END = 24;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => {
  const h = i + HOUR_START;
  return `${h.toString().padStart(2, '0')}:00`;
});
const CELL_H = 55;
const TIME_W = 55;
const CANCHA_W = 105;

const toDecimal = (t: string) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
};

const fmtHour = (t: string) => t?.substring(0, 5) ?? '';

const minutesToTimeStr = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

interface StatusCanchasProps {
  clubId?: number;
  onSelectSlot?: (canchaId: number, fecha: string, horaInicio: string, horaFin?: string) => void;
}

export default function StatusCanchas({ clubId, onSelectSlot }: StatusCanchasProps = {}) {
  const theme = useTheme();
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState('');
  const [canchas, setCanchas] = useState<any[]>([]);
  const [agendaClases, setAgendaClases] = useState<any[]>([]);
  const [agendaAlquileres, setAgendaAlquileres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [selectedEventCancha, setSelectedEventCancha] = useState<any | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const [selectionStart, setSelectionStart] = useState<{ canchaId: number; hour: string } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ canchaId: number; hour: string } | null>(null);
  const [userRole, setUserRole] = useState<string>('Jugador');

  useEffect(() => {
    setSelectionStart(null);
    setSelectionEnd(null);
  }, [selectedDate, clubId]);

  useEffect(() => {
    async function fetchUserRole() {
      if (!user?.id) return;
      try {
        const { data } = await supabase
          .from('perfiles_usuarios')
          .select('rol, roles')
          .eq('id', user.id)
          .single();
        
        const hasOrganizador = data?.roles?.includes('Organizador') || data?.rol === 'Organizador' || data?.rol?.toLowerCase() === 'organizador';
        const hasProfesor = data?.roles?.includes('Profesor') || data?.rol === 'Profesor' || data?.rol?.toLowerCase() === 'profesor';

        if (hasOrganizador) {
          setUserRole('Organizador');
        } else if (hasProfesor) {
          setUserRole('Profesor');
        } else {
          setUserRole('Jugador');
        }
      } catch (e) {
        console.error('Error fetching user role:', e);
      }
    }
    fetchUserRole();
  }, [user]);

  const getRoleColor = () => {
    if (userRole === 'Profesor') return '#a855f7'; // Purple
    return '#d97706'; // Orange/Amber
  };

  const getLocalDate = () => {
    const tz = new Date().getTimezoneOffset() * 60000;
    return new Date(Date.now() - tz).toISOString().split('T')[0];
  };

  useEffect(() => {
    setSelectedDate(getLocalDate());
  }, []);

  const fetchData = useCallback(async () => {
    const targetClubId = clubId || user?.club_id;
    if (!targetClubId || !selectedDate) return;
    setLoading(true);
    try {
      const { data: list } = await supabase
        .from('canchas')
        .select('*')
        .eq('organizacion_id', targetClubId)
        .order('numero_cancha');
      setCanchas(list || []);
      if (!list?.length) { setLoading(false); return; }

      const ids = list.map((c: any) => c.id);

      // Clases
      const [{ data: cd }, { data: cs }] = await Promise.all([
        supabase.from('clases_disponibles')
          .select('id, fecha, hora_inicio, hora_fin, es_semanal, cancha_id, profesor:perfiles_usuarios!profesor_id(nombre)')
          .in('cancha_id', ids).eq('fecha', selectedDate),
        supabase.from('clases_disponibles')
          .select('id, fecha, hora_inicio, hora_fin, es_semanal, cancha_id, profesor:perfiles_usuarios!profesor_id(nombre)')
          .in('cancha_id', ids).eq('es_semanal', true).lte('fecha', selectedDate),
      ]);
      setAgendaClases([...(cd || []), ...(cs || [])]);

      // Alquileres
      const sel = 'id, fecha, hora_inicio, hora_fin, cancha_id, es_semanal, usuario:perfiles_usuarios!usuario_id(nombre, rol)';
      const [{ data: ad }, { data: as_ }] = await Promise.all([
        supabase.from('alquileres_cancha').select(sel)
          .in('cancha_id', ids).in('estado_pago', ['Aprobado', 'Pendiente']).eq('fecha', selectedDate),
        supabase.from('alquileres_cancha').select(sel)
          .in('cancha_id', ids).in('estado_pago', ['Aprobado', 'Pendiente']).eq('es_semanal', true).lte('fecha', selectedDate),
      ]);
      setAgendaAlquileres([...(ad || []), ...(as_ || [])]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user, selectedDate, clubId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const shiftWeek = (weeks: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + (weeks * 7));
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const selectDay = (date: Date) => {
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  if (loading || !selectedDate) {
    return (
      <View style={[s.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={Brand.orange} />
      </View>
    );
  }

  const dayObj = new Date(selectedDate + 'T12:00:00');
  const dayIdx = dayObj.getDay();
  
  // Obtener lunes de la semana actual
  const getWeekDays = (dateStr: string) => {
    const baseDate = new Date(dateStr + 'T12:00:00');
    const day = baseDate.getDay();
    const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(baseDate.setDate(diff));
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const isScrollable = canchas.length > 3;

  const weekDays = getWeekDays(selectedDate);
  const monthYearStr = dayObj.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const monthYearFormatted = monthYearStr.charAt(0).toUpperCase() + monthYearStr.slice(1);

  const daysShort = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

  const horizontalMargin = 12;

  const findEvent = (list: any[], canchaId: number, cellDec: number) => {
    return list.find(item => {
      if (item.cancha_id !== canchaId) return false;
      const start = toDecimal(item.hora_inicio);
      const end = toDecimal(item.hora_fin);
      if (cellDec < start || cellDec >= end) return false;
      const fechaStr = item.fecha?.substring(0, 10) ?? '';
      if (item.es_semanal) {
        return new Date(fechaStr + 'T12:00:00').getDay() === dayIdx && fechaStr <= selectedDate;
      }
      return fechaStr === selectedDate;
    });
  };

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      {/* Date Header: Month + Arrow Navigation */}
      <View style={[s.dateHeader, { borderBottomColor: theme.border }]}>
        <View style={s.monthSelector}>
          <Text style={[s.monthText, { color: theme.text }]}>{monthYearFormatted}</Text>
          <Ionicons name="chevron-down" size={14} color={theme.textSecondary} style={{ marginLeft: 4 }} />
        </View>
        <View style={s.navArrows}>
          <TouchableOpacity onPress={() => shiftWeek(-1)} style={s.arrowBtn}>
            <Ionicons name="chevron-back" size={18} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => shiftWeek(1)} style={s.arrowBtn}>
            <Ionicons name="chevron-forward" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Week Calendar Selector Strip */}
      <View style={[s.calendarStrip, { borderBottomColor: theme.border }]}>
        {weekDays.map((d, index) => {
          const dateStr = d.toISOString().split('T')[0];
          const isSelected = dateStr === selectedDate;
          const dayName = daysShort[d.getDay()];
          const dayNum = d.getDate();

          return (
            <TouchableOpacity
              key={index}
              onPress={() => selectDay(d)}
              style={[
                s.stripDay,
                isSelected && [s.stripDaySelected, { backgroundColor: Brand.orange }]
              ]}
            >
              <Text
                style={[
                  s.stripDayName,
                  { color: theme.textSecondary },
                  isSelected && s.stripSelectedText
                ]}
              >
                {dayName}
              </Text>
              <Text
                style={[
                  s.stripDayNum,
                  { color: theme.text },
                  isSelected && s.stripSelectedText
                ]}
              >
                {dayNum}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Margined and contained table grid card */}
      <View style={{
        marginHorizontal: horizontalMargin,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: Radius.lg,
        overflow: 'hidden',
        backgroundColor: theme.card,
        flex: 1,
        marginBottom: Spacing.sm,
      }}>
        <ScrollView
          horizontal
          bounces={false}
          showsHorizontalScrollIndicator={false}
          scrollEnabled={isScrollable}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View style={{ flex: 1 }}>
            {/* Header Row */}
            <View style={[s.row, { backgroundColor: theme.card, borderBottomColor: theme.border, borderBottomWidth: 1.5 }]}>
              <View style={[s.timeCell, { borderRightColor: theme.border, height: 42 }]}>
                <Ionicons name="time-outline" size={15} color={theme.textSecondary} />
              </View>
              {canchas.map(c => (
                <View
                  key={c.id}
                  style={[
                    s.canchaHdr,
                    {
                      borderLeftColor: theme.border,
                      width: isScrollable ? CANCHA_W : undefined,
                      flex: isScrollable ? undefined : 1,
                    }
                  ]}
                >
                  <Text style={[s.canchaTitle, { color: theme.text }]}>{c.numero_cancha}</Text>
                  <Text style={[s.canchaSub, { color: theme.textSecondary }]}>
                    {c.deporte?.toUpperCase() || 'TENIS'}
                  </Text>
                </View>
              ))}
            </View>

            {/* Body List */}
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {HOURS.map(hour => {
                const cellDec = toDecimal(hour);
                return (
                  <View key={hour} style={[s.row, { borderBottomColor: theme.border }]}>
                    {/* Time label */}
                    <View style={[s.timeCell, { borderRightColor: theme.border, height: CELL_H }]}>
                      <Text style={[s.timeTxt, { color: theme.textSecondary }]}>{hour}</Text>
                    </View>

                    {/* Grid cells */}
                    {canchas.map(cancha => {
                      const clase = findEvent(agendaClases, cancha.id, cellDec);
                      const alquiler = findEvent(agendaAlquileres, cancha.id, cellDec);

                      let bg = theme.backgroundElement || '#ffffff';
                      let borderLeftColor = theme.border + '30';
                      let content: React.ReactNode;

                      if (clase) {
                        bg = '#3b82f60d';
                        borderLeftColor = '#3b82f6';
                        const isFirst = cellDec === toDecimal(clase.hora_inicio);
                        content = isFirst ? (
                          <View style={s.block}>
                            <Text style={[s.blockTitle, { color: '#1e3a8a' }]} numberOfLines={1}>
                              {clase.profesor?.nombre || 'Clase'}
                            </Text>
                            <Text style={[s.blockSub, { color: '#3b82f6' }]} numberOfLines={1}>
                              Clase Particular
                            </Text>
                          </View>
                        ) : null;
                      } else if (alquiler) {
                        const isProf = alquiler.usuario?.rol?.toLowerCase() === 'profesor';
                        const colorAccent = isProf ? '#a855f7' : '#d97706';
                        bg = isProf ? '#f3e8ff' : '#fef3c7';
                        borderLeftColor = colorAccent;
                        
                        const isFirst = cellDec === toDecimal(alquiler.hora_inicio);
                        const label = isProf
                          ? `Prof. ${alquiler.usuario?.nombre || ''}`
                          : (alquiler.usuario?.nombre || 'Alquiler');
                        const subLabel = isProf ? 'Entrenamiento' : 'Alquiler';
                        
                        content = isFirst ? (
                          <View style={s.block}>
                            <Text style={[s.blockTitle, { color: isProf ? '#581c87' : '#78350f' }]} numberOfLines={1}>
                              {label}
                            </Text>
                            <Text style={[s.blockSub, { color: colorAccent }]} numberOfLines={1}>
                              {subLabel}
                            </Text>
                          </View>
                        ) : null;
                      } else {
                        const isSelectedStart = selectionStart?.canchaId === cancha.id && selectionStart?.hour === hour;
                        const isSelectedEnd = selectionEnd?.canchaId === cancha.id && selectionEnd?.hour === hour;
                        const isSelectedMiddle = selectionStart && selectionEnd && 
                          selectionStart.canchaId === cancha.id &&
                          toDecimal(hour) >= toDecimal(selectionStart.hour) &&
                          toDecimal(hour) <= toDecimal(selectionEnd.hour);
                        
                        const isSelectedRange = isSelectedStart || isSelectedEnd || isSelectedMiddle;
                        const roleColor = getRoleColor();

                        if (isSelectedRange) {
                          bg = roleColor + '18';
                          borderLeftColor = roleColor;
                        }
                        content = <Text style={[s.disponibleTxt, isSelectedRange && { color: roleColor }]}>DISPONIBLE</Text>;
                      }

                      const handlePress = () => {
                        console.log('StatusCanchas: Celda presionada!', {
                          canchaId: cancha.id,
                          numeroCancha: cancha.numero_cancha,
                          selectedDate,
                          hour,
                          tieneClase: !!clase,
                          tieneAlquiler: !!alquiler,
                          tieneCallbackSelect: !!onSelectSlot
                        });
                        if (clase) {
                          setSelectedEvent({ type: 'clase', data: clase });
                          setSelectedEventCancha(cancha);
                          setDetailModalVisible(true);
                        } else if (alquiler) {
                          setSelectedEvent({ type: 'alquiler', data: alquiler });
                          setSelectedEventCancha(cancha);
                          setDetailModalVisible(true);
                        } else {
                          const now = new Date();
                          const todayStr = getLocalDate();
                          
                          if (selectedDate < todayStr) {
                            Alert.alert('No permitido', 'No puedes reservar en una fecha pasada.');
                            return;
                          }
                          
                          if (selectedDate === todayStr) {
                            const [slotH, slotM] = hour.split(':').map(Number);
                            const currentH = now.getHours();
                            const currentM = now.getMinutes();
                            
                            if (currentH > slotH || (currentH === slotH && currentM >= slotM)) {
                              Alert.alert('No permitido', 'No puedes reservar en un horario que ya pasó.');
                              return;
                            }
                          }

                          if (!selectionStart || selectionStart.canchaId !== cancha.id) {
                            setSelectionStart({ canchaId: cancha.id, hour });
                            setSelectionEnd(null);
                          } else {
                            const startDec = toDecimal(selectionStart.hour);
                            const clickedDec = toDecimal(hour);

                            if (clickedDec === startDec) {
                              setSelectionStart(null);
                              setSelectionEnd(null);
                            } else if (clickedDec > startDec) {
                              let hasOverlap = false;
                              const startIdx = HOURS.indexOf(selectionStart.hour);
                              const endIdx = HOURS.indexOf(hour);
                              for (let i = startIdx; i <= endIdx; i++) {
                                const checkHour = HOURS[i];
                                const decVal = toDecimal(checkHour);
                                if (findEvent(agendaClases, cancha.id, decVal) || findEvent(agendaAlquileres, cancha.id, decVal)) {
                                  hasOverlap = true;
                                  break;
                                }
                              }

                              if (hasOverlap) {
                                setSelectionStart({ canchaId: cancha.id, hour });
                                setSelectionEnd(null);
                              } else {
                                setSelectionEnd({ canchaId: cancha.id, hour });
                              }
                            } else {
                              setSelectionStart({ canchaId: cancha.id, hour });
                              setSelectionEnd(null);
                            }
                          }
                        }
                      };

                      return (
                        <TouchableOpacity
                          key={cancha.id}
                          activeOpacity={0.7}
                          onPress={handlePress}
                          style={[
                            s.cell,
                            {
                              height: CELL_H,
                              backgroundColor: bg,
                              borderLeftColor: borderLeftColor,
                              borderLeftWidth: (clase || alquiler) ? 3 : 1,
                              width: isScrollable ? CANCHA_W : undefined,
                              flex: isScrollable ? undefined : 1,
                            }
                          ]}
                        >
                          {content}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>
      </View>

      {/* Modal de Detalle */}
      <CourtUpModal
        visible={detailModalVisible}
        title={selectedEvent?.type === 'clase' ? 'Detalle de la Clase' : 'Detalle de la Reserva'}
        onClose={() => setDetailModalVisible(false)}
        height={340}
      >
        {selectedEvent && (
          <View style={s.modalBody}>
            <View style={s.modalInfoRow}>
              <Ionicons name="tennisball-outline" size={20} color={Brand.orange} style={{ marginRight: 8 }} />
              <Text style={[s.modalText, { color: theme.text }]}>
                Cancha {selectedEventCancha?.numero_cancha} ({selectedEventCancha?.deporte?.toUpperCase()})
              </Text>
            </View>

            <View style={s.modalInfoRow}>
              <Ionicons name="time-outline" size={20} color={Brand.orange} style={{ marginRight: 8 }} />
              <Text style={[s.modalText, { color: theme.text }]}>
                {fmtHour(selectedEvent.data.hora_inicio)} a {fmtHour(selectedEvent.data.hora_fin)} hs
              </Text>
            </View>

            <View style={s.modalInfoRow}>
              <Ionicons name="calendar-outline" size={20} color={Brand.orange} style={{ marginRight: 8 }} />
              <Text style={[s.modalText, { color: theme.text }]}>
                Fecha: {selectedEvent.data.fecha ? selectedEvent.data.fecha.split('T')[0] : selectedDate}
                {selectedEvent.data.es_semanal ? ' (Fija Semanal)' : ''}
              </Text>
            </View>

            <View style={s.modalInfoRow}>
              <Ionicons name="person-outline" size={20} color={Brand.orange} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={[s.modalText, { color: theme.text }]} numberOfLines={1}>
                  {selectedEvent.type === 'clase' 
                    ? `Profesor: ${selectedEvent.data.profesor?.nombre || 'Particular'}` 
                    : `Cliente: ${selectedEvent.data.usuario?.nombre || 'Reservado'}`}
                </Text>
                {selectedEvent.type === 'alquiler' && selectedEvent.data.usuario?.rol && (
                  <Text style={[s.modalSubText, { color: theme.textSecondary }]}>
                    Rol: {selectedEvent.data.usuario?.rol}
                  </Text>
                )}
              </View>
            </View>

            <TouchableOpacity 
              style={[s.modalCloseBtn, { backgroundColor: Brand.orange }]} 
              onPress={() => setDetailModalVisible(false)}
            >
              <Text style={s.modalCloseBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        )}
      </CourtUpModal>

      {/* Barra de Confirmación de Selección */}
      {selectionStart && (
        <View style={[s.bottomBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <View style={s.bottomBarLeft}>
            <Text style={[s.bottomBarTitle, { color: theme.text }]}>
              Cancha {canchas.find(c => c.id === selectionStart.canchaId)?.numero_cancha}
            </Text>
            <Text style={[s.bottomBarSub, { color: theme.textSecondary }]}>
              {selectionStart.hour} {selectionEnd ? `a ${minutesToTimeStr(toDecimal(selectionEnd.hour) * 60 + 60)}` : ' (Selecciona fin)'} hs
            </Text>
          </View>
          <View style={s.bottomBarRight}>
            <TouchableOpacity 
              style={[s.bottomBarCancelBtn, { borderColor: theme.border }]} 
              onPress={() => {
                setSelectionStart(null);
                setSelectionEnd(null);
              }}
            >
              <Text style={[s.bottomBarCancelBtnText, { color: theme.textSecondary }]}>Limpiar</Text>
            </TouchableOpacity>
            {onSelectSlot && (
              <TouchableOpacity 
                style={[s.bottomBarBtn, { backgroundColor: getRoleColor() }]}
                onPress={() => {
                  const startHour = selectionStart.hour;
                  const endDec = selectionEnd ? (toDecimal(selectionEnd.hour) + 1) : (toDecimal(selectionStart.hour) + 1);
                  const endHour = minutesToTimeStr(endDec * 60);
                  onSelectSlot(selectionStart.canchaId, selectedDate, startHour, endHour);
                  setSelectionStart(null);
                  setSelectionEnd(null);
                }}
              >
                <Text style={s.bottomBarBtnText}>Confirmar</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthText: {
    fontSize: 18,
    fontWeight: '800',
  },
  navArrows: {
    flexDirection: 'row',
    gap: 8,
  },
  arrowBtn: {
    padding: 6,
  },
  calendarStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1,
  },
  stripDay: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  stripDaySelected: {
    borderColor: 'transparent',
  },
  stripDayName: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  stripDayNum: {
    fontSize: 16,
    fontWeight: '800',
  },
  stripSelectedText: {
    color: '#ffffff',
  },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e5e7eb' },
  timeCell: {
    width: TIME_W,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hdrTxt: { fontSize: 10, fontWeight: '700' },
  timeTxt: { fontSize: 11, fontWeight: '600' },
  canchaHdr: {
    width: CANCHA_W,
    borderLeftWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canchaTitle: { fontSize: 13, fontWeight: '800' },
  canchaSub: { fontSize: 9, fontWeight: '600' },
  cell: {
    width: CANCHA_W,
    borderLeftWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  block: {
    width: '100%',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  blockTitle: {
    fontSize: 11,
    fontWeight: '800',
  },
  blockSub: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  disponibleTxt: {
    fontSize: 9,
    fontWeight: '700',
    color: '#10b981',
  },
  modalBody: {
    padding: Spacing.sm,
    gap: Spacing.md,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  modalText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalSubText: {
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  modalCloseBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bottomBarLeft: {
    flex: 1,
  },
  bottomBarTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  bottomBarSub: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  bottomBarRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  bottomBarCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  bottomBarCancelBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
  bottomBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
  },
  bottomBarBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});
