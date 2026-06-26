import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { Brand, Spacing, Radius } from '@/constants/theme';

export default function PerfilAdminScreen() {
  const { user, signOut, switchRole, updateName } = useAuth();
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(user?.nombre || '');

  useEffect(() => {
    if (user?.nombre) {
      setNewName(user.nombre);
    }
  }, [user?.nombre]);

  const handleSaveName = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'El nombre no puede estar vacío');
      return;
    }
    const { error } = await updateName(newName.trim());
    if (error) {
      Alert.alert('Error', 'No se pudo actualizar el nombre');
    } else {
      setEditing(false);
    }
  };

  const initials = user?.nombre
    ? user.nombre.split(' ').map(n => n.charAt(0)).join('').toUpperCase().substring(0, 2)
    : 'SA';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: '#6366f1' }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          
          {editing ? (
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
              <TouchableOpacity onPress={() => setEditing(false)} style={styles.editActionBtn}>
                <Ionicons name="close-circle" size={26} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: theme.text }]}>
                {user?.nombre}
              </Text>
              <TouchableOpacity onPress={() => setEditing(true)} style={styles.editBtn}>
                <Ionicons name="create-outline" size={18} color={Brand.green} />
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.email, { color: theme.textSecondary }]}>{user?.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: '#6366f1' + '20' }]}>
            <Text style={[styles.roleText, { color: '#6366f1' }]}>
              {user?.role === 'superadmin' ? '👑 Super Admin' : '🛡️ Admin'}
            </Text>
          </View>
        </View>

        {/* Role Switcher */}
        {user && user.roles && user.roles.length > 1 && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={styles.infoLabel}>
              Vista de Rol Activa
            </Text>
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

        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: theme.border }]}
          onPress={() => Alert.alert('Cerrar sesión', '¿Estás seguro?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', style: 'destructive', onPress: signOut },
          ])}
        >
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
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '700' },
  email: { fontSize: 14 },
  roleBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.base, paddingVertical: Spacing.xs },
  roleText: { fontSize: 13, fontWeight: '700' },
  logoutBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, paddingVertical: 14 },
  logoutText: { color: '#ef4444', fontSize: 15, fontWeight: '700' },
  card: {
    width: '100%',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.base,
  },
  infoLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', color: 'rgba(255, 255, 255, 0.45)' },
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
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    width: '100%',
    paddingHorizontal: Spacing.xl,
  },
  inputEdit: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingVertical: 6,
    paddingHorizontal: Spacing.base,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  editActionBtn: {
    padding: Spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  editBtn: {
    padding: Spacing.xs,
  },
});
