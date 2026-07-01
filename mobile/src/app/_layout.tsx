import { useEffect, useState } from 'react';
console.log('==== APP STARTING (ROOT LAYOUT) ====');
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity, Alert } from 'react-native';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { Brand } from '@/constants/theme';
import * as Updates from 'expo-updates';
import { useNotifications } from '@/hooks/use-notifications';
import { supabase } from '@/lib/supabase';
import { ConfirmModal } from '@/components/confirm-modal';
import AsyncStorage from '@react-native-async-storage/async-storage';

function OTAUpdateModal() {
  const { isUpdateAvailable, isUpdatePending, isDownloading } = Updates.useUpdates();

  if (isUpdatePending) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.updateOverlay]}>
        <View style={[styles.updateCard, { overflow: 'hidden' }]}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: Brand.orange }} />
          <Text style={styles.updateTitle}>¡Nueva Versión!</Text>
          <Text style={styles.updateDesc}>Hemos lanzado mejoras para CourtUp. Debes instalar la actualización para continuar.</Text>
          <TouchableOpacity 
            style={styles.updateButton} 
            activeOpacity={0.8}
            onPress={() => Updates.reloadAsync()}
          >
            <Text style={styles.updateButtonText}>Actualizar Ahora</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isUpdateAvailable && isDownloading) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.updateOverlay]}>
        <View style={[styles.updateCard, { overflow: 'hidden' }]}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: Brand.orange }} />
          <ActivityIndicator size="large" color={Brand.orange} />
          <Text style={[styles.updateDesc, { marginTop: 20, textAlign: 'center' }]}>
            Descargando actualización...
          </Text>
        </View>
      </View>
    );
  }

  return null;
}

function RootLayoutContent() {
  const { user, loading } = useAuth();
  const { registerForPushNotificationsAsync, saveTokenToSupabase } = useNotifications();
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  useEffect(() => {
    if (loading || !user) return;

    AsyncStorage.getItem('asked_push_permission').then(asked => {
      if (!asked) {
        setShowPushPrompt(true);
      } else {
        registerForPushNotificationsAsync().then(token => {
          if (token) saveTokenToSupabase(token, user.id);
        });
      }
    });
  }, [user, loading]);

  const handleAllowPush = async () => {
    setShowPushPrompt(false);
    await AsyncStorage.setItem('asked_push_permission', 'true');
    const token = await registerForPushNotificationsAsync();
    if (token && user) {
      saveTokenToSupabase(token, user.id);
    }
  };

  const handleDenyPush = async () => {
    setShowPushPrompt(false);
    await AsyncStorage.setItem('asked_push_permission', 'true');
  };

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/auth/login');
      return;
    }

    // Check for forced password reset
    if ((user as any).user_metadata?.force_password_reset) {
      Alert.alert(
        'Actualización Requerida',
        'Por seguridad, tu primer ingreso debe ser desde la web (courtup.com) para establecer tu contraseña definitiva.',
        [{ text: 'Entendido', onPress: () => {
            supabase.auth.signOut();
            router.replace('/auth/login');
        } }]
      );
      return;
    }

    // Redirect based on role
    switch (user.role) {
      case 'superadmin':
      case 'admin':
        router.replace('/(admin)/dashboard');
        break;
      case 'organizador':
        router.replace('/(organizador)/torneos');
        break;
      case 'profesor':
        router.replace('/(profesor)/agenda');
        break;
      case 'jugador':
      default:
        router.replace('/(jugador)/chat');
        break;
    }
  }, [user, loading]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Brand.green} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="(jugador)" />
        <Stack.Screen name="(organizador)" />
        <Stack.Screen name="(profesor)" />
        <Stack.Screen name="(admin)" />
      </Stack>
      <OTAUpdateModal />
      <ConfirmModal
        visible={showPushPrompt}
        title="¡Enterate de todo!"
        message="Habilitá las notificaciones para recibir alertas al instante sobre tus partidos, torneos y reservas de canchas."
        confirmText="Habilitar"
        cancelText="Ahora no"
        onConfirm={handleAllowPush}
        onCancel={handleDenyPush}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  updateOverlay: {
    zIndex: 9999,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  updateCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  updateTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 12,
  },
  updateDesc: {
    color: '#a3a3a3',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  updateButton: {
    backgroundColor: Brand.orange,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
