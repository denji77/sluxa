import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getChats,
  getGroupChats,
  deleteChat,
  deleteGroupChat,
} from '../../../src/api';
import { errorMessage } from '../../../src/api/client';
import type { ChatSummary, GroupChatSummary } from '../../../src/types';
import Avatar from '../../../src/components/Avatar';
import EmptyState from '../../../src/components/EmptyState';
import GradientButton from '../../../src/components/GradientButton';
import { colors, charColor, font, radius, spacing, withAlpha } from '../../../src/theme';
import { formatRelative } from '../../../src/utils/time';

type Row =
  | { kind: 'chat'; key: string; updated: string; chat: ChatSummary }
  | { kind: 'group'; key: string; updated: string; group: GroupChatSummary };

export default function ChatsScreen() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [groups, setGroups] = useState<GroupChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    try {
      const [chatsRes, groupsRes] = await Promise.all([getChats(), getGroupChats()]);
      setChats(chatsRes.data);
      setGroups(groupsRes.data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load chats'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const rows = useMemo<Row[]>(() => {
    const merged: Row[] = [
      ...chats.map((c) => ({
        kind: 'chat' as const,
        key: `c-${c.id}`,
        updated: c.updated_at,
        chat: c,
      })),
      ...groups.map((g) => ({
        kind: 'group' as const,
        key: `g-${g.id}`,
        updated: g.updated_at,
        group: g,
      })),
    ];
    return merged.sort(
      (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime(),
    );
  }, [chats, groups]);

  const confirmDelete = (row: Row) => {
    const title = row.kind === 'chat' ? row.chat.character_name : row.group.title || 'Group chat';
    Alert.alert('Delete chat', `Delete the conversation with ${title}? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (row.kind === 'chat') {
              await deleteChat(row.chat.id);
              setChats((prev) => prev.filter((c) => c.id !== row.chat.id));
            } else {
              await deleteGroupChat(row.group.id);
              setGroups((prev) => prev.filter((g) => g.id !== row.group.id));
            }
          } catch (err) {
            Alert.alert('Error', errorMessage(err, 'Failed to delete chat'));
          }
        },
      },
    ]);
  };

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'chat') {
      const c = item.chat;
      return (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => router.push(`/(app)/chat/${c.id}`)}
          onLongPress={() => confirmDelete(item)}
        >
          <Avatar
            name={c.character_name}
            url={c.character_avatar}
            size={52}
            color={charColor(c.character_id)}
          />
          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <Text style={styles.rowName} numberOfLines={1}>
                {c.character_name}
              </Text>
              <Text style={styles.rowTime}>{formatRelative(c.updated_at)}</Text>
            </View>
            <Text style={styles.rowPreview} numberOfLines={2}>
              {c.last_message || 'Say hello 👋'}
            </Text>
          </View>
        </Pressable>
      );
    }
    const g = item.group;
    const names = g.participants.map((p) => p.character_name).join(', ');
    return (
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => router.push(`/(app)/group-chat/${g.id}`)}
        onLongPress={() => confirmDelete(item)}
      >
        <View style={styles.groupAvatarStack}>
          {g.participants.slice(0, 3).map((p, i) => (
            <View key={p.id} style={[styles.groupAvatar, { left: i * 16 }]}>
              <Avatar
                name={p.character_name}
                url={p.character_avatar}
                size={36}
                color={charColor(p.character_id)}
              />
            </View>
          ))}
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <View style={styles.groupTitleRow}>
              <View style={styles.groupBadge}>
                <Text style={styles.groupBadgeText}>GROUP</Text>
              </View>
              <Text style={styles.rowName} numberOfLines={1}>
                {g.title || names}
              </Text>
            </View>
            <Text style={styles.rowTime}>{formatRelative(g.updated_at)}</Text>
          </View>
          <Text style={styles.rowPreview} numberOfLines={2}>
            {g.last_message || `${g.participants.length} characters ready to talk`}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <Pressable
          style={styles.headerBtn}
          onPress={() => router.push('/(app)/group-chat/new')}
        >
          <Ionicons name="people" size={16} color={colors.primary} />
          <Text style={styles.headerBtnText}>New Group</Text>
        </Pressable>
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
          emoji="💬"
          title="No chats yet"
          subtitle="Pick a character from the Characters tab or discover new ones to start talking."
          action={
            <GradientButton
              small
              title="Browse Characters"
              onPress={() => router.push('/(app)/(tabs)/characters')}
            />
          }
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
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: withAlpha(colors.primary, 0.12),
    borderWidth: 1,
    borderColor: withAlpha(colors.primary, 0.35),
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.full,
  },
  headerBtnText: {
    color: colors.primary,
    fontSize: font.sm,
    fontWeight: '700',
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
  groupAvatarStack: {
    width: 52 + 16,
    height: 52,
    justifyContent: 'center',
  },
  groupAvatar: {
    position: 'absolute',
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  groupBadge: {
    backgroundColor: withAlpha(colors.secondary, 0.18),
    borderWidth: 1,
    borderColor: withAlpha(colors.secondary, 0.4),
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  groupBadgeText: {
    color: colors.secondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
