import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getCharacters, createGroupChat } from '../../../src/api';
import { errorMessage } from '../../../src/api/client';
import type { Character } from '../../../src/types';
import Avatar from '../../../src/components/Avatar';
import EmptyState from '../../../src/components/EmptyState';
import Field from '../../../src/components/Field';
import GradientButton from '../../../src/components/GradientButton';
import { colors, charColor, font, radius, spacing, withAlpha } from '../../../src/theme';

const MIN_CHARS = 2;
const MAX_CHARS = 6;

export default function NewGroupChatScreen() {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getCharacters()
        .then((res) => setCharacters(res.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, []),
  );

  const toggle = (id: number) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_CHARS) return prev;
      return [...prev, id];
    });
  };

  const handleCreate = async () => {
    if (selected.length < MIN_CHARS || creating) return;
    setCreating(true);
    try {
      const res = await createGroupChat(selected, title.trim() || undefined);
      router.replace(`/(app)/group-chat/${res.data.id}`);
    } catch (err) {
      Alert.alert('Error', errorMessage(err, 'Failed to create group chat'));
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={{ padding: 6 }} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Group Chat</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.titleWrap}>
        <Field
          label="Group name (optional)"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Midnight Tavern"
        />
        <Text style={styles.counter}>
          {selected.length}/{MAX_CHARS} selected · pick at least {MIN_CHARS}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : characters.length < MIN_CHARS ? (
        <EmptyState
          emoji="🎭"
          title="Need more characters"
          subtitle={`Group chats need at least ${MIN_CHARS} characters. Create or import more first.`}
        />
      ) : (
        <FlatList
          data={characters}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={{ paddingBottom: 120 }}
          renderItem={({ item }) => {
            const isSelected = selected.includes(item.id);
            const color = charColor(item.id);
            return (
              <Pressable
                style={[styles.row, isSelected && { backgroundColor: withAlpha(colors.primary, 0.08) }]}
                onPress={() => toggle(item.id)}
              >
                <Avatar name={item.name} url={item.avatar_url} size={44} color={color} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowDesc} numberOfLines={1}>
                    {item.greeting || item.description}
                  </Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                >
                  {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <View style={styles.footer}>
        <GradientButton
          title={
            selected.length < MIN_CHARS
              ? `Select ${MIN_CHARS - selected.length} more`
              : `Start chat with ${selected.length} characters`
          }
          onPress={handleCreate}
          disabled={selected.length < MIN_CHARS}
          loading={creating}
        />
      </View>
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  headerTitle: {
    color: colors.text,
    fontSize: font.lg,
    fontWeight: '700',
  },
  titleWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: 6,
  },
  counter: {
    color: colors.textGhost,
    fontSize: font.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  rowName: {
    color: colors.text,
    fontSize: font.md,
    fontWeight: '600',
  },
  rowDesc: {
    color: colors.textFaint,
    fontSize: font.xs,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    backgroundColor: 'rgba(7,7,16,0.95)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
