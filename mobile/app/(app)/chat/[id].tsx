import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getChat, sendMessage, deleteChat } from '../../../src/api';
import { errorMessage } from '../../../src/api/client';
import type { Chat, ChatMode, Message } from '../../../src/types';
import Avatar from '../../../src/components/Avatar';
import ChatInput from '../../../src/components/ChatInput';
import ChatModeToggle from '../../../src/components/ChatModeToggle';
import MessageText from '../../../src/components/MessageText';
import TypingDots from '../../../src/components/TypingDots';
import { colors, charColor, font, gradient, radius, spacing, withAlpha } from '../../../src/theme';
import { formatClock } from '../../../src/utils/time';

const MODE_KEY = 'sluxa.chatMode';

/** Local row type: real messages plus the client-side greeting bubble. */
type Row = Message | { id: string; role: 'assistant'; content: string; created_at: string; chat_id: number };

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = Number(id);
  const router = useRouter();
  const listRef = useRef<FlatList>(null);

  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<ChatMode>('descriptive');
  const sendingRef = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY).then((m) => {
      if (m === 'normal' || m === 'descriptive') setMode(m);
    });
  }, []);

  const changeMode = (m: ChatMode) => {
    setMode(m);
    AsyncStorage.setItem(MODE_KEY, m);
  };

  const fetchChat = useCallback(async () => {
    try {
      const res = await getChat(chatId);
      setChat(res.data);
      setMessages(res.data.messages);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load chat'));
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    fetchChat();
  }, [fetchChat]);

  // Live refresh: the character can text FIRST (proactive backend scheduler),
  // so poll while the screen is open and merge any messages we don't have yet.
  useEffect(() => {
    const timer = setInterval(async () => {
      if (sendingRef.current) return;
      try {
        const res = await getChat(chatId);
        if (sendingRef.current) return;
        setMessages((prev) => {
          const fresh = res.data.messages;
          return fresh.length !== prev.length ? fresh : prev;
        });
      } catch {
        // background refresh is best-effort
      }
    }, 25000);
    return () => clearInterval(timer);
  }, [chatId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    sendingRef.current = true;
    setInput('');

    const tempId = -Date.now();
    const optimistic: Message = {
      id: tempId,
      chat_id: chatId,
      content: text,
      role: 'user',
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await sendMessage(chatId, text, mode);
      const aiMessage = res.data;
      setMessages((prev) => [
        ...prev.map((m) =>
          m.id === tempId && aiMessage.user_message_id
            ? { ...m, id: aiMessage.user_message_id }
            : m,
        ),
        aiMessage,
      ]);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
      Alert.alert('Message failed', errorMessage(err, 'Failed to send message'));
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete chat', 'Delete this conversation permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteChat(chatId);
            router.back();
          } catch (err) {
            Alert.alert('Error', errorMessage(err, 'Failed to delete chat'));
          }
        },
      },
    ]);
  };

  // Greeting shown as a virtual first bubble when history is empty.
  const rows = useMemo<Row[]>(() => {
    const base: Row[] = [...messages];
    if (chat?.character.greeting && messages.length === 0) {
      base.unshift({
        id: 'greeting',
        role: 'assistant',
        content: chat.character.greeting,
        created_at: chat.created_at,
        chat_id: chatId,
      });
    }
    return base.slice().reverse(); // inverted list
  }, [messages, chat, chatId]);

  const color = chat ? charColor(chat.character_id) : colors.primary;

  const renderMessage = ({ item }: { item: Row }) => {
    const isUser = item.role === 'user';
    if (isUser) {
      return (
        <View style={[styles.msgRow, { justifyContent: 'flex-end' }]}>
          <View style={styles.userBubbleWrap}>
            <LinearGradient
              colors={[...gradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.bubble, styles.userBubble]}
            >
              <MessageText content={item.content} style={styles.msgText} />
              <Text style={styles.userTime}>{formatClock(item.created_at)}</Text>
            </LinearGradient>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.msgRow}>
        <Avatar
          name={chat?.character.name}
          url={chat?.character.avatar_url}
          size={30}
          color={color}
        />
        <View style={styles.aiBubbleWrap}>
          <View style={[styles.bubble, styles.aiBubble, { borderColor: withAlpha(color, 0.25) }]}>
            <MessageText content={item.content} style={styles.msgText} />
            <Text style={styles.aiTime}>{formatClock(item.created_at)}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !chat) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={{ color: colors.danger, textAlign: 'center', padding: spacing.xl }}>
            {error || 'Chat not found'}
          </Text>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>← Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerBack} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          style={styles.headerCenter}
          onPress={() => router.push(`/(app)/character/${chat.character_id}`)}
        >
          <Avatar
            name={chat.character.name}
            url={chat.character.avatar_url}
            size={38}
            color={color}
          />
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.headerName} numberOfLines={1}>
              {chat.character.name}
            </Text>
            <Text style={[styles.headerStatus, { color }]}>
              {sending ? 'typing…' : 'online'}
            </Text>
          </View>
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerIcon}
            onPress={() => router.push(`/(app)/memories/${chatId}`)}
          >
            <Ionicons name="sparkles-outline" size={19} color={colors.textSub} />
          </Pressable>
          <Pressable style={styles.headerIcon} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={19} color={colors.textSub} />
          </Pressable>
        </View>
      </View>

      <View style={styles.modeRow}>
        <ChatModeToggle mode={mode} onChange={changeMode} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={rows}
          inverted
          keyExtractor={(m) => String(m.id)}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            sending ? (
              <View style={[styles.msgRow, { alignItems: 'center' }]}>
                <Avatar
                  name={chat.character.name}
                  url={chat.character.avatar_url}
                  size={30}
                  color={color}
                />
                <View style={[styles.bubble, styles.aiBubble, styles.typingBubble]}>
                  <TypingDots color={color} />
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={{ fontSize: 40 }}>💫</Text>
              <Text style={styles.emptyText}>
                Start your story with {chat.character.name}
              </Text>
            </View>
          }
        />

        <ChatInput
          value={input}
          onChangeText={setInput}
          onSend={handleSend}
          sending={sending}
          placeholder={`Message ${chat.character.name}…`}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  headerBack: {
    padding: 6,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerName: {
    color: colors.text,
    fontSize: font.md,
    fontWeight: '700',
  },
  headerStatus: {
    fontSize: font.xs,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerIcon: {
    padding: 8,
  },
  modeRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    flexGrow: 1,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  userBubbleWrap: {
    maxWidth: '80%',
  },
  aiBubbleWrap: {
    maxWidth: '80%',
    flexShrink: 1,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.bubble,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  typingBubble: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  msgText: {
    color: '#F0F0F2',
    fontSize: font.md,
    lineHeight: 22,
  },
  userTime: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  aiTime: {
    color: colors.textGhost,
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    transform: [{ scaleY: -1 }], // counteract inverted list
  },
  emptyText: {
    color: colors.textFaint,
    fontSize: font.sm,
  },
});
