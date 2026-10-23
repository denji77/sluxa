import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth, useUser } from '@clerk/clerk-expo';
import {
  getServerUrl,
  setServerUrl,
  getDefaultServerUrl,
} from '../../../src/api/client';
import GradientButton from '../../../src/components/GradientButton';
import { colors, font, gradient, radius, spacing, withAlpha } from '../../../src/theme';

type ConnState = 'checking' | 'online' | 'offline';

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { user } = useUser();
  const [serverUrl, setServerUrlState] = useState(getServerUrl());
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState(serverUrl);
  const [conn, setConn] = useState<ConnState>('checking');

  const checkConnection = useCallback(async (url: string) => {
    setConn('checking');
    try {
      await axios.get(`${url.replace(/\/+$/, '')}/health`, { timeout: 6000 });
      setConn('online');
    } catch {
      setConn('offline');
    }
  }, []);

  useEffect(() => {
    checkConnection(serverUrl);
  }, [serverUrl, checkConnection]);

  const saveUrl = async () => {
    const clean = urlDraft.trim().replace(/\/+$/, '');
    if (clean && !/^https?:\/\//.test(clean)) {
      Alert.alert('Invalid URL', 'The server URL must start with http:// or https://');
      return;
    }
    await setServerUrl(clean);
    const next = getServerUrl();
    setServerUrlState(next);
    setUrlDraft(next);
    setEditingUrl(false);
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const displayName = user?.username || user?.fullName || email.split('@')[0] || 'You';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* User card */}
        <LinearGradient
          colors={[withAlpha(colors.primary, 0.2), withAlpha(colors.secondary, 0.08)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.userCard}
        >
          <LinearGradient
            colors={[...gradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.userAvatar}
          >
            <Text style={styles.userInitial}>
              {displayName.slice(0, 1).toUpperCase()}
            </Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{displayName}</Text>
            {email ? <Text style={styles.userEmail}>{email}</Text> : null}
          </View>
        </LinearGradient>

        {/* Server settings */}
        <Text style={styles.sectionTitle}>SERVER</Text>
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Backend URL</Text>
              {editingUrl ? (
                <TextInput
                  value={urlDraft}
                  onChangeText={setUrlDraft}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder={getDefaultServerUrl()}
                  placeholderTextColor={colors.textGhost}
                  style={styles.urlInput}
                  autoFocus
                />
              ) : (
                <Text style={styles.rowValue}>{serverUrl}</Text>
              )}
            </View>
            {editingUrl ? (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Pressable
                  style={styles.iconBtn}
                  onPress={() => {
                    setUrlDraft(serverUrl);
                    setEditingUrl(false);
                  }}
                >
                  <Ionicons name="close" size={18} color={colors.textFaint} />
                </Pressable>
                <Pressable style={styles.iconBtn} onPress={saveUrl}>
                  <Ionicons name="checkmark" size={18} color={colors.success} />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.iconBtn} onPress={() => setEditingUrl(true)}>
                <Ionicons name="pencil" size={16} color={colors.primary} />
              </Pressable>
            )}
          </View>

          <View style={styles.divider} />

          <Pressable style={styles.rowBetween} onPress={() => checkConnection(serverUrl)}>
            <Text style={styles.rowLabel}>Connection</Text>
            <View style={styles.connRow}>
              <View
                style={[
                  styles.connDot,
                  {
                    backgroundColor:
                      conn === 'online'
                        ? colors.success
                        : conn === 'offline'
                          ? colors.danger
                          : colors.warning,
                  },
                ]}
              />
              <Text style={styles.rowValue}>
                {conn === 'online' ? 'Connected' : conn === 'offline' ? 'Unreachable — tap to retry' : 'Checking…'}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Library */}
        <Text style={styles.sectionTitle}>LIBRARY</Text>
        <View style={styles.section}>
          <Pressable
            style={styles.rowBetween}
            onPress={() => router.push('/(app)/lorebooks')}
          >
            <View style={styles.rowIconLabel}>
              <Ionicons name="book" size={18} color={colors.accent} />
              <Text style={styles.rowLabel}>Lorebooks</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textGhost} />
          </Pressable>
        </View>

        {/* Account */}
        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <View style={styles.section}>
          <Pressable style={styles.rowBetween} onPress={handleSignOut}>
            <View style={styles.rowIconLabel}>
              <Ionicons name="log-out-outline" size={18} color={colors.danger} />
              <Text style={[styles.rowLabel, { color: colors.danger }]}>Sign Out</Text>
            </View>
          </Pressable>
        </View>

        <Text style={styles.footer}>Sluxa · your characters, in your pocket</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    color: colors.text,
    fontSize: font.title,
    fontWeight: '800',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInitial: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  userName: {
    color: colors.text,
    fontSize: font.lg,
    fontWeight: '700',
  },
  userEmail: {
    color: colors.textFaint,
    fontSize: font.sm,
    marginTop: 2,
  },
  sectionTitle: {
    color: colors.textGhost,
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.lg + 4,
  },
  section: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: spacing.md,
  },
  rowIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowLabel: {
    color: colors.text,
    fontSize: font.md,
    fontWeight: '600',
  },
  rowValue: {
    color: colors.textFaint,
    fontSize: font.sm,
    marginTop: 2,
  },
  urlInput: {
    color: colors.text,
    fontSize: font.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingVertical: 4,
    marginTop: 2,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  connRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  connDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  footer: {
    color: colors.textGhost,
    fontSize: font.xs,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
