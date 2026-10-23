import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getLorebooks, createLorebook } from '../../../src/api';
import { errorMessage } from '../../../src/api/client';
import type { Lorebook } from '../../../src/types';
import EmptyState from '../../../src/components/EmptyState';
import Field from '../../../src/components/Field';
import GradientButton from '../../../src/components/GradientButton';
import { colors, font, radius, spacing, withAlpha } from '../../../src/theme';

export default function LorebooksScreen() {
  const router = useRouter();
  const [lorebooks, setLorebooks] = useState<Lorebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchLorebooks = useCallback(async () => {
    try {
      const res = await getLorebooks();
      setLorebooks(res.data);
    } catch {
      // shown via empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLorebooks();
    }, [fetchLorebooks]),
  );

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const res = await createLorebook(name.trim(), description.trim() || undefined);
      setShowCreate(false);
      setName('');
      setDescription('');
      router.push(`/(app)/lorebooks/${res.data.id}`);
    } catch (err) {
      Alert.alert('Error', errorMessage(err, 'Failed to create lorebook'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={{ padding: 6 }} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Lorebooks</Text>
        <Pressable style={{ padding: 6 }} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : lorebooks.length === 0 ? (
        <EmptyState
          emoji="📚"
          title="No lorebooks yet"
          subtitle="Lorebooks inject world knowledge into chats when their keywords come up. Attach them to characters."
          action={
            <GradientButton small title="Create Lorebook" onPress={() => setShowCreate(true)} />
          }
        />
      ) : (
        <FlatList
          data={lorebooks}
          keyExtractor={(lb) => String(lb.id)}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
              onPress={() => router.push(`/(app)/lorebooks/${item.id}`)}
            >
              <View style={styles.bookIcon}>
                <Ionicons name="book" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowDesc} numberOfLines={1}>
                  {item.description || `${item.entries.length} entries`}
                </Text>
              </View>
              <Text style={styles.entryCount}>{item.entries.length}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textGhost} />
            </Pressable>
          )}
        />
      )}

      <Modal visible={showCreate} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Lorebook</Text>
            <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Kingdom of Eldoria" />
            <Field
              label="Description (optional)"
              value={description}
              onChangeText={setDescription}
              placeholder="What world does this describe?"
            />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setShowCreate(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <GradientButton
                title="Create"
                onPress={handleCreate}
                loading={creating}
                disabled={!name.trim()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bookIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: withAlpha(colors.accent, 0.12),
    borderWidth: 1,
    borderColor: withAlpha(colors.accent, 0.3),
    alignItems: 'center',
    justifyContent: 'center',
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
  entryCount: {
    color: colors.textGhost,
    fontSize: font.sm,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  modalTitle: {
    color: colors.text,
    fontSize: font.lg,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: colors.textSub,
    fontSize: font.md,
    fontWeight: '600',
  },
});
