import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getChubCharacter, importChubCharacter } from '../../../src/api';
import { errorMessage } from '../../../src/api/client';
import type { ChubCharacterDetail } from '../../../src/types';
import Avatar from '../../../src/components/Avatar';
import GradientButton from '../../../src/components/GradientButton';
import { colors, font, radius, spacing, withAlpha } from '../../../src/theme';

export default function ChubDetailScreen() {
  const { id, avatar } = useLocalSearchParams<{ id: string; avatar?: string }>();
  const chubId = Number(id);
  const router = useRouter();

  const [detail, setDetail] = useState<ChubCharacterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getChubCharacter(chubId);
      setDetail(res.data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load character'));
    } finally {
      setLoading(false);
    }
  }, [chubId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleImport = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const res = await importChubCharacter(chubId);
      Alert.alert('Imported!', `${res.data.name} is now in your characters.`, [
        {
          text: 'View Character',
          onPress: () => router.replace(`/(app)/character/${res.data.id}`),
        },
      ]);
    } catch (err) {
      Alert.alert('Error', errorMessage(err, 'Failed to import character'));
    } finally {
      setImporting(false);
    }
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

  if (error || !detail) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={{ color: colors.danger, textAlign: 'center', padding: spacing.xl }}>
            {error || 'Character not found'}
          </Text>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>← Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={{ padding: 6 }} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Chub Character</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <LinearGradient
          colors={[withAlpha(colors.primary, 0.25), 'rgba(7,7,16,0)']}
          style={styles.hero}
        >
          <Avatar name={detail.name} url={avatar || null} size={96} color={colors.primary} ring={3} />
          <Text style={styles.heroName}>{detail.name}</Text>
          {detail.creator ? (
            <Text style={styles.creator}>by {detail.creator}</Text>
          ) : null}
          {detail.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {detail.tags.slice(0, 6).map((t) => (
                <View key={t} style={styles.tagChip}>
                  <Text style={styles.tagText}>{t}</Text>
                </View>
              ))}
            </View>
          )}
        </LinearGradient>

        <View style={styles.body}>
          {detail.first_mes ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>GREETING</Text>
              <Text style={styles.sectionText}>{detail.first_mes}</Text>
            </View>
          ) : null}
          {detail.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>DESCRIPTION</Text>
              <Text style={styles.sectionText}>{detail.description}</Text>
            </View>
          ) : null}
          {detail.scenario ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SCENARIO</Text>
              <Text style={styles.sectionText}>{detail.scenario}</Text>
            </View>
          ) : null}
          {detail.creator_notes ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CREATOR NOTES</Text>
              <Text style={styles.sectionText}>{detail.creator_notes}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <GradientButton
          title="Import to My Characters"
          onPress={handleImport}
          loading={importing}
          icon={<Ionicons name="download-outline" size={17} color="#fff" />}
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
    gap: spacing.md,
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
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  heroName: {
    color: colors.text,
    fontSize: font.xl,
    fontWeight: '800',
  },
  creator: {
    color: colors.textFaint,
    fontSize: font.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginTop: 4,
  },
  tagChip: {
    backgroundColor: withAlpha(colors.primary, 0.12),
    borderWidth: 1,
    borderColor: withAlpha(colors.primary, 0.3),
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: {
    color: withAlpha(colors.primary, 0.95),
    fontSize: font.xs,
    fontWeight: '600',
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
  footer: {
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
