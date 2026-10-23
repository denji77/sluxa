import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  unfriend,
} from '../../../src/api';
import { errorMessage } from '../../../src/api/client';
import type { FriendRequest, FriendRequests, FriendSummary } from '../../../src/types';
import Avatar from '../../../src/components/Avatar';
import EmptyState from '../../../src/components/EmptyState';
import GradientButton from '../../../src/components/GradientButton';
import { colors, charColor, font, radius, spacing, withAlpha } from '../../../src/theme';
import { formatRelative } from '../../../src/utils/time';

type Row =
  | { kind: 'header'; key: string; title: string; badge?: number }
  | { kind: 'incoming'; key: string; request: FriendRequest }
  | { kind: 'outgoing'; key: string; request: FriendRequest }
  | { kind: 'friend'; key: string; friend: FriendSummary };

export default function FriendsScreen() {
  const router = useRouter();
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [requests, setRequests] = useState<FriendRequests>({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        getFriends(),
        getFriendRequests(),
      ]);
      setFriends(friendsRes.data);
      setRequests(requestsRes.data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load friends'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
      pollRef.current = setInterval(fetchAll, 10000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [fetchAll]),
  );

  const handleSend = async () => {
    const target = email.trim();
    if (!target || sending) return;
    setSending(true);
    try {
      const res = await sendFriendRequest(target);
      if (res.data.status === 'accepted') {
        Alert.alert('Friends!', `You and ${res.data.user.display_name} are now friends.`);
      } else {
        Alert.alert('Request sent', `Friend request sent to ${target}.`);
      }
      setEmail('');
      fetchAll();
    } catch (err) {
      Alert.alert('Error', errorMessage(err, 'Could not send friend request'));
    } finally {
      setSending(false);
    }
  };

  const handleAccept = async (req: FriendRequest) => {
    try {
      await acceptFriendRequest(req.id);
      fetchAll();
    } catch (err) {
      Alert.alert('Error', errorMessage(err, 'Could not accept request'));
    }
  };

  const handleDecline = async (req: FriendRequest) => {
    try {
      await declineFriendRequest(req.id);
      fetchAll();
    } catch (err) {
      Alert.alert('Error', errorMessage(err, 'Could not remove request'));
    }
  };

  const confirmUnfriend = (f: FriendSummary) => {
    Alert.alert(
      'Unfriend',
      `Remove ${f.friend.display_name} from your friends? Your chat history will be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfriend',
          style: 'destructive',
          onPress: async () => {
            try {
              await unfriend(f.friendship_id);
              setFriends((prev) =>
                prev.filter((x) => x.friendship_id !== f.friendship_id),
              );
            } catch (err) {
              Alert.alert('Error', errorMessage(err, 'Could not unfriend'));
            }
          },
        },
      ],
    );
  };

  const rows: Row[] = [];
  if (requests.incoming.length > 0) {
    rows.push({
      kind: 'header', key: 'h-in', title: 'Friend Requests', badge: requests.incoming.length,
    });
    requests.incoming.forEach((r) =>
      rows.push({ kind: 'incoming', key: `in-${r.id}`, request: r }),
    );
  }
  if (requests.outgoing.length > 0) {
    rows.push({ kind: 'header', key: 'h-out', title: 'Sent Requests' });
    requests.outgoing.forEach((r) =>
      rows.push({ kind: 'outgoing', key: `out-${r.id}`, request: r }),
    );
  }
  if (friends.length > 0) {
    rows.push({ kind: 'header', key: 'h-fr', title: 'My Friends' });
    friends.forEach((f) =>
      rows.push({ kind: 'friend', key: `f-${f.friendship_id}`, friend: f }),
    );
  }

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'header') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{item.title}</Text>
          {item.badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.badge}</Text>
            </View>
          ) : null}
        </View>
      );
    }

    if (item.kind === 'incoming' || item.kind === 'outgoing') {
      const r = item.request;
      return (
        <View style={styles.row}>
          <Avatar name={r.user.display_name} size={48} color={charColor(r.user.id)} />
          <View style={styles.rowBody}>
            <Text style={styles.rowName} numberOfLines={1}>
              {r.user.display_name}
            </Text>
            <Text style={styles.rowPreview} numberOfLines={1}>
              {r.user.email || (item.kind === 'outgoing' ? 'Pending…' : 'Wants to be your friend')}
            </Text>
          </View>
          {item.kind === 'incoming' ? (
            <Pressable style={styles.acceptBtn} onPress={() => handleAccept(r)}>
              <Ionicons name="checkmark" size={18} color="#fff" />
            </Pressable>
          ) : (
            <View style={styles.pendingPill}>
              <Ionicons name="time-outline" size={12} color={colors.textFaint} />
              <Text style={styles.pendingText}>Pending</Text>
            </View>
          )}
          <Pressable style={styles.declineBtn} onPress={() => handleDecline(r)}>
            <Ionicons name="close" size={18} color={colors.textSub} />
          </Pressable>
        </View>
      );
    }

    const f = item.friend;
    return (
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => router.push(`/(app)/friend-chat/${f.friendship_id}`)}
        onLongPress={() => confirmUnfriend(f)}
      >
        <Avatar name={f.friend.display_name} size={52} color={charColor(f.friend.id)} />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.rowName} numberOfLines={1}>
              {f.friend.display_name}
            </Text>
            {f.last_message ? (
              <Text style={styles.rowTime}>{formatRelative(f.last_message.created_at)}</Text>
            ) : null}
          </View>
          <Text style={styles.rowPreview} numberOfLines={2}>
            {f.last_message
              ? `${f.last_message.mine ? 'You: ' : ''}${f.last_message.content}`
              : 'Say hi 👋'}
          </Text>
        </View>
        {f.unread_count > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{f.unread_count}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Friends</Text>
        </View>

        {/* Add friend by email */}
        <View style={styles.addRow}>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={16} color={colors.textGhost} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="friend@example.com"
              placeholderTextColor={colors.textGhost}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
          </View>
          <GradientButton
            small
            title={sending ? '…' : 'Add'}
            onPress={handleSend}
            disabled={sending || !email.trim()}
          />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : error && rows.length === 0 ? (
          <EmptyState
            emoji="📡"
            title="Can't reach the server"
            subtitle={error}
            action={<GradientButton small title="Retry" onPress={() => fetchAll()} />}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            emoji="🫂"
            title="No friends yet"
            subtitle="Add a friend with the email they use for Sluxa — they'll get a request right here."
          />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(r) => r.key}
            renderItem={renderRow}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchAll(true)}
                tintColor={colors.primary}
              />
            }
          />
        )}
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    color: colors.text,
    fontSize: font.title,
    fontWeight: '800',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: font.md,
    paddingVertical: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  sectionTitle: {
    color: colors.textSub,
    fontSize: font.sm,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: font.xs,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowName: {
    color: colors.text,
    fontSize: font.md,
    fontWeight: '700',
    flexShrink: 1,
  },
  rowTime: {
    color: colors.textGhost,
    fontSize: font.xs,
  },
  rowPreview: {
    color: colors.textFaint,
    fontSize: font.sm,
    lineHeight: 18,
  },
  acceptBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pendingText: {
    color: colors.textFaint,
    fontSize: font.xs,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: font.xs,
    fontWeight: '800',
  },
});
