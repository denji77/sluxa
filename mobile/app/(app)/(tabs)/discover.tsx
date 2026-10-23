import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { searchChub } from '../../../src/api';
import { errorMessage } from '../../../src/api/client';
import type { ChubSearchResult } from '../../../src/types';
import Avatar from '../../../src/components/Avatar';
import EmptyState from '../../../src/components/EmptyState';
import { colors, font, radius, spacing, withAlpha } from '../../../src/theme';

export default function DiscoverScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChubSearchResult[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  const runSearch = useCallback(async (q: string, pageNum: number, append: boolean) => {
    const seq = ++requestSeq.current;
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const res = await searchChub(q, pageNum, true);
      if (seq !== requestSeq.current) return; // stale response
      setResults((prev) => (append ? [...prev, ...res.data] : res.data));
      setHasMore(res.data.length >= 20);
      setPage(pageNum);
      setError(null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(errorMessage(err, 'Search failed'));
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query, 1, false), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const loadMore = () => {
    if (!loading && !loadingMore && hasMore && results.length > 0) {
      runSearch(query, page + 1, true);
    }
  };

  const renderCard = ({ item }: { item: ChubSearchResult }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfaceStrong }]}
      onPress={() =>
        router.push({
          pathname: '/(app)/chub/[id]',
          params: { id: String(item.id), avatar: item.avatar_url ?? '' },
        })
      }
    >
      <Avatar name={item.name} url={item.avatar_url} size={56} color={colors.primary} ring={1} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.verified && (
            <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
          )}
        </View>
        <Text style={styles.cardTagline} numberOfLines={2}>
          {item.tagline || item.description}
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="star" size={11} color={colors.warning} />
            <Text style={styles.statText}>{item.starCount}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="chatbubbles-outline" size={11} color={colors.textFaint} />
            <Text style={styles.statText}>{item.nChats}</Text>
          </View>
          {item.topics.slice(0, 2).map((t) => (
            <View key={t} style={styles.topicChip}>
              <Text style={styles.topicText}>{t}</Text>
            </View>
          ))}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textGhost} />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
        <Text style={styles.headerSub}>Powered by Chub.ai</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={17} color={colors.textGhost} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search thousands of characters…"
          placeholderTextColor={colors.textGhost}
          style={styles.searchInput}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={17} color={colors.textGhost} />
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error && results.length === 0 ? (
        <EmptyState emoji="📡" title="Search unavailable" subtitle={error} />
      ) : results.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="No characters found"
          subtitle="Try a different search term."
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(c, i) => `${c.id}-${i}`}
          renderItem={renderCard}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                color={colors.primary}
                style={{ paddingVertical: spacing.lg }}
              />
            ) : null
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: colors.text,
    fontSize: font.title,
    fontWeight: '800',
  },
  headerSub: {
    color: colors.textGhost,
    fontSize: font.xs,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: font.md,
    paddingVertical: 11,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardName: {
    color: colors.text,
    fontSize: font.md,
    fontWeight: '700',
    flexShrink: 1,
  },
  cardTagline: {
    color: colors.textFaint,
    fontSize: font.xs,
    lineHeight: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    color: colors.textFaint,
    fontSize: font.xs,
  },
  topicChip: {
    backgroundColor: withAlpha(colors.primary, 0.12),
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  topicText: {
    color: withAlpha(colors.primary, 0.9),
    fontSize: 10,
    fontWeight: '600',
  },
});
