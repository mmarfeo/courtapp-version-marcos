import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { Brand, Spacing, Radius, Shadow } from '@/constants/theme';
import { ConfirmModal } from '@/components/confirm-modal';
import CourtUpModal from '@/components/CourtUpModal';

type Club = {
  id: number;
  nombre: string;
  slug: string;
  activa: boolean;
};

type StaffMember = {
  usuario_id?: string;
  organizacion_id?: number;
  usuario?: {
    id: string;
    nombre: string;
    email: string;
    rol: string;
    roles?: string[];
  } | null;
  id?: string;
  nombre?: string;
  email?: string;
  rol?: string;
  roles?: string[];
};

export default function AdminClubesScreen() {
  const theme = useTheme();
  const [clubes, setClubes] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal control
  const [activeModal, setActiveModal] = useState<'none' | 'create_club' | 'club_details' | 'create_staff' | 'staff_actions'>('none');
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // New Club form state
  const [newClubName, setNewClubName] = useState('');
  const [newClubSlug, setNewClubSlug] = useState('');
  const [submittingClub, setSubmittingClub] = useState(false);

  // New Staff form state
  const [staffNombre, setStaffNombre] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [submittingStaff, setSubmittingStaff] = useState(false);
  const [staffRoles, setStaffRoles] = useState<string[]>(['Profesor']);

  // Edit Staff form state
  const [editStaffNombre, setEditStaffNombre] = useState('');
  const [editStaffEmail, setEditStaffEmail] = useState('');

  // Confirm Modal state for toggle status
  const [confirmToggleVisible, setConfirmToggleVisible] = useState(false);
  const [clubToToggle, setClubToToggle] = useState<Club | null>(null);

  // Info Modal state for success/errors
  const [infoVisible, setInfoVisible] = useState(false);
  const [infoTitle, setInfoTitle] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const showInfo = (title: string, message: string) => {
    setInfoTitle(title);
    setInfoMessage(message);
    setInfoVisible(true);
  };

  const fetchClubes = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('organizaciones')
        .select('id, nombre, slug, activa')
        .order('nombre');
      if (data) setClubes(data as any);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchClubes(); }, [fetchClubes]);

  const fetchClubStaff = async (clubId: number) => {
    setLoadingStaff(true);
    try {
      const { data, error } = await supabase
        .from('miembros_organizacion')
        .select('usuario_id, organizacion_id, usuario:perfiles_usuarios(id, nombre, email, rol, roles)')
        .eq('organizacion_id', clubId);

      if (error) throw error;
      setStaff(data as any || []);
    } catch (err: any) {
      showInfo('Error de carga', err.message || 'No se pudieron obtener los miembros del staff.');
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleUpdateStaffRole = async (usuarioId: string, newRole: string) => {
    try {
      const rolesArray = newRole.split(', ').filter(Boolean);
      const dbRol = rolesArray.length > 0 ? rolesArray[0] : 'Jugador';

      const { error } = await supabase
        .from('perfiles_usuarios')
        .update({ rol: dbRol, roles: rolesArray })
        .eq('id', usuarioId);
      if (error) throw error;
      showInfo('Rol Actualizado', `El miembro ahora tiene el rol de ${newRole}.`);
      if (selectedClub) fetchClubStaff(selectedClub.id);
    } catch (err: any) {
      console.error(err);
      showInfo('Error', err.message || 'No se pudo actualizar el rol.');
    }
  };

  const handleRemoveStaff = async (usuarioId: string, clubId: number) => {
    try {
      const { error } = await supabase
        .from('miembros_organizacion')
        .delete()
        .eq('usuario_id', usuarioId)
        .eq('organizacion_id', clubId);
      if (error) throw error;
      showInfo('Miembro Eliminado', 'Se ha retirado al miembro del club.');
      fetchClubStaff(clubId);
    } catch (err: any) {
      console.error(err);
      showInfo('Error', err.message || 'No se pudo eliminar al miembro.');
    }
  };

  const showStaffActions = (u: any) => {
    setSelectedStaff(u);
    setEditStaffNombre(u.nombre || '');
    setEditStaffEmail(u.email || '');
    setActiveModal('staff_actions');
  };

  const handleUpdateStaffInfo = async () => {
    if (!selectedStaff) return;
    if (!editStaffNombre.trim() || !editStaffEmail.trim()) {
      showInfo('Campos vacíos', 'El nombre y el email no pueden estar vacíos.');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('perfiles_usuarios')
        .update({ 
          nombre: editStaffNombre.trim(),
          email: editStaffEmail.trim()
        })
        .eq('id', selectedStaff.id);
        
      if (error) throw error;
      showInfo('Miembro Actualizado', 'Los datos del miembro se han actualizado con éxito.');
      if (selectedClub) fetchClubStaff(selectedClub.id);
      setActiveModal('club_details');
    } catch (err: any) {
      console.error(err);
      showInfo('Error', err.message || 'No se pudieron actualizar los datos del miembro.');
    }
  };

  const handleCreateClub = async () => {
    if (!newClubName.trim() || !newClubSlug.trim()) {
      showInfo('Campos incompletos', 'Por favor ingresa el nombre y el slug del club.');
      return;
    }
    setSubmittingClub(true);
    try {
      const { error } = await supabase.from('organizaciones').insert([{
        nombre: newClubName.trim(),
        slug: newClubSlug.trim().toLowerCase(),
        activa: true,
      }]);
      if (error) throw error;

      showInfo('¡Club Creado!', `El club ${newClubName} se ha registrado con éxito.`);
      setNewClubName('');
      setNewClubSlug('');
      setActiveModal('none');
      fetchClubes();
    } catch (err: any) {
      showInfo('Error', err.message || 'No se pudo crear el club.');
    } finally {
      setSubmittingClub(false);
    }
  };

  const handleToggleClubStatus = async () => {
    if (!clubToToggle) return;
    setConfirmToggleVisible(false);
    try {
      const nextState = !clubToToggle.activa;
      const { error } = await supabase
        .from('organizaciones')
        .update({ activa: nextState })
        .eq('id', clubToToggle.id);

      if (error) throw error;

      showInfo('Estado Actualizado', `El club ha sido ${nextState ? 'activado' : 'desactivado'} con éxito.`);
      fetchClubes();
    } catch (err: any) {
      showInfo('Error', err.message || 'No se pudo cambiar el estado.');
    } finally {
      setClubToToggle(null);
    }
  };

  const handleCreateStaff = async () => {
    if (!staffNombre.trim() || !staffEmail.trim() || !staffPassword.trim()) {
      showInfo('Campos incompletos', 'Por favor completa todos los campos.');
      return;
    }
    if (!selectedClub) return;

    setSubmittingStaff(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: staffEmail.trim(),
          password: staffPassword.trim(),
          nombre: staffNombre.trim(),
          roles: staffRoles.length > 0 ? staffRoles : ['Jugador'],
          organizacion_ids: [selectedClub.id],
        },
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Error al crear usuario.');

      showInfo('¡Alta Exitosa!', `Se ha creado el usuario ${staffNombre} con el rol de ${staffRoles.join(', ')}.`);
      setStaffNombre('');
      setStaffEmail('');
      setStaffPassword('');
      setStaffRoles(['Profesor']);
      setActiveModal('club_details');
      fetchClubStaff(selectedClub.id);
    } catch (err: any) {
      console.error('Error creating staff:', err);
      showInfo('Error al dar de alta', err.message || 'Ocurrió un error inesperado.');
    } finally {
      setSubmittingStaff(false);
    }
  };

  const openClubDetails = (club: Club) => {
    setSelectedClub(club);
    fetchClubStaff(club.id);
    setActiveModal('club_details');
  };

  const renderClub = ({ item }: { item: Club }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, Shadow.sm]}
      onPress={() => openClubDetails(item)}
      activeOpacity={0.8}
    >
      <View style={[styles.clubIcon, { backgroundColor: Brand.orange + '20' }]}>
        <Ionicons name="business" size={20} color={Brand.orange} />
      </View>
      <View style={styles.cardInfo}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>{item.nombre}</Text>
        <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
          slug: {item.slug}
        </Text>
      </View>
      <TouchableOpacity
        style={[
          styles.estadoBadge,
          {
            backgroundColor: item.activa ? Brand.orange + '20' : '#6b7280' + '20',
            borderColor: item.activa ? Brand.orange : '#6b7280',
          },
        ]}
        onPress={() => {
          setClubToToggle(item);
          setConfirmToggleVisible(true);
        }}
      >
        <Text style={[styles.estadoText, { color: item.activa ? Brand.orange : '#6b7280' }]}>
          {item.activa ? 'activo' : 'inactivo'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Clubes</Text>
          <Text style={[styles.headerSub, { color: '#9ca3af' }]}>{clubes.length} registrados</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: Brand.orange }]}
          onPress={() => setActiveModal('create_club')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Nuevo Club</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.orange} />
        </View>
      ) : (
        <FlatList
          data={clubes}
          renderItem={renderClub}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchClubes(); }} tintColor={Brand.orange} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="business-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No hay clubes registrados</Text>
            </View>
          }
        />
      )}

      {/* Confirmation Modal for club toggle */}
      <ConfirmModal
        visible={confirmToggleVisible}
        title={clubToToggle?.activa ? 'Desactivar Club' : 'Activar Club'}
        message={`¿Estás seguro de que deseas ${clubToToggle?.activa ? 'desactivar' : 'activar'} el club "${clubToToggle?.nombre}"?`}
        confirmText={clubToToggle?.activa ? 'Desactivar' : 'Activar'}
        onConfirm={handleToggleClubStatus}
        onCancel={() => {
          setConfirmToggleVisible(false);
          setClubToToggle(null);
        }}
      />

      {/* Modal: Create Club */}
      <CourtUpModal
        visible={activeModal === 'create_club'}
        onClose={() => setActiveModal('none')}
      >
        <View style={{ flex: 1 }}>
          <View style={[styles.container, { padding: 0, flex: 1 }]}>
            {/* Accent Orange Bar */}
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              backgroundColor: Brand.orange,
            }} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitleText, { color: theme.text }]}>Crear Club</Text>
              <TouchableOpacity onPress={() => setActiveModal('none')}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={{ color: theme.textSecondary, marginBottom: 4 }}>Nombre del Club</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                  placeholder="ej: Buenos Aires Lawn Tennis"
                  placeholderTextColor={theme.textMuted}
                  value={newClubName}
                  onChangeText={(text) => {
                    setNewClubName(text);
                    // Autofill slug from name
                    setNewClubSlug(text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                  }}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={{ color: theme.textSecondary, marginBottom: 4 }}>Slug único (URL)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                  placeholder="ej: baltc"
                  placeholderTextColor={theme.textMuted}
                  value={newClubSlug}
                  onChangeText={setNewClubSlug}
                />
              </View>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Brand.orange }, submittingClub && { opacity: 0.7 }]}
                onPress={handleCreateClub}
                disabled={submittingClub}
              >
                {submittingClub ? <Text style={styles.actionBtnText}>Creando...</Text> : <Text style={styles.actionBtnText}>Crear Club</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </CourtUpModal>

      {/* Modal: Club Details & Staff List */}
      <CourtUpModal
        visible={activeModal === 'club_details'}
        onClose={() => setActiveModal('none')}
      >
        <View style={{ flex: 1 }}>
          <View style={[styles.container, { padding: 0, flex: 1 }]}>
            {/* Accent Orange Bar */}
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              backgroundColor: Brand.orange,
            }} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitleText, { color: theme.text }]}>{selectedClub?.nombre}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>slug: {selectedClub?.slug}</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal('none')}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.staffHeader}>
              <Text style={[styles.staffSectionTitle, { color: theme.text }]}>Staff Miembros</Text>
              <TouchableOpacity
                style={[styles.addStaffBtn, { borderColor: Brand.orange }]}
                onPress={() => setActiveModal('create_staff')}
              >
                <Ionicons name="person-add-outline" size={14} color={Brand.orange} />
                <Text style={{ color: Brand.orange, fontSize: 12, fontWeight: '700' }}>Alta Staff</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1, marginTop: Spacing.sm }}>
              {loadingStaff ? (
                <Text style={{ color: theme.textSecondary, textAlign: 'center', marginVertical: Spacing.xl }}>Cargando staff...</Text>
              ) : (
                <FlatList
                  data={staff.filter(item => (item.usuario?.rol || item.rol) !== 'SuperAdmin')}
                  keyExtractor={(item, index) => index.toString()}
                  contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.xl }}
                  renderItem={({ item }) => {
                    const u = item.usuario || item;
                    return (
                      <View style={[styles.staffCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.staffName, { color: theme.text }]}>{u?.nombre}</Text>
                          <Text style={[styles.staffEmail, { color: theme.textSecondary }]}>{u?.email}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                          <View style={[styles.roleBadge, { backgroundColor: Brand.orange + '15' }]}>
                            <Text style={[styles.roleText, { color: Brand.orange }]}>
                              {u?.roles && u.roles.length > 0 ? u.roles.filter((r:string)=>r!=='Jugador').join(', ') : (u?.rol || 'Staff')}
                            </Text>
                          </View>
                          <TouchableOpacity onPress={() => showStaffActions(u)}>
                            <Ionicons name="ellipsis-vertical" size={18} color={theme.textSecondary} style={{ paddingHorizontal: 4 }} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }}
                  ListEmptyComponent={
                    <Text style={{ color: theme.textMuted, textAlign: 'center', marginVertical: Spacing.xl }}>
                      No hay miembros asignados a este club.
                    </Text>
                  }
                />
              )}
            </View>
          </View>
        </View>
      </CourtUpModal>

      {/* Modal: Create Staff */}
      <CourtUpModal
        visible={activeModal === 'create_staff'}
        onClose={() => setActiveModal('club_details')}
      >
        <View style={{ flex: 1 }}>
          <View style={[styles.container, { padding: 0, flex: 1 }]}>
            {/* Accent Orange Bar */}
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              backgroundColor: Brand.orange,
            }} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitleText, { color: theme.text }]}>Alta de Staff</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Club: {selectedClub?.nombre}</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal('club_details')}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={{ color: theme.textSecondary, marginBottom: 4 }}>Nombre Completo</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                  placeholder="ej: Juan Pérez"
                  placeholderTextColor={theme.textMuted}
                  value={staffNombre}
                  onChangeText={setStaffNombre}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={{ color: theme.textSecondary, marginBottom: 4 }}>Email</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                  placeholder="ej: juan@club.com"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={staffEmail}
                  onChangeText={setStaffEmail}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={{ color: theme.textSecondary, marginBottom: 4 }}>Contraseña</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                  value={staffPassword}
                  onChangeText={setStaffPassword}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={{ color: theme.textSecondary, marginBottom: 6 }}>Nivel de Acceso (Rol)</Text>
                <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                  {['Profesor', 'Organizador'].map((r) => {
                    const isActive = staffRoles.includes(r);
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.roleSelector,
                          isActive
                            ? { backgroundColor: Brand.orange, borderColor: Brand.orange }
                            : { backgroundColor: theme.background, borderColor: theme.border },
                        ]}
                        onPress={() => {
                          setStaffRoles(prev => 
                            prev.includes(r) 
                              ? prev.filter(role => role !== r) 
                              : [...prev, r]
                          );
                        }}
                      >
                        <Text style={[styles.roleSelectorText, isActive ? { color: '#fff' } : { color: theme.text }]}>
                          {r}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Brand.orange }, submittingStaff && { opacity: 0.7 }]}
                onPress={handleCreateStaff}
                disabled={submittingStaff}
              >
                {submittingStaff ? <Text style={styles.actionBtnText}>Registrando...</Text> : <Text style={styles.actionBtnText}>Registrar Staff</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </CourtUpModal>

      {/* Modal: Staff Actions (Edit/Delete) */}
      <CourtUpModal
        visible={activeModal === 'staff_actions'}
        onClose={() => setActiveModal('club_details')}
      >
        <View style={{ flex: 1 }}>
          <View style={[styles.container, { padding: 0, flex: 1 }]}>
            {/* Accent Orange Bar */}
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              backgroundColor: Brand.orange,
            }} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitleText, { color: theme.text }]}>Gestionar Miembro</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{selectedStaff?.nombre}</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal('club_details')}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer} style={{ marginTop: Spacing.md }}>
              <View style={styles.inputGroup}>
                <Text style={{ color: theme.textSecondary, marginBottom: 4 }}>Nombre Completo</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                  value={editStaffNombre}
                  onChangeText={setEditStaffNombre}
                  placeholder="Nombre del miembro"
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={{ color: theme.textSecondary, marginBottom: 4 }}>Email</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                  value={editStaffEmail}
                  onChangeText={setEditStaffEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="Email del miembro"
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              <Text style={{ color: Brand.orange, fontSize: 11, fontWeight: '800', marginTop: 4, textTransform: 'uppercase' }}>
                Rol actual: {selectedStaff?.roles && selectedStaff.roles.length > 0 ? selectedStaff.roles.filter((r:string)=>r!=='Jugador').join(', ') : (selectedStaff?.rol || 'Staff')}
              </Text>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Brand.orange }]}
                onPress={handleUpdateStaffInfo}
              >
                <Text style={styles.actionBtnText}>Guardar Cambios</Text>
              </TouchableOpacity>

              <Text style={{ color: theme.textSecondary, marginBottom: 4, marginTop: 12 }}>Editar Nivel de Acceso (Rol)</Text>
              <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: 12 }}>
                {['Profesor', 'Organizador'].map(r => {
                  const currentRoles = (selectedStaff?.roles && selectedStaff.roles.length > 0)
                    ? selectedStaff.roles
                    : (selectedStaff?.rol || '').split(', ').filter(Boolean);
                  const isActive = currentRoles.includes(r);
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.roleSelector,
                        isActive
                          ? { backgroundColor: Brand.orange, borderColor: Brand.orange }
                          : { backgroundColor: 'transparent', borderColor: Brand.orange },
                      ]}
                      onPress={() => {
                        let newRoles = [...currentRoles];
                        if (isActive) {
                          newRoles = newRoles.filter(role => role !== r);
                          if (newRoles.length === 0) newRoles = ['Jugador'];
                        } else {
                          newRoles.push(r);
                        }
                        const newRoleStr = newRoles.join(', ');
                        handleUpdateStaffRole(selectedStaff?.id, newRoleStr);
                        setSelectedStaff({...selectedStaff, rol: newRoles.length > 0 ? newRoles[0] : 'Jugador', roles: newRoles});
                      }}
                    >
                      <Text style={[styles.roleSelectorText, { color: isActive ? '#fff' : Brand.orange }]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}
                onPress={() => {
                  if (selectedStaff && selectedClub) {
                    Alert.alert(
                      'Confirmar Eliminación',
                      `¿Estás seguro de que deseas retirar a ${selectedStaff.nombre} del club ${selectedClub.nombre}?`,
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Eliminar',
                          style: 'destructive',
                          onPress: () => {
                            handleRemoveStaff(selectedStaff.id, selectedClub.id);
                            setActiveModal('club_details');
                          }
                        }
                      ]
                    );
                  }
                }}
              >
                <Text style={styles.actionBtnText}>Eliminar del Club</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: theme.border }]}
                onPress={() => setActiveModal('club_details')}
              >
                <Text style={[styles.actionBtnText, { color: theme.text }]}>Volver</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </CourtUpModal>

      {/* Info Modal for Success / Warning alerts */}
      <ConfirmModal
        visible={infoVisible}
        title={infoTitle}
        message={infoMessage}
        confirmText="Aceptar"
        type="info"
        onConfirm={() => setInfoVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.xxxl + Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },
  headerSub: { fontSize: 14, marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  list: { padding: Spacing.base, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.base,
    gap: Spacing.md,
  },
  clubIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  clubEmoji: { fontSize: 22 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  cardSub: { fontSize: 12 },
  estadoBadge: { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  estadoText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: Spacing.xxxl, gap: Spacing.base },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15 },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 340,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.base,
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: '800',
  },
  formContainer: {
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  inputGroup: {
    gap: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    fontSize: 14,
  },
  actionBtn: {
    borderRadius: Radius.md,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  // Details Modal styles
  staffHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  staffSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addStaffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  staffName: {
    fontSize: 14,
    fontWeight: '700',
  },
  staffEmail: {
    fontSize: 12,
  },
  roleBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Role Selector for Staff Create
  roleSelector: {
    flex: 1,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleSelectorText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
