import { useEffect, useRef, useState } from 'react';
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';

// Configurar cómo se comportan las notificaciones cuando la app está abierta (primer plano)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  // Función para solicitar permisos y obtener el token de notificaciones de Expo
  const registerForPushNotificationsAsync = async () => {
    let token = '';

    if (!Device.isDevice) {
      console.warn('Debe usar un dispositivo físico para las notificaciones Push.');
      return '';
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('¡Permiso para notificaciones push denegado!');
        return '';
      }

      // Obtener el projectId desde la configuración de EAS
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

      if (!projectId) {
        console.error('No se encontró el projectId de EAS.');
        return '';
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      token = tokenData.data;
      setExpoPushToken(token);
    } catch (error) {
      console.error('Error al registrar las notificaciones push:', error);
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return token;
  };

  // Guardar el token en la base de datos de Supabase
  const saveTokenToSupabase = async (token: string, userId: string) => {
    if (!token || !userId) return;

    try {
      // Guardar token localmente para poder borrarlo al hacer logout
      await AsyncStorage.setItem('courtup_push_token', token);

      const { error } = await supabase
        .from('push_tokens')
        .upsert(
          {
            perfil_id: userId,
            token,
            plataforma: Platform.OS,
          },
          { onConflict: 'token' }
        );

      if (error) {
        console.error('Error al guardar el token en Supabase:', error);
      } else {
        console.log('Token de notificaciones guardado en Supabase con éxito.');
      }
    } catch (e: any) {
      console.error('Excepción al guardar el token en Supabase:', e);
    }
  };

  // Eliminar el token de la base de datos (por ejemplo, al cerrar sesión)
  const removeTokenFromSupabase = async (token: string) => {
    if (!token) return;

    try {
      const { error } = await supabase
        .from('push_tokens')
        .delete()
        .eq('token', token);

      if (error) {
        console.error('Error al eliminar el token de Supabase:', error);
      } else {
        console.log('Token de notificaciones eliminado de Supabase.');
      }
    } catch (e) {
      console.error('Excepción al eliminar el token de Supabase:', e);
    }
  };

  useEffect(() => {
    // Listener cuando se recibe una notificación y la app está en primer plano
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notificación recibida en primer plano:', notification);
    });

    // Listener cuando el usuario pulsa en la notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener(async response => {
      console.log('Usuario abrió la notificación:', response);
      const data = response.notification.request.content.data;
      if (data && data.claseId) {
        const claseId = data.claseId;
        try {
          // Consultar el estado de la clase en Supabase
          const { data: clase, error } = await supabase
            .from('clases_disponibles')
            .select(`
              id,
              cupo_maximo,
              reservas_clases(*)
            `)
            .eq('id', claseId)
            .single();

          if (error || !clase) {
            Alert.alert('Clase no disponible', 'La clase especificada no existe o fue eliminada.');
            return;
          }

          const approvedBookings = (clase.reservas_clases || []).filter((r: any) => r.estado_pago === 'Aprobado').length;
          if (approvedBookings >= (clase.cupo_maximo || 1)) {
            Alert.alert('Clase Reservada', 'La clase ya fue reservada por otro jugador.');
          } else {
            // Si está disponible, llevar al jugador a la pantalla de clases abriendo la clase específica
            router.push(`/(jugador)/clases?openClaseId=${claseId}`);
          }
        } catch (err) {
          console.error('Error al procesar click de notificación de clase:', err);
        }
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  // Auxiliar para enviar notificaciones en lotes
  const sendPushNotifications = async (tokens: string[], title: string, body: string, extraData?: Record<string, any>) => {
    const chunks = [];
    const chunkSize = 100;
    for (let i = 0; i < tokens.length; i += chunkSize) {
      chunks.push(tokens.slice(i, i + chunkSize));
    }
    
    for (const chunk of chunks) {
      const messages = chunk.map(token => ({
        to: token,
        sound: 'default',
        title,
        body,
        data: extraData,
      }));
      
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messages),
        });
        const result = await response.json();
        console.log('Resultado del envío de notificaciones:', result);
      } catch (error) {
        console.error('Error al enviar lote de notificaciones:', error);
      }
    }
  };

  // Mapear niveles del UI a categorías de base de datos
  const getCompatibleCategories = (target: string): string[] => {
    if (target === 'Todas') {
      return ['SuperA','A+','A','B+','B','C+','C','D'];
    }
    if (target === 'Principiante') {
      return ['C', 'D'];
    }
    if (target === 'Intermedio') {
      return ['B', 'B+', 'C+'];
    }
    if (target === 'Avanzado') {
      return ['SuperA', 'A+', 'A'];
    }
    if (target === 'Cat A') {
      return ['A', 'A+'];
    }
    if (target === 'Cat B') {
      return ['B', 'B+'];
    }
    if (target === 'Cat C') {
      return ['C', 'C+'];
    }
    return [target];
  };

  // Enviar a usuarios de un determinado nivel
  const sendNotificationToNivel = async (nivel: string, title: string, body: string, extraData?: Record<string, any>) => {
    try {
      const categories = getCompatibleCategories(nivel);
      
      const { data: tokensData, error } = await supabase
        .from('push_tokens')
        .select('token, perfiles_usuarios!inner(categoria)')
        .in('perfiles_usuarios.categoria', categories);
        
      if (error) {
        console.error('Error al consultar tokens por nivel:', error);
        return;
      }
      
      if (!tokensData || tokensData.length === 0) {
        console.log('No se encontraron tokens para el nivel:', nivel);
        return;
      }
      
      const tokens = tokensData.map(t => t.token);
      await sendPushNotifications(tokens, title, body, extraData);
    } catch (e) {
      console.error('Error en sendNotificationToNivel:', e);
    }
  };

  // Enviar a todos los usuarios registrados
  const sendNotificationToAll = async (title: string, body: string, extraData?: Record<string, any>) => {
    try {
      const { data: tokensData, error } = await supabase
        .from('push_tokens')
        .select('token');
        
      if (error) {
        console.error('Error al consultar todos los tokens:', error);
        return;
      }
      
      if (!tokensData || tokensData.length === 0) {
        console.log('No se encontraron tokens en la BD');
        return;
      }
      
      const tokens = tokensData.map(t => t.token);
      await sendPushNotifications(tokens, title, body, extraData);
    } catch (e) {
      console.error('Error en sendNotificationToAll:', e);
    }
  };

  // Enviar a un usuario específico por su perfil_id
  const sendNotificationToUser = async (userId: string, title: string, body: string, extraData?: Record<string, any>) => {
    try {
      const { data: tokensData, error } = await supabase
        .from('push_tokens')
        .select('token')
        .eq('perfil_id', userId);
        
      if (error) {
        console.error('Error al consultar tokens por usuario:', error);
        return;
      }
      
      if (!tokensData || tokensData.length === 0) {
        console.log('No se encontraron tokens para el usuario:', userId);
        return;
      }
      
      const tokens = tokensData.map(t => t.token);
      await sendPushNotifications(tokens, title, body, extraData);
    } catch (e) {
      console.error('Error en sendNotificationToUser:', e);
    }
  };

  return {
    expoPushToken,
    registerForPushNotificationsAsync,
    saveTokenToSupabase,
    removeTokenFromSupabase,
    sendNotificationToNivel,
    sendNotificationToAll,
    sendNotificationToUser,
  };
}
