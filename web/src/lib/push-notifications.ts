import { supabase } from '@/lib/supabase';

// Mapear niveles del UI a categorías de base de datos (igual que en mobile)
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

// Función central para enviar a Expo
const sendPushNotifications = async (tokens: string[], title: string, body: string, extraData?: Record<string, any>) => {
  if (!tokens || tokens.length === 0) return;
  
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
      console.log('Push notification result:', result);
    } catch (error) {
      console.error('Error sending push notifications chunk:', error);
    }
  }
};

export const sendNotificationToAll = async (title: string, body: string, extraData?: Record<string, any>) => {
  try {
    const { data: tokensData, error } = await supabase
      .from('push_tokens')
      .select('token');
      
    if (error) {
      console.error('Error fetching push tokens:', error);
      return;
    }
    
    if (tokensData && tokensData.length > 0) {
      const tokens = tokensData.map((t: any) => t.token);
      await sendPushNotifications(tokens, title, body, extraData);
    }
  } catch (err) {
    console.error('Exception in sendNotificationToAll:', err);
  }
};

export const sendNotificationToNivel = async (nivel: string, title: string, body: string, extraData?: Record<string, any>) => {
  try {
    const categories = getCompatibleCategories(nivel);
    
    const { data: tokensData, error } = await supabase
      .from('push_tokens')
      .select('token, perfiles_usuarios!inner(categoria)')
      .in('perfiles_usuarios.categoria', categories);
      
    if (error) {
      console.error('Error fetching push tokens by nivel:', error);
      return;
    }
    
    if (tokensData && tokensData.length > 0) {
      const tokens = tokensData.map((t: any) => t.token);
      await sendPushNotifications(tokens, title, body, extraData);
    }
  } catch (err) {
    console.error('Exception in sendNotificationToNivel:', err);
  }
};

export const sendNotificationToUser = async (userId: string, title: string, body: string, extraData?: Record<string, any>) => {
  try {
    const { data: tokensData, error } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('perfil_id', userId);
      
    if (error) {
      console.error('Error fetching push tokens by user:', error);
      return;
    }
    
    if (tokensData && tokensData.length > 0) {
      const tokens = tokensData.map((t: any) => t.token);
      await sendPushNotifications(tokens, title, body, extraData);
    }
  } catch (err) {
    console.error('Exception in sendNotificationToUser:', err);
  }
};
