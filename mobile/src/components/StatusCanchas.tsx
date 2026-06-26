import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { Brand, Spacing, Radius } from '@/constants/theme';

const HOURS = Array.from({ length: 17 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`);

export default function StatusCanchas() {
  const theme = useTheme();
  const { user } = useAuth();
  
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [canchas, setCanchas] = useState<any[]>([]);
  const [courtAvailability, setCourtAvailability] = useState<{ [key: string]: boolean }>({});
  const [agendaClases, setAgendaClases] = useState<any[]>([]);
  const [agendaAlquileres, setAgendaAlquileres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const getLocalISODate = () => {
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    return new Date(Date.now() - tzOffset).toISOString().split('T')[0];
  };

  useEffect(() => {
    setSelectedDate(getLocalISODate());
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!user?.club_id) return;
    setLoading(true);
    try {
      const { data: canchasData } = await supabase
        .from('canchas')
        .select('*')
        .eq('organizacion_id', user.club_id)
        .order('numero_cancha');
      
      const list = canchasData || [];
      setCanchas(list);

      if (list.length > 0) {
        const canchasIds = list.map(c => c.id);
        
        // Cargar disponibilidad
        const { data: availData } = await supabase
          .from('disponibilidad_cancha_semanal')
          .select('*')
          .in('cancha_id', canchasIds);
          
        const initialAvail: { [key: string]: boolean } = {};
        availData?.forEach((av: any) => {
          const hourStr = av.hora_inicio.substring(0, 5);
          initialAvail[`${av.cancha_id}_${av.dia_semana.toLowerCase()}_${hourStr}`] = true;
        });
        setCourtAvailability(initialAvail);

        // Clases
        const { data: clases } = await supabase
          .from('clases_disponibles')
          .select('id, fecha, hora_inicio, hora_fin, es_semanal, cancha_id, profesor:perfiles_usuarios!profesor_id(nombre)')
          .in('cancha_id', canchasIds);
        setAgendaClases(clases || []);

        // Alquileres
        const { data: alquileres } = await supabase
          .from('alquileres_cancha')
          .select('id, fecha, hora_inicio, hora_fin, cancha_id, es_semanal, usuario:perfiles_usuarios!usuario_id(nombre, rol)')
          .in('cancha_id', canchasIds)
          .in('estado_pago', ['Aprobado', 'Pendiente']);
        setAgendaAlquileres(alquileres || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handlePrevDay = () => {
    if (!selectedDate) return;
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    if (!selectedDate) return;
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const timeToDecimal = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
  };

  if (loading || !selectedDate) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={Brand.orange} />
      </View>
    );
  }

  const d = new Date(selectedDate + 'T12:00:00');
  const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const dayOfWeek = days[d.getDay()];
  const dayIndex = d.getDay();

  const formattedDate = d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.dateNav, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TouchableOpacity onPress={handlePrevDay} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.dateText, { color: theme.text }]}>
          <Ionicons name="calendar" size={16} color={Brand.orange} /> {formattedDate}
        </Text>
        <TouchableOpacity onPress={handleNextDay} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal bounces={false}>
        <View style={{ flexDirection: 'column' }}>
          {/* Header */}
          <View style={[styles.gridRow, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
            <View style={[styles.timeCell, { borderRightColor: theme.border }]}>
              <Text style={[styles.headerText, { color: theme.textSecondary }]}>Hora</Text>
            </View>
            {canchas.map(c => (
              <View key={c.id} style={[styles.canchaHeader, { borderRightColor: theme.border }]}>
                <Text style={[styles.canchaTitle, { color: theme.text }]}>C{c.numero_cancha}</Text>
                <Text style={[styles.canchaSub, { color: theme.textSecondary }]}>{c.deporte}</Text>
              </View>
            ))}
          </View>

          {/* Body */}
          <ScrollView bounces={false} style={{ height: '100%' }}>
            {HOURS.map(hour => {
              const cellDec = timeToDecimal(hour);

              return (
                <View key={hour} style={[styles.gridRow, { borderBottomColor: theme.border }]}>
                  <View style={[styles.timeCell, { borderRightColor: theme.border }]}>
                    <Text style={[styles.timeText, { color: theme.textSecondary }]}>{hour}</Text>
                  </View>

                  {canchas.map(cancha => {
                    const isGloballyOpen = courtAvailability[`${cancha.id}_${dayOfWeek}_${hour}`];
                    
                    const clase = agendaClases.find(c => {
                      if (c.cancha_id !== cancha.id) return false;
                      const startDec = timeToDecimal(c.hora_inicio);
                      const endDec = timeToDecimal(c.hora_fin);
                      if (cellDec < startDec || cellDec >= endDec) return false;
                      
                      const classDateStr = c.fecha ? c.fecha.substring(0, 10) : '';
                      if (c.es_semanal) {
                        const classStart = new Date(classDateStr + 'T12:00:00');
                        return classStart.getDay() === dayIndex && classDateStr <= selectedDate;
                      }
                      return classDateStr === selectedDate;
                    });

                    const alquiler = agendaAlquileres.find(a => {
                      if (a.cancha_id !== cancha.id) return false;
                      const startDec = timeToDecimal(a.hora_inicio);
                      const endDec = timeToDecimal(a.hora_fin);
                      if (cellDec < startDec || cellDec >= endDec) return false;
                      
                      const alqDateStr = a.fecha ? a.fecha.substring(0, 10) : '';
                      if (a.es_semanal) {
                        const alqStart = new Date(alqDateStr + 'T12:00:00');
                        return alqStart.getDay() === dayIndex && alqDateStr <= selectedDate;
                      }
                      return alqDateStr === selectedDate;
                    });

                    let cellContent = null;
                    let bgColor: string = theme.backgroundElement;
                    let borderCol: string = theme.border;

                    if (clase) {
                      bgColor = 'rgba(59, 130, 246, 0.1)';
                      borderCol = 'rgba(59, 130, 246, 0.3)';
                      cellContent = (
                        <View style={styles.block}>
                          <Ionicons name="book" size={10} color="#3b82f6" />
                          <Text style={[styles.blockText, { color: '#3b82f6' }]} numberOfLines={1}>{clase.profesor?.nombre}</Text>
                        </View>
                      );
                    } else if (alquiler && alquiler.usuario?.rol === 'profesor') {
                      bgColor = 'rgba(168, 85, 247, 0.1)'; // Purple-ish for professor reservations without class
                      borderCol = 'rgba(168, 85, 247, 0.3)';
                      cellContent = (
                        <View style={styles.block}>
                          <Ionicons name="briefcase" size={10} color="#a855f7" />
                          <Text style={[styles.blockText, { color: '#a855f7' }]} numberOfLines={1}>Prof. {alquiler.usuario?.nombre}</Text>
                        </View>
                      );
                    } else if (alquiler) {
                      bgColor = `${Brand.orange}15`;
                      borderCol = `${Brand.orange}30`;
                      cellContent = (
                        <View style={styles.block}>
                          <Ionicons name="person" size={10} color={Brand.orange} />
                          <Text style={[styles.blockText, { color: Brand.orange }]} numberOfLines={1}>{alquiler.usuario?.nombre || 'Alq.'}</Text>
                        </View>
                      );
                    } else if (!isGloballyOpen) {
                      bgColor = theme.background;
                      cellContent = <Text style={[styles.emptyText, { color: theme.textMuted }]}>Cerrado</Text>;
                    } else {
                      cellContent = <Text style={[styles.emptyText, { color: '#10b981' }]}>Libre</Text>;
                    }

                    return (
                      <View key={cancha.id} style={[styles.cell, { borderRightColor: theme.border }]}>
                        <View style={[styles.cellInner, { backgroundColor: bgColor, borderColor: borderCol }]}>
                          {cellContent}
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  navBtn: { padding: Spacing.xs },
  dateText: { fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  gridRow: { flexDirection: 'row', borderBottomWidth: 1 },
  timeCell: { width: 50, borderRightWidth: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: Spacing.sm },
  headerText: { fontSize: 12, fontWeight: '700' },
  timeText: { fontSize: 11, fontWeight: '600' },
  canchaHeader: { width: 80, borderRightWidth: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.sm },
  canchaTitle: { fontSize: 14, fontWeight: '800' },
  canchaSub: { fontSize: 10, fontWeight: '600' },
  cell: { width: 80, borderRightWidth: 1, padding: 2 },
  cellInner: { flex: 1, borderWidth: 1, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', padding: 2, minHeight: 40 },
  block: { alignItems: 'center', justifyContent: 'center' },
  blockText: { fontSize: 9, fontWeight: '700', marginTop: 2 },
  emptyText: { fontSize: 9, fontWeight: '600' },
});
