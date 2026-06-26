import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { Brand, Spacing, Radius } from '@/constants/theme';
import { ConfirmModal } from '@/components/confirm-modal';
import { useNotifications } from '@/hooks/use-notifications';

const DEPORTES = ['tenis', 'padel', 'tenis_padel'];
const TIPOS = ['individual', 'dobles'];
const TODAS_CATEGORIAS = ['SuperA', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D'];

export default function NuevoTorneoScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { sendNotificationToAll } = useNotifications();
  const [nombre, setNombre] = useState('');
  const [deporte, setDeporte] = useState('tenis');
  const [tipo, setTipo] = useState('dobles');
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<string[]>(['B']);
  const [enviarNotificacion, setEnviarNotificacion] = useState(false);
  const [fechaInicio, setFechaInicio] = useState('');
  const [partidosAsegurados, setPartidosAsegurados] = useState('2');
  const [clasificadosPorZona, setClasificadosPorZona] = useState('2');
  const [precio, setPrecio] = useState('');
  const [saving, setSaving] = useState(false);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirmType, setConfirmType] = useState<'info' | 'confirm'>('info');
  const [createdData, setCreatedData] = useState<any>(null);

  const toggleCategoria = (cat: string) => {
    setCategoriasSeleccionadas(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const seleccionarTodas = () => {
    if (categoriasSeleccionadas.length === TODAS_CATEGORIAS.length) {
      setCategoriasSeleccionadas([]);
    } else {
      setCategoriasSeleccionadas([...TODAS_CATEGORIAS]);
    }
  };

  const handleCreate = async () => {
    if (!nombre.trim()) {
      setConfirmTitle('Error');
      setConfirmMsg('El nombre del torneo es obligatorio');
      setConfirmType('info');
      setConfirmVisible(true);
      return;
    }
    if (categoriasSeleccionadas.length === 0) {
      setConfirmTitle('Error');
      setConfirmMsg('Debes seleccionar al menos una categoría');
      setConfirmType('info');
      setConfirmVisible(true);
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      let lastCreatedData = null;
      
      for (const cat of categoriasSeleccionadas) {
        const { data, error } = await supabase.from('torneos').insert({
          nombre_torneo: `${nombre.trim()} - Cat ${cat}`,
          deporte,
          categoria_torneo: cat,
          fecha_inicio: fechaInicio || null,
          organizacion_id: user.club_id || null,
          fase_actual: 'Inscripcion'
        }).select().single();

        if (error) {
          console.error("Error creating torneo:", error);
          throw error;
        }

        const p = parseFloat(precio) || 0;
        await supabase.from('tarifas_torneo').insert({
          torneo_id: data.id,
          precio_single: p,
          precio_dobles: p,
          precio_ambos: p
        });

        lastCreatedData = data;
      }

      if (enviarNotificacion) {
        const title = `¡Nuevo Torneo Abierto!`;
        const body = `Se han creado torneos para "${nombre.trim()}" en varias categorías. ¡Inscríbete ya!`;
        sendNotificationToAll(title, body);
      }
      setCreatedData(lastCreatedData);
      setConfirmTitle('✅ Creado');
      setConfirmMsg(`Se crearon ${categoriasSeleccionadas.length} torneos como borrador.`);
      setConfirmType('confirm');
      setConfirmVisible(true);
      setNombre(''); setFechaInicio(''); setPrecio('');
      setPartidosAsegurados('2'); setClasificadosPorZona('2');
      setCategoriasSeleccionadas(['B']);
    } catch (e: any) {
      setConfirmTitle('Error');
      setConfirmMsg(e.message || 'No se pudo crear el torneo');
      setConfirmType('info');
      setConfirmVisible(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <Text style={styles.headerTitle}>Crear Torneo</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label="Nombre del torneo *" theme={theme}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundElement, borderColor: theme.border, color: theme.text }]}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Copa Verano 2025"
            placeholderTextColor={theme.textMuted}
          />
        </Field>

        <Field label="Deporte" theme={theme}>
          <View style={styles.chips}>
            {DEPORTES.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.chip, { borderColor: deporte === d ? Brand.orange : theme.border, backgroundColor: deporte === d ? Brand.orange + '20' : theme.backgroundElement }]}
                onPress={() => setDeporte(d)}
              >
                <Text style={[styles.chipText, { color: deporte === d ? Brand.orange : theme.textSecondary }]}>
                  {d === 'tenis_padel' ? 'Tenis + Pádel' : d.charAt(0).toUpperCase() + d.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label="Modalidad" theme={theme}>
          <View style={styles.chips}>
            {TIPOS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, { borderColor: tipo === t ? Brand.orange : theme.border, backgroundColor: tipo === t ? Brand.orange + '20' : theme.backgroundElement }]}
                onPress={() => setTipo(t)}
              >
                <Text style={[styles.chipText, { color: tipo === t ? Brand.orange : theme.textSecondary }]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label="Categorías a Habilitar" theme={theme}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: Spacing.sm, marginTop: -4 }}>
            <TouchableOpacity onPress={seleccionarTodas}>
              <Text style={{ color: Brand.orange, fontSize: 13, fontWeight: '700' }}>
                {categoriasSeleccionadas.length === TODAS_CATEGORIAS.length ? 'Deseleccionar Todas' : 'Seleccionar Todas'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chips}>
            {TODAS_CATEGORIAS.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.chip,
                  {
                    borderColor: categoriasSeleccionadas.includes(cat) ? Brand.orange : theme.border,
                    backgroundColor: categoriasSeleccionadas.includes(cat) ? Brand.orange + '20' : theme.backgroundElement,
                  },
                ]}
                onPress={() => toggleCategoria(cat)}
              >
                <Text style={[styles.chipText, { color: categoriasSeleccionadas.includes(cat) ? Brand.orange : theme.textSecondary }]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: Spacing.xs }}>Se creará un fixture para cada categoría seleccionada.</Text>
        </Field>

        <Field label="Fecha de inicio (YYYY-MM-DD)" theme={theme}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundElement, borderColor: theme.border, color: theme.text }]}
            value={fechaInicio}
            onChangeText={setFechaInicio}
            placeholder="2025-09-01"
            placeholderTextColor={theme.textMuted}
          />
        </Field>

        <View style={{ flexDirection: 'row', gap: Spacing.md }}>
          <View style={{ flex: 1 }}>
            <Field label="Partidos Asegurados (x Zona)" theme={theme}>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundElement, borderColor: theme.border, color: theme.text }]}
                value={partidosAsegurados}
                onChangeText={setPartidosAsegurados}
                keyboardType="numeric"
                placeholder="2"
                placeholderTextColor={theme.textMuted}
              />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Clasificados (x Zona)" theme={theme}>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundElement, borderColor: theme.border, color: theme.text }]}
                value={clasificadosPorZona}
                onChangeText={setClasificadosPorZona}
                keyboardType="numeric"
                placeholder="2"
                placeholderTextColor={theme.textMuted}
              />
            </Field>
          </View>
        </View>

        <Field label="Precio de inscripción ($)" theme={theme}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundElement, borderColor: theme.border, color: theme.text }]}
            value={precio}
            onChangeText={setPrecio}
            placeholder="0 (gratis)"
            placeholderTextColor={theme.textMuted}
            keyboardType="numeric"
          />
        </Field>

        {/* Enviar Notificación Checkbox */}
        <TouchableOpacity 
          style={styles.checkboxRow}
          onPress={() => setEnviarNotificacion(!enviarNotificacion)}
        >
          <View style={[styles.checkbox, enviarNotificacion ? { backgroundColor: Brand.orange, borderColor: Brand.orange } : { borderColor: theme.border }]}>
            {enviarNotificacion && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <Text style={[styles.checkboxLabel, { color: theme.text }]}>
            Enviar notificación push a todos los jugadores
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitBtn, saving && styles.btnDisabled]}
          onPress={handleCreate}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.submitText}>Crear Torneo</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      <ConfirmModal
        visible={confirmVisible}
        title={confirmTitle}
        message={confirmMsg}
        type={confirmType}
        confirmText={confirmType === 'confirm' ? 'Ver Torneo' : 'Aceptar'}
        cancelText="Volver a Torneos"
        onConfirm={() => {
          setConfirmVisible(false);
          if (confirmType === 'confirm' && createdData) {
            router.push(`/(organizador)/torneo/${createdData.id}` as any);
          }
        }}
        onCancel={() => {
          setConfirmVisible(false);
          if (confirmType === 'confirm') {
            router.push('/(organizador)/torneos' as any);
          }
        }}
      />
    </View>
  );
}

function Field({ label, children, theme }: { label: string; children: React.ReactNode; theme: any }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Spacing.xxxl + Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  content: { padding: Spacing.xl, paddingBottom: Spacing.xxxl, gap: Spacing.base },
  field: { gap: Spacing.xs },
  fieldLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: 12,
    fontSize: 15,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  chipText: { fontSize: 13, fontWeight: '600' },
  submitBtn: {
    backgroundColor: Brand.orange,
    borderRadius: Radius.md,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.base,
    shadowColor: Brand.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  btnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
});
