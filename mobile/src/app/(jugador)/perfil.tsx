import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { Brand, Spacing, Radius, Shadow } from '@/constants/theme';

export default function PerfilJugadorScreen() {
  const { user, signOut, switchRole, updateName, updateCategory, updatePhone } = useAuth();
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [editingCategory, setEditingCategory] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [newName, setNewName] = useState(user?.nombre || '');
  const [newPhone, setNewPhone] = useState(user?.telefono || '');

  useEffect(() => {
    if (user?.nombre) {
      setNewName(user.nombre);
    }
    if (user?.telefono !== undefined) {
      setNewPhone(user.telefono || '');
    }
  }, [user?.nombre, user?.telefono]);

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

  const handleSaveCategory = async (cat: string) => {
    const { error } = await updateCategory(cat);
    if (error) {
      Alert.alert('Error', 'No se pudo actualizar la categoría');
    } else {
      setEditingCategory(false);
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

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const handleSignOut = () => {
    setLogoutModalVisible(true);
  };

  const initials = user?.nombre
    ? user.nombre.split(' ').map((n: string) => n.charAt(0)).join('').toUpperCase().substring(0, 2)
    : '?';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: Brand.green }]}>
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
          <View style={[styles.roleBadge, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.roleText, { color: Brand.green }]}>
              🎾 Jugador
            </Text>
          </View>
        </View>

        {/* Info */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <InfoRow icon="mail-outline" label="Email" value={user?.email || '--'} theme={theme} />
          <InfoRow icon="person-outline" label="Nombre" value={user?.nombre || '--'} theme={theme} />
          
          {/* Teléfono editable */}
          {editingPhone ? (
            <View style={[styles.infoRowEditable, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: Spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                  <Ionicons name="call-outline" size={18} color={Brand.green} />
                  <Text style={[styles.infoLabel, { color: theme.textMuted, marginBottom: 0 }]}>Teléfono</Text>
                </View>
                <TouchableOpacity onPress={() => setEditingPhone(false)}>
                  <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>Cancelar</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <TextInput
                  style={[styles.inputEdit, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card, flex: 1, height: 40, marginTop: 0 }]}
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
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.infoRow, { borderBottomWidth: 1, borderBottomColor: theme.border }]}
              onPress={() => setEditingPhone(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="call-outline" size={18} color={Brand.green} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Teléfono</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{user?.telefono || 'No asignado'}</Text>
              </View>
              <Ionicons name="create-outline" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
          
          {/* Categoría editable */}
          {editingCategory ? (
            <View style={[styles.infoRowEditable, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: Spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                  <Ionicons name="fitness-outline" size={18} color={Brand.green} />
                  <Text style={[styles.infoLabel, { color: theme.textMuted, marginBottom: 0 }]}>Categoría / Nivel</Text>
                </View>
                <TouchableOpacity onPress={() => setEditingCategory(false)}>
                  <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>Cancelar</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.categoryGrid}>
                {['SuperA', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryBtn,
                      user?.categoria === cat && styles.categoryBtnActive,
                      { borderColor: theme.border }
                    ]}
                    onPress={() => handleSaveCategory(cat)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.categoryBtnText,
                        { color: user?.categoria === cat ? Brand.green : theme.textSecondary }
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.infoRow, { borderBottomWidth: 1, borderBottomColor: theme.border }]}
              onPress={() => setEditingCategory(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="fitness-outline" size={18} color={Brand.green} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Categoría / Nivel</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{user?.categoria || 'No asignada'}</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}

          <InfoRow icon="shield-checkmark-outline" label="Rol Activo" value="Jugador" theme={theme} last />
        </View>

        {/* Role Switcher */}
        {user && user.roles && user.roles.length > 1 && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: Spacing.base, gap: Spacing.sm }]}>
            <Text style={[styles.infoLabel, { color: theme.textMuted, fontSize: 11, marginBottom: Spacing.xs }]}>
              Vista de Rol Activa
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
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

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: theme.border }]}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Custom Logout Modal */}
      {logoutModalVisible && (
        <View style={[StyleSheet.absoluteFill, styles.modalOverlay]} pointerEvents="box-none">
          <View style={styles.modalBackdrop} />
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Cerrar Sesión</Text>
            </View>
            <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>
              ¿Estás seguro que querés salir de tu cuenta?
            </Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: 'transparent', borderColor: theme.border, borderWidth: 1 }]}
                onPress={() => setLogoutModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#ef4444' }]}
                onPress={() => {
                  setLogoutModalVisible(false);
                  signOut();
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Salir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function InfoRow({ icon, label, value, theme, last }: {
  icon: string; label: string; value: string; theme: any; last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
      <Ionicons name={icon as any} size={18} color={Brand.green} />
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: theme.textMuted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text>
      </View>
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
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  content: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.base,
    alignItems: 'center',
  },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Brand.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '700' },
  email: { fontSize: 14 },
  roleBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.xs,
  },
  roleText: { fontSize: 13, fontWeight: '700' },
  card: {
    width: '100%',
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    gap: Spacing.base,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: '500' },
  logoutBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: 14,
    marginTop: Spacing.base,
  },
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
  infoRowEditable: {
    padding: Spacing.base,
    flexDirection: 'column',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  categoryBtn: {
    width: '22%',
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderRadius: Radius.md,
    marginBottom: 6,
  },
  categoryBtnActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderColor: '#ff6b35',
  },
  categoryBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  modalContent: {
    width: '100%',
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalDesc: {
    fontSize: 14,
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
