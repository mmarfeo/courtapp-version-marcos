import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { Brand, Spacing, Radius } from '@/constants/theme';
import { ConfirmModal } from '@/components/confirm-modal';

const DEPORTES = ['Tenis', 'Padel'];
const SUPERFICIES_TENIS = ['Polvo de Ladrillo', 'Cemento', 'Sintético', 'Césped'];
const SUPERFICIES_PADEL = ['Cristal', 'Muro', 'Sintético'];

export default function NuevaCanchaScreen() {
  const theme = useTheme();
  const { user } = useAuth();

  const [numeroCancha, setNumeroCancha] = useState('');
  const [nombreClub, setNombreClub] = useState('');
  const [deporte, setDeporte] = useState('Tenis');
  const [superficie, setSuperficie] = useState('Polvo de Ladrillo');
  const [saving, setSaving] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmType, setConfirmType] = useState<'confirm' | 'info'>('info');

  const handleDeporteSelect = (d: string) => {
    setDeporte(d);
    setSuperficie(d === 'Tenis' ? 'Polvo de Ladrillo' : 'Cristal');
  };

  const handleSave = async () => {
    if (!numeroCancha.trim() || !nombreClub.trim()) {
      Alert.alert('Campos Incompletos', 'Por favor ingresá el número de cancha y el nombre del club/sede.');
      return;
    }
    if (!user?.club_id) {
      Alert.alert('Error', 'No estás asociado a un club.');
      return;
    }

    setSaving(true);
    try {
      const num = parseInt(numeroCancha.trim());
      const { error } = await supabase.from('canchas').insert({
        organizacion_id: user.club_id,
        nombre_club: nombreClub.trim(),
        numero_cancha: num,
        superficie,
        deporte,
        activa: true
      });

      if (error) throw error;

      setConfirmTitle('✅ Creado');
      setConfirmMsg(`La Cancha ${num} fue agregada exitosamente.`);
      setConfirmType('confirm');
      setConfirmVisible(true);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Hubo un problema al crear la cancha.');
    } finally {
      setSaving(false);
    }
  };

  const superficiesDisponibles = deporte === 'Tenis' ? SUPERFICIES_TENIS : SUPERFICIES_PADEL;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>Nueva Cancha</Text>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: Spacing.xxxl }}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Información Básica</Text>

            <Text style={[styles.label, { color: theme.textSecondary }]}>Número de Cancha</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
              placeholder="Ej. 1"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              value={numeroCancha}
              onChangeText={setNumeroCancha}
            />

            <Text style={[styles.label, { color: theme.textSecondary }]}>Sede o Nombre del Club</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
              placeholder="Ej. Sede Central"
              placeholderTextColor={theme.textMuted}
              value={nombreClub}
              onChangeText={setNombreClub}
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Tipo de Cancha</Text>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Deporte</Text>
            <View style={styles.chipRow}>
              {DEPORTES.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.chip, deporte === d ? styles.chipActive : { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => handleDeporteSelect(d)}
                >
                  <Text style={[styles.chipText, deporte === d ? styles.chipTextActive : { color: theme.textSecondary }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: theme.textSecondary, marginTop: Spacing.md }]}>Superficie</Text>
            <View style={styles.chipRow}>
              {superficiesDisponibles.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, superficie === s ? styles.chipActive : { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => setSuperficie(s)}
                >
                  <Text style={[styles.chipText, superficie === s ? styles.chipTextActive : { color: theme.textSecondary }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <TouchableOpacity 
            style={[styles.saveBtn, saving && { opacity: 0.7 }]} 
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Crear Cancha'}</Text>
          </TouchableOpacity>
        </View>

        <ConfirmModal
          visible={confirmVisible}
          title={confirmTitle}
          message={confirmMsg}
          confirmText={confirmType === 'confirm' ? 'Aceptar' : 'Entendido'}
          onConfirm={() => {
            setConfirmVisible(false);
            if (confirmType === 'confirm') {
              router.back();
            }
          }}
          onCancel={() => setConfirmVisible(false)}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.xxxl + Spacing.md,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: { padding: Spacing.xs, marginRight: Spacing.sm },
  title: { fontSize: 20, fontWeight: '700' },
  content: { flex: 1, padding: Spacing.xl },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: Spacing.md },
  label: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.xs, marginLeft: 4 },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: Spacing.md,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: Brand.orange + '20',
    borderColor: Brand.orange,
  },
  chipText: { fontSize: 14, fontWeight: '500' },
  chipTextActive: { color: Brand.orange, fontWeight: '700' },
  footer: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    borderTopWidth: 1,
  },
  saveBtn: {
    backgroundColor: Brand.orange,
    padding: 16,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
