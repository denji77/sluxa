import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  getGroupChat,
  sendGroupMessage,
  deleteGroupChat,
  getAmbientMessage,
} from '../../../src/api';
import { errorMessage } from '../../../src/api/client';
import type { ChatMode, GroupChatDetail, GroupMessage } from '../../../src/types';
import Avatar from '../../../src/components/Avatar';
import ChatInput from '../../../src/components/ChatInput';
import ChatModeToggle from '../../../src/components/ChatModeToggle';
import MessageText from '../../../src/components/MessageText';
import TypingDots from '../../../src/components/TypingDots';
import { colors, charColor, font, gradient, radius, spacing, withAlpha } from '../../../src/theme';

const MODE_KEY = 'sluxa.chatMode';

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
const typingDuration = (content = '', multiplier = 1.0) =>
  Math.min(3000, Math.max(1000, content.length * 18)) * multiplier;

interface TypingChar {
  charId: number | null;
  charName: string;
  charAvatar?: string | null;
}

interface Reaction {
  emoji: string;
  charName: string;
  charId: number | null;
}

interface ReadReceipt {
  charName: string;
  charId: number | null;
}

/** Message row with a client-side key (server ids can be null for virtuals). */
type Row = GroupMessage & { _key: string };

let keySeq = 0;
const withKey = (m: GroupMessage): Row => ({
  ...m,
  _key: m.id != null ? `m-${m.id}` : `v-${++keySeq}`,
});

export default function GroupChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupChatId = Number(id);
  const router = useRouter();
  const listRef = useRef<FlatList>(null);
  const mountedRef = useRef(true);
  const sendLockRef = useRef(false);
  const ambientTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ambientLockRef = useRef(false);

  const [groupChat, setGroupChat] = useState<GroupChatDetail | null>(null);
  const [messages, setMessages] = useState<Row[]>([]);
  const [reactions, setReactions] = useState<Record<number, Reaction[]>>({});
  const [readReceipts, setReadReceipts] = useState<Record<number, ReadReceipt[]>>({});
  const [typingChars, setTypingChars] = useState<TypingChar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [mode, setMode] = useState<ChatMode>('descriptive');

  useEffect(() => {
    mountedRef.current = true;
    AsyncStorage.getItem(MODE_KEY).then((m) => {
      if (m === 'normal' || m === 'descriptive') setMode(m);
    });
    return () => {
      mountedRef.current = false;
      if (ambientTimerRef.current) clearTimeout(ambientTimerRef.current);
    };
  }, []);

  const changeMode = (m: ChatMode) => {
    setMode(m);
    AsyncStorage.setItem(MODE_KEY, m);
  };

  const fetchGroupChat = useCallback(async () => {
    try {
      const res = await getGroupChat(groupChatId);
      if (!mountedRef.current) return;
      setGroupChat(res.data);
      setMessages((res.data.messages || []).map(withKey));
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(errorMessage(err, 'Failed to load group chat'));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [groupChatId]);

  useEffect(() => {
    fetchGroupChat();
  }, [fetchGroupChat]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages.length, typingChars.length, scrollToEnd]);

  // ── Staggered reveal queue: hesitation / reaction / left_on_read /
  //    interrupt / concurrent — mirrors the webapp's replay engine. ──────
  const revealQueue = useCallback(async (aiMessages: GroupMessage[]) => {
    for (const msg of aiMessages) {
      if (!mountedRef.current) return;
      const preDelay = Math.max(400, msg.delay_ms || 0);

      if (msg.role === 'hesitation') {
        await sleep(preDelay);
        if (!mountedRef.current) return;
        const t: TypingChar = {
          charId: msg.character_id ?? null,
          charName: msg.character_name || '',
          charAvatar: msg.character_avatar,
        };
        setTypingChars((prev) => [...prev, t]);
        await sleep(msg.hesitation_ms || 1500);
        setTypingChars((prev) => prev.filter((c) => c.charId !== t.charId));
        continue;
      }

      if (msg.role === 'reaction') {
        await sleep(preDelay);
        if (!mountedRef.current) return;
        const targetId = msg.reacting_to_message_id;
        if (targetId) {
          setReactions((prev) => ({
            ...prev,
            [targetId]: [
              ...(prev[targetId] || []),
              {
                emoji: msg.content,
                charName: msg.character_name || '',
                charId: msg.character_id ?? null,
              },
            ],
          }));
        }
        continue;
      }

      if (msg.role === 'left_on_read') {
        await sleep(preDelay);
        if (!mountedRef.current) return;
        const targetId = msg.reacting_to_message_id;
        if (targetId) {
          setReadReceipts((prev) => ({
            ...prev,
            [targetId]: [
              ...(prev[targetId] || []),
              { charName: msg.character_name || '', charId: msg.character_id ?? null },
            ],
          }));
        }
        continue;
      }

      if (msg.interrupt) {
        await sleep(Math.min(preDelay, 300));
        if (!mountedRef.current) return;
        setMessages((prev) => [...prev, withKey(msg)]);
        continue;
      }

      const processMessage = async () => {
        await sleep(preDelay);
        if (!mountedRef.current) return;
        const t: TypingChar = {
          charId: msg.character_id ?? null,
          charName: msg.character_name || '',
          charAvatar: msg.character_avatar,
        };
        setTypingChars((prev) => [...prev, t]);
        await sleep(typingDuration(msg.content, msg.typing_multiplier));
        setTypingChars((prev) => prev.filter((c) => c.charId !== t.charId));
        if (!mountedRef.current) return;
        setMessages((prev) => {
          if (msg.id != null && prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, withKey(msg)];
        });
      };

      if (msg.concurrent) {
        processMessage(); // cross-talk: intentionally not awaited
      } else {
        await processMessage();
      }
    }
  }, []);

  // ── Ambient chatter: characters talk on their own after 60-90s idle ──
  const resetAmbientTimer = useCallback(() => {
    if (ambientTimerRef.current) clearTimeout(ambientTimerRef.current);
    const delay = 60000 + Math.random() * 30000;
    ambientTimerRef.current = setTimeout(async () => {
      if (sendLockRef.current || ambientLockRef.current || !mountedRef.current) return;
      ambientLockRef.current = true;
      try {
        const res = await getAmbientMessage(groupChatId);
        const msg = res.data;
        if (msg && msg.id && mountedRef.current) {
          const t: TypingChar = {
            charId: msg.character_id ?? null,
            charName: msg.character_name || '',
            charAvatar: msg.character_avatar,
          };
          setTypingChars((prev) => [...prev, t]);
          await sleep(typingDuration(msg.content || '', msg.typing_multiplier));
          setTypingChars((prev) => prev.filter((c) => c.charId !== t.charId));
          if (mountedRef.current) setMessages((prev) => [...prev, withKey(msg)]);
        }
      } catch {
        // ambient is best-effort
      } finally {
        ambientLockRef.current = false;
        if (mountedRef.current) resetAmbientTimer();
      }
    }, delay);
  }, [groupChatId]);

  useEffect(() => {
    if (!loading && groupChat) resetAmbientTimer();
    return () => {
      if (ambientTimerRef.current) clearTimeout(ambientTimerRef.current);
    };
  }, [loading, groupChat, resetAmbientTimer]);

  // ── Live refresh: the backend's proactive scheduler lets characters
  //    talk among themselves while the user is away — poll and append any
  //    persisted messages we haven't seen. Skips while a send or ambient
  //    replay is in flight so it can't fight the staggered reveal. ──────
  useEffect(() => {
    const timer = setInterval(async () => {
      if (sendLockRef.current || ambientLockRef.current || !mountedRef.current) return;
      try {
        const res = await getGroupChat(groupChatId);
        if (sendLockRef.current || ambientLockRef.current || !mountedRef.current) return;
        const incoming = res.data.messages || [];
        setMessages((prev) => {
          const known = new Set(prev.filter((m) => m.id != null).map((m) => m.id));
          const fresh = incoming.filter((m) => m.id != null && !known.has(m.id));
          if (fresh.length === 0) return prev;
          return [...prev, ...fresh.map(withKey)];
        });
      } catch {
        // background refresh is best-effort
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [groupChatId]);

  // ── Send ─────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (sendLockRef.current || !text) return;
    sendLockRef.current = true;
    setIsBusy(true);
    setInput('');

    const tempKey = `temp-${Date.now()}`;
    const tempMsg: Row = {
      _key: tempKey,
      id: null,
      group_chat_id: groupChatId,
      character_id: null,
      character_name: null,
      character_avatar: null,
      content: text,
      role: 'user',
      created_at: new Date().toISOString(),
      delay_ms: 0,
      hesitation_ms: 0,
      interrupt: false,
      concurrent: false,
      typing_multiplier: 1,
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await sendGroupMessage(groupChatId, text, mode);
      const aiMessages = res.data;

      // Sync the optimistic user bubble with its real DB id so reactions
      // and read receipts can target it.
      const realId = aiMessages.length > 0 ? aiMessages[0].user_message_id : null;
      if (realId) {
        setMessages((prev) =>
          prev.map((m) => (m._key === tempKey ? { ...m, id: realId, _key: `m-${realId}` } : m)),
        );
      }

      await revealQueue(aiMessages);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m._key !== tempKey));
      setInput(text);
      Alert.alert('Message failed', errorMessage(err, 'Failed to send message'));
    } finally {
      sendLockRef.current = false;
      if (mountedRef.current) {
        setIsBusy(false);
        resetAmbientTimer();
      }
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete group chat', 'Delete this group conversation permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGroupChat(groupChatId);
            router.back();
          } catch (err) {
            Alert.alert('Error', errorMessage(err, 'Failed to delete group chat'));
          }
        },
      },
    ]);
  };

  // ── Rendering ────────────────────────────────────────────────────────
  const renderMessage = ({ item, index }: { item: Row; index: number }) => {
    const isUser = item.role === 'user';
    const next = messages[index + 1];
    const isLastInGroup = !next || next.character_id !== item.character_id;
    const color = isUser ? colors.primary : charColor(item.character_id);
    const msgReactions = (item.id != null && reactions[item.id]) || [];
    const msgReads = (item.id != null && readReceipts[item.id]) || [];
    const hasReplyTo = !isUser && item.responding_to_char_id && item.responding_to_char_name;
    const replyColor = hasReplyTo ? charColor(item.responding_to_char_id) : color;

    return (
      <View style={[styles.msgRow, isUser && { flexDirection: 'row-reverse' }]}>
        {!isUser &&
          (isLastInGroup ? (
            <Avatar
              name={item.character_name}
              url={item.character_avatar}
              size={28}
              color={color}
            />
          ) : (
            <View style={{ width: 28 }} />
          ))}

        <View style={[styles.msgCol, isUser && { alignItems: 'flex-end' }]}>
          {!isUser && isLastInGroup && (
            <Text style={[styles.charName, { color }]}>
              {item.character_name}
              {item.interrupt ? '  ⚡' : ''}
            </Text>
          )}

          {hasReplyTo ? (
            <View
              style={[
                styles.replyStrip,
                { borderLeftColor: replyColor, backgroundColor: withAlpha(replyColor, 0.08) },
              ]}
            >
              <Text style={[styles.replyName, { color: replyColor }]}>
                ↩ {item.responding_to_char_name}
              </Text>
              <Text style={styles.replyPreview} numberOfLines={1}>
                {item.responding_to_preview || '…'}
              </Text>
            </View>
          ) : null}

          {isUser ? (
            <LinearGradient
              colors={[...gradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.bubble, styles.userBubble]}
            >
              <MessageText content={item.content} style={styles.msgText} />
            </LinearGradient>
          ) : (
            <View
              style={[
                styles.bubble,
                styles.aiBubble,
                { borderColor: withAlpha(color, 0.22) },
                item.interrupt && {
                  shadowColor: color,
                  shadowOpacity: 0.5,
                  shadowRadius: 8,
                  elevation: 4,
                },
              ]}
            >
              <MessageText content={item.content} style={styles.msgText} />
            </View>
          )}

          {msgReactions.length > 0 && (
            <View style={styles.reactionsRow}>
              {msgReactions.map((r, i) => (
                <View
                  key={`${r.charId}-${i}`}
                  style={[styles.reactionChip, { borderColor: withAlpha(charColor(r.charId), 0.35) }]}
                >
                  <Text style={{ fontSize: 12 }}>{r.emoji}</Text>
                  <Text style={[styles.reactionName, { color: charColor(r.charId) }]}>
                    {r.charName}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {msgReads.length > 0 && (
            <Text style={styles.readReceipt}>
              Read by {msgReads.map((r) => r.charName).join(', ')}
            </Text>
          )}
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

  if (error || !groupChat) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={{ color: colors.danger, textAlign: 'center', padding: spacing.xl }}>
            {error || 'Group chat not found'}
          </Text>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>← Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isSending = typingChars.length > 0 || isBusy;
  const title =
    groupChat.title || groupChat.participants.map((p) => p.character_name).join(', ');

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerBack} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.avatarStack}>
            {groupChat.participants.slice(0, 3).map((p, i) => (
              <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                <Avatar
                  name={p.character_name}
                  url={p.character_avatar}
                  size={30}
                  color={charColor(p.character_id)}
                />
              </View>
            ))}
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.headerName} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.headerStatus}>
              {isSending
                ? 'characters are responding…'
                : `${groupChat.participants.length} characters`}
            </Text>
          </View>
        </View>
        <Pressable style={styles.headerIcon} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={19} color={colors.textSub} />
        </Pressable>
      </View>

      <View style={styles.modeRow}>
        <ChatModeToggle mode={mode} onChange={changeMode} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m._key}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={scrollToEnd}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={{ fontSize: 40 }}>💬</Text>
              <Text style={styles.emptyTitle}>Start the conversation!</Text>
              <Text style={styles.emptySub}>
                {groupChat.participants.length} characters are listening
              </Text>
            </View>
          }
          ListFooterComponent={
            typingChars.length > 0 ? (
              <View style={{ gap: 6, paddingTop: 4 }}>
                {typingChars.map((tc, i) => {
                  const color = charColor(tc.charId);
                  return (
                    <View key={`${tc.charId}-${i}`} style={styles.typingRow}>
                      <Avatar name={tc.charName} url={tc.charAvatar} size={22} color={color} ring={1.5} />
                      <TypingDots color={color} size={5} />
                      <Text style={styles.typingText}>{tc.charName} is typing…</Text>
                    </View>
                  );
                })}
              </View>
            ) : null
          }
        />

        <ChatInput
          value={input}
          onChangeText={setInput}
          onSend={handleSend}
          sending={isSending}
          placeholder="Message the group…"
          footer={
            isSending
              ? 'Characters are deciding…'
              : 'Not all characters respond every time'
          }
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
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerName: {
    color: colors.text,
    fontSize: font.md,
    fontWeight: '700',
  },
  headerStatus: {
    color: colors.textFaint,
    fontSize: font.xs,
    marginTop: 1,
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
    gap: 6,
    flexGrow: 1,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  msgCol: {
    maxWidth: '78%',
    flexShrink: 1,
  },
  charName: {
    fontSize: font.xs,
    fontWeight: '700',
    marginBottom: 3,
    paddingLeft: 4,
  },
  replyStrip: {
    borderLeftWidth: 3,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  replyName: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  replyPreview: {
    color: colors.textFaint,
    fontSize: font.xs,
    marginTop: 1,
  },
  bubble: {
    paddingHorizontal: 13,
    paddingVertical: 9,
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
  msgText: {
    color: '#F0F0F2',
    fontSize: 14,
    lineHeight: 21,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
    paddingLeft: 4,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  reactionName: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.85,
  },
  readReceipt: {
    color: colors.textFaint,
    fontSize: font.xs,
    fontStyle: 'italic',
    marginTop: 4,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  typingText: {
    color: colors.textGhost,
    fontSize: font.xs,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 80,
  },
  emptyTitle: {
    color: colors.textSub,
    fontSize: font.md,
    fontWeight: '600',
  },
  emptySub: {
    color: colors.textGhost,
    fontSize: font.xs,
  },
});
