import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getCharacters, createChat } from '../../../src/api';
import { errorMessage } from '../../../src/api/client';
import type { Character } from '../../../src/types';
import Avatar from '../../../src/components/Avatar';
import EmptyState from '../../../src/components/EmptyState';
import GradientButton from '../../../src/components/GradientButton';
import { colors, charColor, font, gradient, radius, spacing, withAlpha } from '../../../src/theme';

export default function CharactersScreen() {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<number | null>(null);

  const fetchCharacters = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    try {
      const res = await getCharacters();
      setCharacters(res.data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load characters'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCharacters();
    }, [fetchCharacters]),
  );

  const startChat = async (character: Character) => {
    if (startingId) return;
    setStartingId(character.id);
    try {
      const res = await createChat(character.id);
      router.push(`/(app)/chat/${res.data.id}`);
    } catch (err) {
      Alert.alert('Error', errorMessage(err, 'Failed to start chat'));
    } finally {
      setStartingId(null);
    }
  };

  const renderCard = ({ item }: { item: Character }) => {
    const color = charColor(item.id);
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
        onPress={() => router.push(`/(app)/character/${item.id}`)}
      >
        <LinearGradient
          colors={[withAlpha(color, 0.16), 'rgba(255,255,255,0.03)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.cardInner}
        >
          <Avatar name={item.name} url={item.avatar_url} size={64} color={color} />
          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.cardDesc} numberOfLines={2}>
            {item.greeting || item.description}
          </Text>
          <Pressable
            style={styles.chatBtn}
            onPress={() => startChat(item)}
            disabled={startingId !== null}
          >
            {startingId === item.id ? (
              <ActivityIndicator size="small" color={color} />
            ) : (
              <>
                <Ionicons name="chatbubble" size={13} color={color} />
                <Text style={[styles.chatBtnText, { color }]}>Chat</Text>
              </>
            )}
          </Pressable>
        </LinearGradient>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Characters</Text>
        <Pressable style={styles.newBtn} onPress={() => router.push('/(app)/character/new')}>
          <LinearGradient
            colors={[...gradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.newBtnInner}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.newBtnText}>Create</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error && characters.length === 0 ? (
        <EmptyState
          emoji="📡"
          title="Can't reach the server"
          subtitle={error}
          action={<GradientButton small title="Retry" onPress={() => fetchCharacters()} />}
        />
      ) : characters.length === 0 ? (
        <EmptyState
          emoji="🎭"
          title="No characters yet"
          subtitle="Create your own character or import one from the Discover tab."
          action={
            <GradientButton
              small
              title="Create Character"
              onPress={() => router.push('/(app)/character/new')}
            />
          }
        />
      ) : (
        <FlatList
          data={characters}
          keyExtractor={(c) => String(c.id)}
          renderItem={renderCard}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchCharacters(true)}
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
  newBtn: {
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  newBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  newBtnText: {
    color: '#fff',
    fontSize: font.sm,
    fontWeight: '700',
  },
  card: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardInner: {
    alignItems: 'center',
    padding: spacing.lg,
    gap: 6,
    minHeight: 190,
  },
  cardName: {
    color: colors.text,
    fontSize: font.md,
    fontWeight: '700',
    marginTop: 4,
  },
  cardDesc: {
    color: colors.textFaint,
    fontSize: font.xs,
    textAlign: 'center',
    lineHeight: 16,
    flex: 1,
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  chatBtnText: {
    fontSize: font.xs,
    fontWeight: '700',
  },
});
