import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { createCharacter, getLorebooks } from '../../../src/api';
import { errorMessage } from '../../../src/api/client';
import type { Lorebook } from '../../../src/types';
import Field from '../../../src/components/Field';
import GradientButton from '../../../src/components/GradientButton';
import { colors, font, radius, spacing, withAlpha } from '../../../src/theme';

export default function NewCharacterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [greeting, setGreeting] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [lorebookId, setLorebookId] = useState<number | null>(null);
  const [lorebooks, setLorebooks] = useState<Lorebook[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getLorebooks()
      .then((res) => setLorebooks(res.data))
      .catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!name.trim() || !description.trim() || saving) return;
    setSaving(true);
    try {
      const res = await createCharacter({
        name: name.trim(),
        description: description.trim(),
        greeting: greeting.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        lorebook_id: lorebookId,
      });
      router.replace(`/(app)/character/${res.data.id}`);
    } catch (err) {
      Alert.alert('Error', errorMessage(err, 'Failed to create character'));
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={{ padding: 6 }} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Create Character</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
        >
          <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Luna" />
          <Field
            label="Persona / Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Who are they? Personality, backstory, how they speak…"
            multiline
            hint="This becomes the character's system prompt — the more detail, the better they roleplay."
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
              <Text style={styles.loreLabel}>Lorebook (optional)</Text>
              <View style={styles.loreRow}>
                <Pressable
                  style={[styles.loreChip, lorebookId === null && styles.loreChipActive]}
                  onPress={() => setLorebookId(null)}
                >
                  <Text style={[styles.loreChipText, lorebookId === null && styles.loreChipTextActive]}>
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
                      style={[styles.loreChipText, lorebookId === lb.id && styles.loreChipTextActive]}
                    >
                      {lb.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <GradientButton
            title="Create Character"
            onPress={handleCreate}
            loading={saving}
            disabled={!name.trim() || !description.trim()}
            style={{ marginTop: spacing.sm }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
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
  form: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
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
});
