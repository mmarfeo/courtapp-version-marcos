import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { Brand, Spacing, Radius, Shadow } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function PerfilProfesorScreen() {
  const { user, signOut, switchRole, updateName, updatePhone } = useAuth();
  const theme = useTheme();
  const [editingName, setEditingName] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [newName, setNewName] = useState(user?.nombre || '');
  const [newPhone, setNewPhone] = useState(user?.telefono || '');
  
  const [loadingPagos, setLoadingPagos] = useState(true);
  const [savingPagos, setSavingPagos] = useState(false);
  const [pagos, setPagos] = useState({
    cvu: '',
    alias: '',
    cuit_cuil: '',
    banco: ''
  });

  useEffect(() => {
    if (user?.nombre) {
      setNewName(user.nombre);
    }
    if (user?.telefono !== undefined) {
      setNewPhone(user.telefono || '');
    }
  }, [user?.nombre, user?.telefono]);

  useEffect(() => {
    const fetchPagos = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('perfiles_usuarios')
        .select('cvu, alias, cuit_cuil, banco')
        .eq('id', user.id)
        .single();
      
      if (data) {
        setPagos({
          cvu: data.cvu || '',
          alias: data.alias || '',
          cuit_cuil: data.cuit_cuil || '',
          banco: data.banco || ''
        });
      }
      setLoadingPagos(false);
    };
    fetchPagos();
  }, [user]);

  const handleSaveName = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'El nombre no puede estar vacío');
      return;
    }
    const { error } = await updateName(newName.trim());
    if (error) {
      Alert.alert('Error', 'No se pudo actualizar el nombre');
    } else {
      setEditingName(false);
    }
  };

  const handleSavePhone = async () => {
    const { error } = await updatePhone(newPhone);
    if (error) {
      Alert.alert('Error', 'No se pudo actualizar el teléfono');
    } else {
      setEditingPhone(false);
    }
  };

  const handleSavePagos = async () => {
    if (!user) return;
    setSavingPagos(true);
    try {
      const { error } = await supabase
        .from('perfiles_usuarios')
        .update({
          cvu: pagos.cvu || null,
          alias: pagos.alias || null,
          cuit_cuil: pagos.cuit_cuil || null,
          banco: pagos.banco || null
        })
        .eq('id', user.id);
        
      if (error) throw error;
      Alert.alert('Éxito', 'Tus datos de cobro han sido actualizados.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo guardar la información');
    } finally {
      setSavingPagos(false);
    }
  };

  const initials = user?.nombre
    ? user.nombre.split(' ').map(n => n.charAt(0)).join('').toUpperCase().substring(0, 2)
    : 'PR';

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: Brand.green }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          {editingName ? (
            <View style={styles.editContainer}>
              <TextInput
                style={[styles.inputEdit, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                value={newName}
                onChangeText={setNewName}
                autoFocus
              />
              <TouchableOpacity onPress={handleSaveName} style={styles.editActionBtn}>
                <Ionicons name="checkmark-circle" size={26} color={Brand.green} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingName(false)} style={styles.editActionBtn}>
                <Ionicons name="close-circle" size={26} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: theme.text }]}>
                {user?.nombre}
              </Text>
              <TouchableOpacity onPress={() => setEditingName(true)} style={styles.editBtn}>
                <Ionicons name="create-outline" size={18} color={Brand.green} />
              </TouchableOpacity>
            </View>
          )}

          {editingPhone ? (
            <View style={[styles.editContainer, { marginTop: Spacing.sm }]}>
              <TextInput
                style={[styles.inputEdit, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="number-pad"
                placeholder="Ej: 1122334455"
                placeholderTextColor={theme.textMuted}
                autoFocus
              />
              <TouchableOpacity onPress={handleSavePhone} style={styles.editActionBtn}>
                <Ionicons name="checkmark-circle" size={26} color={Brand.green} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingPhone(false)} style={styles.editActionBtn}>
                <Ionicons name="close-circle" size={26} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.nameRow, { marginTop: Spacing.xs }]}>
              <Text style={[styles.email, { color: theme.textSecondary, marginBottom: 0 }]}>
                {user?.telefono ? `📞 ${user.telefono}` : '📞 Sin teléfono'}
              </Text>
              <TouchableOpacity onPress={() => setEditingPhone(true)} style={styles.editBtn}>
                <Ionicons name="create-outline" size={16} color={Brand.green} />
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.email, { color: theme.textSecondary, marginTop: Spacing.xs }]}>{user?.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.roleText, { color: Brand.green }]}>🎓 Profesor</Text>
          </View>
        </View>

        {/* Métodos de Cobro */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="wallet-outline" size={20} color={Brand.green} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Mis Métodos de Cobro</Text>
          </View>
          
          {loadingPagos ? (
            <ActivityIndicator size="small" color={Brand.green} style={{ marginVertical: Spacing.xl }} />
          ) : (
            <View style={styles.formGroup}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Los alumnos verán estos datos para transferirte.</Text>
              
              <Text style={[styles.inputLabel, { color: theme.text }]}>Alias</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                value={pagos.alias}
                onChangeText={(v) => setPagos(prev => ({ ...prev, alias: v }))}
                placeholder="cancha.tenis.mp"
                placeholderTextColor={theme.textMuted}
              />

              <Text style={[styles.inputLabel, { color: theme.text }]}>CVU / CBU</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                value={pagos.cvu}
                onChangeText={(v) => setPagos(prev => ({ ...prev, cvu: v }))}
                placeholder="0000003100000000000000"
                keyboardType="numeric"
                placeholderTextColor={theme.textMuted}
              />

              <Text style={[styles.inputLabel, { color: theme.text }]}>Banco / Billetera</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                value={pagos.banco}
                onChangeText={(v) => setPagos(prev => ({ ...prev, banco: v }))}
                placeholder="Mercado Pago / Ualá / Galicia"
                placeholderTextColor={theme.textMuted}
              />

              <Text style={[styles.inputLabel, { color: theme.text }]}>CUIT / CUIL</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                value={pagos.cuit_cuil}
                onChangeText={(v) => setPagos(prev => ({ ...prev, cuit_cuil: v }))}
                placeholder="20-12345678-9"
                keyboardType="numeric"
                placeholderTextColor={theme.textMuted}
              />

              <TouchableOpacity 
                style={[styles.saveBtn, { backgroundColor: Brand.green }]} 
                onPress={handleSavePagos}
                disabled={savingPagos}
              >
                {savingPagos ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Guardar Datos</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Role Switcher */}
        {user && user.roles && user.roles.length > 1 && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Vista de Rol Activa</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs }}>
              {user.roles.map((r) => {
                const isActive = user.role === r;
                let label = '';
                if (r === 'superadmin') label = '👑 SuperAdmin';
                else if (r === 'admin') label = '🛡️ Admin';
                else if (r === 'organizador') label = '🏆 Org';
                else if (r === 'profesor') label = '🎓 Profesor';
                else if (r === 'jugador') label = '🎾 Jugador';
                
                return (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.roleSwitchBtn,
                      isActive && { backgroundColor: Brand.green, borderColor: Brand.green }
                    ]}
                    onPress={async () => {
                      await switchRole(r);
                      if (r === 'superadmin' || r === 'admin') router.replace('/(admin)/dashboard');
                      else if (r === 'organizador') router.replace('/(organizador)/torneos');
                      else if (r === 'profesor') router.replace('/(profesor)/agenda');
                      else router.replace('/(jugador)/torneos');
                    }}
                    disabled={isActive}
                  >
                    <Text style={[styles.roleSwitchBtnText, isActive && { color: '#fff' }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <TouchableOpacity style={[styles.logoutBtn, { borderColor: theme.border }]} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: Spacing.xxxl + Spacing.xl, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.xl },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl, alignItems: 'center', gap: Spacing.base },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', shadowColor: Brand.green, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '700' },
  email: { fontSize: 14 },
  roleBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.base, paddingVertical: Spacing.xs },
  roleText: { fontSize: 13, fontWeight: '700' },
  
  card: { width: '100%', borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.base },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  formGroup: { marginTop: Spacing.xs },
  infoLabel: { fontSize: 12, marginBottom: Spacing.md },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4, marginTop: Spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    fontSize: 14,
  },
  saveBtn: {
    marginTop: Spacing.xl,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  logoutBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, paddingVertical: 14, marginTop: Spacing.xl },
  logoutText: { color: '#ef4444', fontSize: 15, fontWeight: '700' },
  
  roleSwitchBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 107, 53, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  roleSwitchBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ff6b35',
  },
  editContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs, width: '100%', paddingHorizontal: Spacing.xl },
  inputEdit: { flex: 1, borderWidth: 1.5, borderRadius: Radius.md, paddingVertical: 6, paddingHorizontal: Spacing.base, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  editActionBtn: { padding: Spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  editBtn: { padding: Spacing.xs },
});
