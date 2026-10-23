import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { useSignIn } from '@clerk/clerk-expo';
import Field from '../../src/components/Field';
import GradientButton from '../../src/components/GradientButton';
import { colors, font, spacing } from '../../src/theme';

function clerkError(err: any): string {
  return (
    err?.errors?.[0]?.longMessage ||
    err?.errors?.[0]?.message ||
    err?.message ||
    'Sign in failed. Please try again.'
  );
}

type PendingFactor = {
  tier: 'first' | 'second';
  strategy: 'email_code' | 'phone_code' | 'totp' | 'backup_code';
  /** Where the code went (or what generates it), for the subtitle. */
  hint: string;
};

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [factor, setFactor] = useState<PendingFactor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const finishSignIn = async (sessionId: string | null) => {
    await setActive?.({ session: sessionId });
    router.replace('/(app)/(tabs)');
  };

  const handleSignIn = async () => {
    if (!isLoaded || loading) return;
    setError(null);
    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });
      if (result.status === 'complete') {
        await finishSignIn(result.createdSessionId);
        return;
      }

      // Clerk asks new devices/accounts for an extra verification step. The
      // web app's Clerk components handle this invisibly; here we run the
      // same flows manually.
      if (result.status === 'needs_first_factor') {
        const f = (result.supportedFirstFactors || []).find(
          (x) => x.strategy === 'email_code',
        );
        if (f) {
          await signIn.prepareFirstFactor({
            strategy: 'email_code',
            emailAddressId: f.emailAddressId,
          });
          setCode('');
          setFactor({
            tier: 'first',
            strategy: 'email_code',
            hint: `We emailed a 6-digit code to ${email.trim()}`,
          });
          return;
        }
      }

      if (result.status === 'needs_second_factor') {
        const factors = result.supportedSecondFactors || [];
        const emailF = factors.find((x) => x.strategy === 'email_code');
        const phoneF = factors.find((x) => x.strategy === 'phone_code');
        const totpF = factors.find((x) => x.strategy === 'totp');
        const backupF = factors.find((x) => x.strategy === 'backup_code');

        if (emailF) {
          await signIn.prepareSecondFactor({
            strategy: 'email_code',
            emailAddressId: (emailF as { emailAddressId?: string }).emailAddressId,
          } as Parameters<typeof signIn.prepareSecondFactor>[0]);
          setCode('');
          setFactor({
            tier: 'second',
            strategy: 'email_code',
            hint: `We emailed a 6-digit code to ${email.trim()}`,
          });
          return;
        }
        if (phoneF) {
          await signIn.prepareSecondFactor({
            strategy: 'phone_code',
            phoneNumberId: (phoneF as { phoneNumberId?: string }).phoneNumberId,
          });
          setCode('');
          setFactor({
            tier: 'second',
            strategy: 'phone_code',
            hint: `We texted a code to ${
              (phoneF as { safeIdentifier?: string }).safeIdentifier || 'your phone'
            }`,
          });
          return;
        }
        if (totpF) {
          setCode('');
          setFactor({
            tier: 'second',
            strategy: 'totp',
            hint: 'Enter the code from your authenticator app',
          });
          return;
        }
        if (backupF) {
          setCode('');
          setFactor({
            tier: 'second',
            strategy: 'backup_code',
            hint: 'Enter one of your backup codes',
          });
          return;
        }
      }

      setError(
        `This account needs a verification step the app doesn't support (${result.status}).`,
      );
    } catch (err) {
      setError(clerkError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded || loading || !factor) return;
    setError(null);
    setLoading(true);
    try {
      const attempt = { strategy: factor.strategy, code: code.trim() };
      const result =
        factor.tier === 'first'
          ? await signIn.attemptFirstFactor(
              attempt as Parameters<typeof signIn.attemptFirstFactor>[0],
            )
          : await signIn.attemptSecondFactor(
              attempt as Parameters<typeof signIn.attemptSecondFactor>[0],
            );
      if (result.status === 'complete') {
        await finishSignIn(result.createdSessionId);
      } else {
        setError('Verification incomplete — please try again.');
      }
    } catch (err) {
      setError(clerkError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior="padding"
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <LinearGradient
            colors={['#8B5CF6', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoBadge}
          >
            <Text style={styles.logoEmoji}>{factor ? '📬' : '✨'}</Text>
          </LinearGradient>
          <Text style={styles.title}>
            {factor ? 'Verify it’s you' : 'Sluxa'}
          </Text>
          <Text style={styles.subtitle}>
            {factor ? factor.hint : 'Chat with characters that feel alive'}
          </Text>
        </View>

        {factor ? (
          <View style={styles.form}>
            <Field
              label={factor.strategy === 'backup_code' ? 'Backup code' : 'Verification code'}
              value={code}
              onChangeText={setCode}
              placeholder={factor.strategy === 'backup_code' ? 'xxxxxxxx' : '123456'}
              keyboardType={factor.strategy === 'backup_code' ? 'default' : 'number-pad'}
              maxLength={factor.strategy === 'backup_code' ? 20 : 6}
              autoCapitalize="none"
              autoFocus
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <GradientButton
              title="Verify & Sign In"
              onPress={handleVerify}
              loading={loading}
              disabled={code.trim().length < (factor.strategy === 'backup_code' ? 4 : 6)}
              style={{ marginTop: spacing.sm }}
            />
            <Pressable onPress={() => { setFactor(null); setError(null); }}>
              <Text style={styles.switchLink}>← Back</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <GradientButton
              title="Sign In"
              onPress={handleSignIn}
              loading={loading}
              disabled={!email.trim() || !password}
              style={{ marginTop: spacing.sm }}
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>New here?</Text>
              <Link href="/(auth)/sign-up" asChild>
                <Pressable>
                  <Text style={styles.switchLink}>Create an account</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  logoEmoji: {
    fontSize: 36,
  },
  title: {
    color: colors.text,
    fontSize: font.hero,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.textFaint,
    fontSize: font.sm,
    marginTop: 6,
  },
  form: {
    gap: spacing.lg,
  },
  error: {
    color: colors.danger,
    fontSize: font.sm,
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  switchText: {
    color: colors.textFaint,
    fontSize: font.sm,
  },
  switchLink: {
    color: colors.primary,
    fontSize: font.sm,
    fontWeight: '700',
    textAlign: 'center',
  },
});
