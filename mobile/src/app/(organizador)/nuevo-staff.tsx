import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { Brand, Spacing, Radius } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function NuevoStaffScreen() {
  const { user } = useAuth();
  const theme = useTheme();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [clubesDisponibles, setClubesDisponibles] = useState<any[]>([]);
  const [selectedClubs, setSelectedClubs] = useState<number[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingClubes, setLoadingClubes] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchClubes = async () => {
      try {
        if (!user) return;
        let orgsActivas: any[] = [];
        
        // Fetch all organizations
        const { data: orgs } = await supabase.from('organizaciones').select('*').eq('activa', true);
        if (orgs) orgsActivas = orgs;

        // Filter if not SuperAdmin
        if (user.role !== 'superadmin') {
          const { data: membresias } = await supabase
            .from('miembros_organizacion')
            .select('organizacion_id')
            .eq('usuario_id', user.id);
            
          const userOrgIds = membresias?.map((m: any) => m.organizacion_id) || [];
          orgsActivas = orgsActivas.filter(o => userOrgIds.includes(o.id));
        }

        setClubesDisponibles(orgsActivas);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingClubes(false);
      }
    };

    fetchClubes();
  }, [user]);

  const handleToggleClub = (id: number) => {
    setSelectedClubs(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleCrear = async () => {
    if (!nombre || !email || !password) {
      Alert.alert('Error', 'Completá todos los campos.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (selectedClubs.length === 0) {
      Alert.alert('Error', 'Seleccioná al menos un club.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: email.trim().toLowerCase(),
          password,
          nombre,
          roles: ['Profesor'],
          organizacion_ids: selectedClubs
        }
      });

      if (error) throw new Error(error.message || 'Error al conectar con la función edge');
      if (!data?.success) throw new Error(data?.error || 'Error desconocido');

      setSuccess(true);
    } catch (err: any) {
      Alert.alert('Error al crear profesor', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }]}>
        <Ionicons name="checkmark-circle" size={80} color={Brand.green} style={{ marginBottom: Spacing.md }} />
        <Text style={[styles.title, { color: theme.text, textAlign: 'center', marginBottom: Spacing.sm }]}>¡Profesor Creado!</Text>
        <Text style={[styles.desc, { color: theme.textMuted, textAlign: 'center', marginBottom: Spacing.xxl }]}>
          El profesor ha sido registrado exitosamente en los clubes seleccionados.
        </Text>
        <TouchableOpacity 
          style={styles.btnAction} 
          onPress={() => {
            setSuccess(false);
            setNombre('');
            setEmail('');
            setPassword('');
            setSelectedClubs([]);
          }}
        >
          <Text style={styles.btnActionText}>Crear Otro Profesor</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <Text style={styles.headerTitle}>Alta Profesor</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textMuted }]}>Nombre Completo</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
              placeholder="Ej: Juan Pérez"
              placeholderTextColor={theme.textMuted}
              value={nombre}
              onChangeText={setNombre}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textMuted }]}>Correo Electrónico</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
              placeholder="juan@tenis.com"
              placeholderTextColor={theme.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textMuted }]}>Contraseña Inicial</Text>
            <View style={{ position: 'relative', justifyContent: 'center' }}>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement, paddingRight: 48 }]}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                style={{ position: 'absolute', right: 0, paddingHorizontal: 16, height: '100%', justifyContent: 'center' }}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 16 }}>{showPassword ? '👁️' : '🙈'}</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, marginTop: Spacing.base }]}>
          <Text style={[styles.label, { color: theme.textMuted, marginBottom: Spacing.md }]}>Clubes Asignados</Text>
          
          {loadingClubes ? (
            <ActivityIndicator color={Brand.green} />
          ) : clubesDisponibles.length === 0 ? (
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>No hay clubes disponibles.</Text>
          ) : (
            clubesDisponibles.map(club => (
              <TouchableOpacity
                key={club.id}
                style={[
                  styles.clubOption, 
                  { borderColor: theme.border, backgroundColor: selectedClubs.includes(club.id) ? 'rgba(16, 185, 129, 0.1)' : theme.backgroundElement }
                ]}
                onPress={() => handleToggleClub(club.id)}
                activeOpacity={0.7}
              >
                <View style={styles.clubOptionLeft}>
                  <Ionicons 
                    name={selectedClubs.includes(club.id) ? "checkbox" : "square-outline"} 
                    size={22} 
                    color={selectedClubs.includes(club.id) ? Brand.green : theme.textMuted} 
                  />
                  <Text style={[styles.clubOptionText, { color: theme.text }]}>{club.nombre}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <TouchableOpacity 
          style={[styles.btnSubmit, loading && { opacity: 0.7 }]} 
          onPress={handleCrear}
          disabled={loading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#10b981', '#059669']}
            style={styles.btnGradient}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnSubmitText}>Crear Profesor</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
        
      </ScrollView>
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
    paddingBottom: Spacing.xxxl * 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  desc: {
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.base,
    gap: Spacing.base,
  },
  field: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 15,
  },
  clubOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  clubOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  clubOptionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  btnSubmit: {
    marginTop: Spacing.xl,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    shadowColor: Brand.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  btnAction: {
    backgroundColor: Brand.green,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: Radius.lg,
  },
  btnActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
