import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getCharacter,
  updateCharacter,
  deleteCharacter,
  createChat,
  getLorebooks,
} from '../../../src/api';
import { errorMessage } from '../../../src/api/client';
import type { Character, Lorebook } from '../../../src/types';
import Avatar from '../../../src/components/Avatar';
import Field from '../../../src/components/Field';
import GradientButton from '../../../src/components/GradientButton';
import { colors, charColor, font, radius, spacing, withAlpha } from '../../../src/theme';

export default function CharacterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const characterId = Number(id);
  const router = useRouter();

  const [character, setCharacter] = useState<Character | null>(null);
  const [lorebooks, setLorebooks] = useState<Lorebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // edit drafts
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [greeting, setGreeting] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [lorebookId, setLorebookId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [charRes, loreRes] = await Promise.all([
        getCharacter(characterId),
        getLorebooks().catch(() => ({ data: [] as Lorebook[] })),
      ]);
      setCharacter(charRes.data);
      setLorebooks(loreRes.data);
    } catch (err) {
      Alert.alert('Error', errorMessage(err, 'Failed to load character'), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [characterId, router]);

  useEffect(() => {
    load();
  }, [load]);

  const startEditing = () => {
    if (!character) return;
    setName(character.name);
    setDescription(character.description);
    setGreeting(character.greeting || '');
    setAvatarUrl(character.avatar_url || '');
    setLorebookId(character.lorebook_id ?? null);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !description.trim() || saving) return;
    setSaving(true);
    try {
      const res = await updateCharacter(characterId, {
        name: name.trim(),
        description: description.trim(),
        greeting: greeting.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        lorebook_id: lorebookId,
      });
      setCharacter(res.data);
      setEditing(false);
    } catch (err) {
      Alert.alert('Error', errorMessage(err, 'Failed to save character'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete character',
      `Delete ${character?.name}? Their chats will be removed too.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCharacter(characterId);
              router.back();
            } catch (err) {
              Alert.alert('Error', errorMessage(err, 'Failed to delete character'));
            }
          },
        },
      ],
    );
  };

  const startChat = async () => {
    if (starting || !character) return;
    setStarting(true);
    try {
      const res = await createChat(character.id);
      router.replace(`/(app)/chat/${res.data.id}`);
    } catch (err) {
      Alert.alert('Error', errorMessage(err, 'Failed to start chat'));
      setStarting(false);
    }
  };

  if (loading || !character) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const color = charColor(character.id);
  const editable = !character.is_default;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={{ padding: 6 }} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{editing ? 'Edit Character' : 'Character'}</Text>
        <View style={{ flexDirection: 'row' }}>
          {editable && !editing && (
            <>
              <Pressable style={styles.headerIcon} onPress={startEditing}>
                <Ionicons name="pencil" size={18} color={colors.textSub} />
              </Pressable>
              <Pressable style={styles.headerIcon} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={18} color={colors.textSub} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <LinearGradient
            colors={[withAlpha(color, 0.25), 'rgba(7,7,16,0)']}
            style={styles.hero}
          >
            <Avatar name={character.name} url={character.avatar_url} size={96} color={color} ring={3} />
            {!editing && (
              <>
                <Text style={styles.heroName}>{character.name}</Text>
                {character.is_default && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>BUILT-IN</Text>
                  </View>
                )}
              </>
            )}
          </LinearGradient>

          {editing ? (
            <View style={styles.form}>
              <Field label="Name" value={name} onChangeText={setName} placeholder="Character name" />
              <Field
                label="Persona / Description"
                value={description}
                onChangeText={setDescription}
                placeholder="Who are they? Personality, backstory, speech style…"
                multiline
              />
              <Field
                label="Greeting (optional)"
                value={greeting}
                onChangeText={setGreeting}
                placeholder="Their first message to you"
                multiline
              />
              <Field
                label="Avatar URL (optional)"
                value={avatarUrl}
                onChangeText={setAvatarUrl}
                placeholder="https://…"
                autoCapitalize="none"
              />

              {lorebooks.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={styles.loreLabel}>Lorebook</Text>
                  <View style={styles.loreRow}>
                    <Pressable
                      style={[styles.loreChip, lorebookId === null && styles.loreChipActive]}
                      onPress={() => setLorebookId(null)}
                    >
                      <Text
                        style={[styles.loreChipText, lorebookId === null && styles.loreChipTextActive]}
                      >
                        None
                      </Text>
                    </Pressable>
                    {lorebooks.map((lb) => (
                      <Pressable
                        key={lb.id}
                        style={[styles.loreChip, lorebookId === lb.id && styles.loreChipActive]}
                        onPress={() => setLorebookId(lb.id)}
                      >
                        <Text
                          style={[
                            styles.loreChipText,
                            lorebookId === lb.id && styles.loreChipTextActive,
                          ]}
                        >
                          {lb.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
                <Pressable style={styles.cancelBtn} onPress={() => setEditing(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <GradientButton
                  title="Save"
                  onPress={handleSave}
                  loading={saving}
                  disabled={!name.trim() || !description.trim()}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ) : (
            <View style={styles.body}>
              {character.greeting ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>GREETING</Text>
                  <Text style={styles.sectionText}>{character.greeting}</Text>
                </View>
              ) : null}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>PERSONA</Text>
                <Text style={styles.sectionText}>{character.description}</Text>
              </View>
              {character.lorebook_id != null && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>LOREBOOK</Text>
                  <Text style={styles.sectionText}>
                    {lorebooks.find((lb) => lb.id === character.lorebook_id)?.name ??
                      `#${character.lorebook_id}`}
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {!editing && (
          <View style={styles.footer}>
            <GradientButton
              title={`Chat with ${character.name}`}
              onPress={startChat}
              loading={starting}
              icon={<Ionicons name="chatbubble" size={16} color="#fff" />}
            />
          </View>
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  headerTitle: {
    color: colors.text,
    fontSize: font.lg,
    fontWeight: '700',
  },
  headerIcon: {
    padding: 8,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  heroName: {
    color: colors.text,
    fontSize: font.xl,
    fontWeight: '800',
  },
  defaultBadge: {
    backgroundColor: withAlpha(colors.accent, 0.15),
    borderWidth: 1,
    borderColor: withAlpha(colors.accent, 0.4),
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 6,
  },
  sectionTitle: {
    color: colors.textGhost,
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  sectionText: {
    color: colors.textSub,
    fontSize: font.sm,
    lineHeight: 20,
  },
  form: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  loreLabel: {
    color: colors.textSub,
    fontSize: font.sm,
    fontWeight: '600',
  },
  loreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  loreChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  loreChipActive: {
    backgroundColor: withAlpha(colors.primary, 0.2),
    borderColor: colors.primary,
  },
  loreChipText: {
    color: colors.textFaint,
    fontSize: font.sm,
    fontWeight: '600',
  },
  loreChipTextActive: {
    color: colors.text,
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
  footer: {
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
