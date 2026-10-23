import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getChatMemories,
  deleteMemory,
  clearChatMemories,
} from '../../../src/api';
import { errorMessage } from '../../../src/api/client';
import type { MemoryItem } from '../../../src/types';
import EmptyState from '../../../src/components/EmptyState';
import { colors, font, radius, spacing, withAlpha } from '../../../src/theme';

export default function MemoriesScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const id = Number(chatId);
  const router = useRouter();

  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getChatMemories(id);
      setMemories(res.data.memories);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load memories'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = (m: MemoryItem) => {
    Alert.alert('Forget memory', 'Remove this memory from the character?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forget',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMemory(id, m.message_id);
            setMemories((prev) => prev.filter((x) => x.message_id !== m.message_id));
          } catch (err) {
            Alert.alert('Error', errorMessage(err, 'Failed to delete memory'));
          }
        },
      },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear all memories',
      'The character will forget everything from this chat. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearChatMemories(id);
              setMemories([]);
            } catch (err) {
              Alert.alert('Error', errorMessage(err, 'Failed to clear memories'));
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={{ padding: 6 }} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Memories</Text>
          <Text style={styles.headerSub}>
            What the character remembers long-term
          </Text>
        </View>
        {memories.length > 0 && (
          <Pressable style={{ padding: 6 }} onPress={handleClearAll}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <EmptyState emoji="📡" title="Couldn't load memories" subtitle={error} />
      ) : memories.length === 0 ? (
        <EmptyState
          emoji="🧠"
          title="No memories yet"
          subtitle="As you chat, important moments get stored here and recalled in future conversations."
        />
      ) : (
        <FlatList
          data={memories}
          keyExtractor={(m) => String(m.message_id)}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onLongPress={() => handleDelete(item)}>
              <View style={styles.cardTop}>
                <View
                  style={[
                    styles.roleBadge,
                    item.role === 'user'
                      ? { backgroundColor: withAlpha(colors.primary, 0.15) }
                      : { backgroundColor: withAlpha(colors.secondary, 0.15) },
                  ]}
                >
                  <Text
                    style={[
                      styles.roleText,
                      { color: item.role === 'user' ? colors.primary : colors.secondary },
                    ]}
                  >
                    {item.role === 'user' ? 'You' : 'Character'}
                  </Text>
                </View>
                <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
                  <Ionicons name="close" size={16} color={colors.textGhost} />
                </Pressable>
              </View>
              <Text style={styles.cardText}>{item.content_preview}</Text>
            </Pressable>
          )}
          ListHeaderComponent={
            <Text style={styles.hint}>
              Long-press a memory to make the character forget it.
            </Text>
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  headerTitle: {
    color: colors.text,
    fontSize: font.lg,
    fontWeight: '700',
  },
  headerSub: {
    color: colors.textFaint,
    fontSize: font.xs,
  },
  hint: {
    color: colors.textGhost,
    fontSize: font.xs,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleText: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  cardText: {
    color: colors.textSub,
    fontSize: font.sm,
    lineHeight: 19,
  },
});
