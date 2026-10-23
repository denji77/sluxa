import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getLorebook,
  addLorebookEntry,
  updateLorebookEntry,
  deleteLorebookEntry,
} from '../../../src/api';
import { errorMessage } from '../../../src/api/client';
import type { Lorebook, LorebookEntry } from '../../../src/types';
import EmptyState from '../../../src/components/EmptyState';
import Field from '../../../src/components/Field';
import GradientButton from '../../../src/components/GradientButton';
import { colors, font, radius, spacing, withAlpha } from '../../../src/theme';

export default function LorebookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lorebookId = Number(id);
  const router = useRouter();

  const [lorebook, setLorebook] = useState<Lorebook | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LorebookEntry | null>(null);
  const [keys, setKeys] = useState('');
  const [content, setContent] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getLorebook(lorebookId);
      setLorebook(res.data);
    } catch (err) {
      Alert.alert('Error', errorMessage(err, 'Failed to load lorebook'), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [lorebookId, router]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingEntry(null);
    setKeys('');
    setContent('');
    setIsEnabled(true);
    setEditorOpen(true);
  };

  const openEdit = (entry: LorebookEntry) => {
    setEditingEntry(entry);
    setKeys(entry.keys);
    setContent(entry.content);
    setIsEnabled(entry.is_enabled);
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!keys.trim() || !content.trim() || saving) return;
    setSaving(true);
    const payload = {
      keys: keys.trim(),
      content: content.trim(),
      is_enabled: isEnabled,
    };
    try {
      if (editingEntry) {
        const res = await updateLorebookEntry(editingEntry.id, payload);
        setLorebook((prev) =>
          prev
            ? {
                ...prev,
                entries: prev.entries.map((e) => (e.id === editingEntry.id ? res.data : e)),
              }
            : prev,
        );
      } else {
        const res = await addLorebookEntry(lorebookId, payload);
        setLorebook((prev) =>
          prev ? { ...prev, entries: [...prev.entries, res.data] } : prev,
        );
      }
      setEditorOpen(false);
    } catch (err) {
      Alert.alert('Error', errorMessage(err, 'Failed to save entry'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = (entry: LorebookEntry) => {
    Alert.alert('Delete entry', 'Remove this lorebook entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLorebookEntry(entry.id);
            setLorebook((prev) =>
              prev
                ? { ...prev, entries: prev.entries.filter((e) => e.id !== entry.id) }
                : prev,
            );
          } catch (err) {
            Alert.alert('Error', errorMessage(err, 'Failed to delete entry'));
          }
        },
      },
    ]);
  };

  if (loading || !lorebook) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={{ padding: 6 }} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {lorebook.name}
          </Text>
          {lorebook.description ? (
            <Text style={styles.headerSub} numberOfLines={1}>
              {lorebook.description}
            </Text>
          ) : null}
        </View>
        <Pressable style={{ padding: 6 }} onPress={openCreate}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </Pressable>
      </View>

      {lorebook.entries.length === 0 ? (
        <EmptyState
          emoji="✍️"
          title="No entries yet"
          subtitle={'Entries fire when their keywords appear in chat.\nExample: keys "dragon, wyvern" → lore about dragons.'}
          action={<GradientButton small title="Add Entry" onPress={openCreate} />}
        />
      ) : (
        <FlatList
          data={lorebook.entries}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.entryCard, !item.is_enabled && { opacity: 0.5 }]}
              onPress={() => openEdit(item)}
              onLongPress={() => handleDeleteEntry(item)}
            >
              <View style={styles.entryTop}>
                <View style={styles.keysRow}>
                  {item.keys.split(',').map((k, i) => (
                    <View key={`${k}-${i}`} style={styles.keyChip}>
                      <Text style={styles.keyText}>{k.trim()}</Text>
                    </View>
                  ))}
                </View>
                {!item.is_enabled && (
                  <Text style={styles.disabledLabel}>disabled</Text>
                )}
              </View>
              <Text style={styles.entryContent} numberOfLines={3}>
                {item.content}
              </Text>
            </Pressable>
          )}
        />
      )}

      <Modal visible={editorOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingEntry ? 'Edit Entry' : 'New Entry'}
            </Text>
            <Field
              label="Trigger keywords (comma separated)"
              value={keys}
              onChangeText={setKeys}
              placeholder="dragon, wyvern, drake"
              autoCapitalize="none"
            />
            <Field
              label="Lore content"
              value={content}
              onChangeText={setContent}
              placeholder="What should the AI know when these words come up?"
              multiline
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Enabled</Text>
              <Switch
                value={isEnabled}
                onValueChange={setIsEnabled}
                trackColor={{ false: '#2A2A38', true: withAlpha(colors.primary, 0.5) }}
                thumbColor={isEnabled ? colors.primary : '#6B7280'}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Pressable style={styles.cancelBtn} onPress={() => setEditorOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <GradientButton
                title={editingEntry ? 'Save' : 'Add'}
                onPress={handleSave}
                loading={saving}
                disabled={!keys.trim() || !content.trim()}
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
  entryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  entryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  keysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    flex: 1,
  },
  keyChip: {
    backgroundColor: withAlpha(colors.accent, 0.12),
    borderWidth: 1,
    borderColor: withAlpha(colors.accent, 0.3),
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  keyText: {
    color: colors.accent,
    fontSize: font.xs,
    fontWeight: '600',
  },
  disabledLabel: {
    color: colors.textGhost,
    fontSize: font.xs,
    fontStyle: 'italic',
  },
  entryContent: {
    color: colors.textSub,
    fontSize: font.sm,
    lineHeight: 19,
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    color: colors.textSub,
    fontSize: font.md,
    fontWeight: '600',
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
