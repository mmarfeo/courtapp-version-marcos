import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { useChatHistory, type ChatMessage } from '@/hooks/use-chat-history';
import { Brand, Spacing, Radius } from '@/constants/theme';

const API_BASE = (process.env.EXPO_PUBLIC_API_URL || 'https://courtup-web.vercel.app').replace(/\/$/, '');
const FIRST_TIME_KEY = 'courtup_chat_first_time';

const TOOL_LABELS: Record<string, string> = {
  buscar_canchas_disponibles: 'Buscando canchas disponibles...',
  crear_reserva_cancha: 'Creando tu reserva...',
  cancelar_reserva_cancha: 'Cancelando reserva...',
  listar_mis_reservas_cancha: 'Cargando tus reservas...',
  consultar_clases: 'Buscando clases...',
  reservar_clase: 'Reservando clase...',
  cancelar_reserva_clase: 'Cancelando clase...',
  consultar_mis_clases: 'Cargando tus clases...',
  buscar_torneos: 'Buscando torneos...',
  inscribir_torneo: 'Inscribiéndote...',
  cancelar_inscripcion_torneo: 'Cancelando inscripción...',
  ver_mis_partidos: 'Cargando tus partidos...',
  consultar_canchas: 'Consultando canchas...',
  consultar_profesores: 'Buscando profesores...',
};

const QUICK_ACTIONS = [
  { label: 'Reservar cancha hoy', icon: 'tennisball-outline', msg: 'Quiero reservar una cancha para hoy' },
  { label: 'Mis próximas clases', icon: 'calendar-outline', msg: '¿Cuáles son mis próximas clases?' },
  { label: 'Torneos abiertos', icon: 'trophy-outline', msg: 'Mostrame los torneos abiertos para inscribirme' },
  { label: 'Mis reservas', icon: 'bookmark-outline', msg: 'Mostrá mis reservas de canchas' },
];

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '¡Hola! Soy el asistente de CourtUp. Puedo ayudarte a:\n\n• Reservar y cancelar canchas\n• Inscribirte en clases y torneos\n• Ver tus reservas y partidos\n• Consultar precios y disponibilidad\n\n¿En qué te ayudo hoy?',
  timestamp: new Date(),
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const d = date.toDateString();
  if (d === today.toDateString()) return 'Hoy';
  if (d === yesterday.toDateString()) return 'Ayer';
  return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

type ListItem =
  | { type: 'separator'; key: string; label: string }
  | { type: 'message'; key: string; msg: ChatMessage };

function buildListItems(messages: ChatMessage[]): ListItem[] {
  const items: ListItem[] = [];
  let lastDate = '';

  for (const msg of messages) {
    const dateStr = msg.timestamp.toDateString();
    if (dateStr !== lastDate) {
      lastDate = dateStr;
      items.push({ type: 'separator', key: `sep_${dateStr}`, label: formatDateSeparator(msg.timestamp) });
    }
    items.push({ type: 'message', key: msg.id, msg });
  }
  return items;
}

export default function ChatScreen() {
  const theme = useTheme();
  const { messages, setMessages, hasMore, syncing, loadHistory, saveMessage, updateLastAssistantMessage, loadMore, clearHistory } = useChatHistory();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const listRef = useRef<FlatList>(null);
  const streamingIdRef = useRef<string | null>(null);

  // Determinar si es la primera vez e inicializar
  useEffect(() => {
    (async () => {
      const firstTime = await AsyncStorage.getItem(FIRST_TIME_KEY);
      if (!firstTime) {
        setIsFirstTime(true);
        await AsyncStorage.setItem(FIRST_TIME_KEY, 'false');
      }
      await loadHistory();
    })();
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const sendText = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setInput('');
    setSending(true);

    // Guardar mensaje del usuario
    await saveMessage('user', trimmed);

    // Placeholder del asistente
    const placeholderId = `streaming_${Date.now()}`;
    streamingIdRef.current = placeholderId;
    setMessages((prev) => [
      ...prev,
      { id: placeholderId, role: 'assistant', content: '', timestamp: new Date() },
    ]);
    scrollToBottom();

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? null;

      // Construir historial (sin el placeholder)
      const historyForApi = messages
        .filter((m) => m.id !== placeholderId)
        .concat({ id: 'tmp', role: 'user', content: trimmed, timestamp: new Date() })
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyForApi, userToken: token }),
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Sin stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            let payload = '';
            try { payload = JSON.parse(line.slice(6)); } catch { payload = line.slice(6); }

            if (currentEvent === 'text') {
              accumulatedText += payload;
              setMessages((prev) =>
                prev.map((m) => m.id === placeholderId ? { ...m, content: accumulatedText } : m)
              );
              scrollToBottom();
            } else if (currentEvent === 'tool_start') {
              setToolStatus(TOOL_LABELS[payload] ?? `Consultando...`);
            } else if (currentEvent === 'tool_end') {
              setToolStatus(null);
            } else if (currentEvent === 'done') {
              setToolStatus(null);
            } else if (currentEvent === 'error') {
              throw new Error(payload);
            }
            currentEvent = '';
          }
        }
      }

      // Guardar respuesta del asistente en DB y reemplazar el id temporal
      if (accumulatedText) {
        const saved = await saveMessage('assistant', accumulatedText);
        setMessages((prev) =>
          prev.map((m) => m.id === placeholderId ? { ...saved } : m)
        );
      }
    } catch (err: any) {
      const errMsg = `Lo siento, ocurrió un error: ${err.message ?? 'desconocido'}`;
      setMessages((prev) =>
        prev.map((m) => m.id === placeholderId ? { ...m, content: errMsg } : m)
      );
    } finally {
      setSending(false);
      setToolStatus(null);
      streamingIdRef.current = null;
    }
  }, [sending, messages, saveMessage, setMessages, scrollToBottom]);

  const handleClearChat = useCallback(() => {
    Alert.alert(
      'Limpiar conversación',
      '¿Borrar todo el historial del chat? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: clearHistory },
      ]
    );
  }, [clearHistory]);

  const displayMessages = isFirstTime && messages.length === 0
    ? [WELCOME_MESSAGE]
    : messages;

  const listItems = buildListItems(displayMessages);

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'separator') {
      return (
        <View style={styles.separatorRow}>
          <View style={[styles.separatorLine, { backgroundColor: theme.border }]} />
          <Text style={[styles.separatorText, { color: theme.textMuted, backgroundColor: theme.background }]}>
            {item.label}
          </Text>
          <View style={[styles.separatorLine, { backgroundColor: theme.border }]} />
        </View>
      );
    }

    const { msg } = item;
    const isUser = msg.role === 'user';
    const isEmpty = msg.content === '' && !isUser;

    return (
      <View style={[styles.messageRow, isUser ? styles.rowUser : styles.rowBot]}>
        {!isUser && (
          <View style={[styles.avatar, { backgroundColor: Brand.green }]}>
            <Ionicons name="sparkles" size={13} color="#fff" />
          </View>
        )}
        <View style={styles.bubbleWrapper}>
          <View style={[
            styles.bubble,
            isUser
              ? [styles.bubbleUser, { backgroundColor: Brand.green }]
              : [styles.bubbleBot, { backgroundColor: theme.card, borderColor: theme.border }],
          ]}>
            {isEmpty ? (
              <View style={styles.typingRow}>
                <ActivityIndicator size="small" color={theme.textMuted} />
                <Text style={[styles.typingText, { color: theme.textMuted }]}>Escribiendo...</Text>
              </View>
            ) : (
              <Text style={[styles.bubbleText, { color: isUser ? '#fff' : theme.text }]}>
                {msg.content}
              </Text>
            )}
          </View>
          <Text style={[styles.timestamp, { color: theme.textMuted }, isUser && styles.timestampRight]}>
            {formatTime(msg.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      {/* Header estilo WhatsApp */}
      <View style={[styles.header, { backgroundColor: '#0a0a0a' }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerAvatar, { backgroundColor: Brand.green }]}>
            <Ionicons name="sparkles" size={18} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Asistente CourtUp</Text>
            <Text style={styles.headerSubtitle}>
              {syncing ? 'Sincronizando...' : toolStatus ?? 'En línea · 24/7'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleClearChat} style={styles.headerBtn}>
          <Ionicons name="trash-outline" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Banner de tool en ejecución */}
      {toolStatus && !syncing && (
        <View style={[styles.toolBanner, { backgroundColor: theme.backgroundElement, borderBottomColor: theme.border }]}>
          <ActivityIndicator size="small" color={Brand.green} />
          <Text style={[styles.toolText, { color: theme.textSecondary }]}>{toolStatus}</Text>
        </View>
      )}

      {/* Lista de mensajes */}
      <FlatList
        ref={listRef}
        data={listItems}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={scrollToBottom}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.1}
        ListHeaderComponent={
          hasMore ? (
            <TouchableOpacity onPress={loadMore} style={styles.loadMoreBtn}>
              <Text style={[styles.loadMoreText, { color: Brand.green }]}>Cargar mensajes anteriores</Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          !isFirstTime ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyAvatar, { backgroundColor: Brand.green + '20' }]}>
                <Ionicons name="sparkles" size={36} color={Brand.green} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>¿En qué te ayudo?</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Podés preguntarme sobre canchas, clases, torneos o tus reservas.
              </Text>
            </View>
          ) : null
        }
      />

      {/* Sugerencias rápidas (solo si no hay mensajes) */}
      {messages.length === 0 && (
        <View style={styles.quickActionsContainer}>
          <Text style={[styles.quickActionsLabel, { color: theme.textMuted }]}>Acciones rápidas</Text>
          <View style={styles.quickActionsRow}>
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={[styles.quickChip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
                onPress={() => sendText(action.msg)}
                disabled={sending}
              >
                <Ionicons name={action.icon as any} size={14} color={Brand.green} />
                <Text style={[styles.quickChipText, { color: theme.text }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.inputRow, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.border }]}
            placeholder="Escribí tu consulta..."
            placeholderTextColor={theme.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: input.trim() && !sending ? Brand.green : theme.backgroundElement }]}
            onPress={() => sendText(input)}
            disabled={!input.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color={input.trim() ? '#fff' : theme.textMuted} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Spacing.xxxl + Spacing.xl,
    paddingBottom: Spacing.base,
    paddingHorizontal: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerAvatar: { width: 40, height: 40, borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  headerSubtitle: { color: '#9ca3af', fontSize: 11, marginTop: 1 },
  headerBtn: { padding: Spacing.sm },
  toolBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  toolText: { fontSize: 12, fontWeight: '500' },
  messageList: { padding: Spacing.base, paddingBottom: Spacing.lg, flexGrow: 1 },
  separatorRow: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md, gap: Spacing.sm },
  separatorLine: { flex: 1, height: 1 },
  separatorText: { fontSize: 11, fontWeight: '600', paddingHorizontal: Spacing.sm },
  messageRow: { marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  rowUser: { justifyContent: 'flex-end' },
  rowBot: { justifyContent: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  bubbleWrapper: { maxWidth: '78%' },
  bubble: { borderRadius: Radius.lg, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  bubbleUser: { borderBottomRightRadius: Radius.sm },
  bubbleBot: { borderWidth: 1, borderBottomLeftRadius: Radius.sm },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  typingText: { fontSize: 13 },
  timestamp: { fontSize: 10, marginTop: 3, marginLeft: 2 },
  timestampRight: { textAlign: 'right', marginRight: 2 },
  loadMoreBtn: { alignItems: 'center', paddingVertical: Spacing.md },
  loadMoreText: { fontSize: 13, fontWeight: '600' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxxl * 2, gap: Spacing.md },
  emptyAvatar: { width: 72, height: 72, borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', maxWidth: 260, lineHeight: 20 },
  quickActionsContainer: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  quickActionsLabel: { fontSize: 11, fontWeight: '600', marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  quickActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  quickChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1 },
  quickChipText: { fontSize: 12, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: Spacing.md, borderTopWidth: 1, gap: Spacing.sm },
  input: { flex: 1, borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center' },
});
