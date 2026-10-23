import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getFriendMessages, sendFriendMessage } from '../../../src/api';
import { errorMessage } from '../../../src/api/client';
import type { FriendMessage, FriendUser } from '../../../src/types';
import Avatar from '../../../src/components/Avatar';
import ChatInput from '../../../src/components/ChatInput';
import { colors, charColor, font, gradient, radius, spacing } from '../../../src/theme';
import { formatClock } from '../../../src/utils/time';

/** Backend timestamps are UTC without a zone suffix. */
const utc = (s: string) => (s.endsWith('Z') || s.includes('+') ? s : `${s}Z`);

export default function FriendChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const friendshipId = Number(id);
  const router = useRouter();
  const listRef = useRef<FlatList>(null);

  const [friend, setFriend] = useState<FriendUser | null>(null);
  const [messages, setMessages] = useState<FriendMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const lastIdRef = useRef(0);
  const pollBusyRef = useRef(false);

  const appendMessages = useCallback((incoming: FriendMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !known.has(m.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
    lastIdRef.current = Math.max(
      lastIdRef.current,
      ...incoming.map((m) => m.id),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    const poll = async (initial = false) => {
      if (pollBusyRef.current) return;
      pollBusyRef.current = true;
      try {
        const res = await getFriendMessages(friendshipId, lastIdRef.current);
        if (cancelled) return;
        setFriend(res.data.friend);
        appendMessages(res.data.messages);
        setError(null);
      } catch (err) {
        if (!cancelled && initial) {
          setError(errorMessage(err, 'Failed to load this chat'));
        }
      } finally {
        pollBusyRef.current = false;
        if (!cancelled) setLoading(false);
      }
    };

    lastIdRef.current = 0;
    poll(true);
    const timer = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [friendshipId, appendMessages]);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await sendFriendMessage(friendshipId, text);
      appendMessages([res.data]);
      setInput('');
    } catch (err) {
      setError(errorMessage(err, 'Message failed to send'));
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: FriendMessage }) => (
    <View style={[styles.bubbleRow, item.mine ? styles.rowMine : styles.rowTheirs]}>
      {item.mine ? (
        <LinearGradient
          colors={[...gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, styles.bubbleMine]}
        >
          <Text style={styles.bubbleTextMine}>{item.content}</Text>
          <Text style={styles.timeMine}>{formatClock(utc(item.created_at))}</Text>
        </LinearGradient>
      ) : (
        <View style={[styles.bubble, styles.bubbleTheirs]}>
          <Text style={styles.bubbleText}>{item.content}</Text>
          <Text style={styles.time}>{formatClock(utc(item.created_at))}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Avatar
          name={friend?.display_name || '?'}
          size={38}
          color={charColor(friend?.id)}
        />
        <View style={styles.headerBody}>
          <Text style={styles.headerName} numberOfLines={1}>
            {friend?.display_name || 'Friend'}
          </Text>
          {friend?.email ? (
            <Text style={styles.headerSub} numberOfLines={1}>
              {friend.email}
            </Text>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : error && messages.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => String(m.id)}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: false })
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptySub}>
                  Say hi to {friend?.display_name || 'your friend'} 👋
                </Text>
              </View>
            }
          />
        )}

        <ChatInput
          value={input}
          onChangeText={setInput}
          onSend={handleSend}
          sending={sending}
          placeholder={`Message ${friend?.display_name || ''}…`}
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
    gap: 6,
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.xs,
  },
  headerBody: {
    flex: 1,
    gap: 1,
  },
  headerName: {
    color: colors.text,
    fontSize: font.lg,
    fontWeight: '700',
  },
  headerSub: {
    color: colors.textFaint,
    fontSize: font.xs,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  rowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: radius.bubble,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleMine: {
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    backgroundColor: colors.surfaceStrong,
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    color: colors.text,
    fontSize: font.md,
    lineHeight: 21,
  },
  bubbleTextMine: {
    color: '#fff',
    fontSize: font.md,
    lineHeight: 21,
  },
  time: {
    color: colors.textGhost,
    fontSize: 10,
    marginTop: 3,
    alignSelf: 'flex-end',
  },
  timeMine: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    marginTop: 3,
    alignSelf: 'flex-end',
  },
  errorText: {
    color: colors.textSub,
    fontSize: font.md,
    textAlign: 'center',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: font.lg,
    fontWeight: '700',
  },
  emptySub: {
    color: colors.textFaint,
    fontSize: font.sm,
  },
});
