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
import { useSignUp } from '@clerk/clerk-expo';
import Field from '../../src/components/Field';
import GradientButton from '../../src/components/GradientButton';
import { colors, font, spacing } from '../../src/theme';

function clerkError(err: any): string {
  return (
    err?.errors?.[0]?.longMessage ||
    err?.errors?.[0]?.message ||
    err?.message ||
    'Sign up failed. Please try again.'
  );
}

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!isLoaded || loading) return;
    setError(null);
    setLoading(true);
    try {
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setVerifying(true);
    } catch (err) {
      setError(clerkError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded || loading) return;
    setError(null);
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(app)/(tabs)');
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
            <Text style={styles.logoEmoji}>{verifying ? '📬' : '🚀'}</Text>
          </LinearGradient>
          <Text style={styles.title}>
            {verifying ? 'Check your email' : 'Create account'}
          </Text>
          <Text style={styles.subtitle}>
            {verifying
              ? `We sent a 6-digit code to ${email.trim()}`
              : 'Your characters are waiting for you'}
          </Text>
        </View>

        {verifying ? (
          <View style={styles.form}>
            <Field
              label="Verification code"
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <GradientButton
              title="Verify & Continue"
              onPress={handleVerify}
              loading={loading}
              disabled={code.trim().length < 6}
              style={{ marginTop: spacing.sm }}
            />
            <Pressable onPress={() => setVerifying(false)}>
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
              placeholder="At least 8 characters"
              secureTextEntry
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <GradientButton
              title="Sign Up"
              onPress={handleSignUp}
              loading={loading}
              disabled={!email.trim() || password.length < 8}
              style={{ marginTop: spacing.sm }}
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Already have an account?</Text>
              <Link href="/(auth)/sign-in" asChild>
                <Pressable>
                  <Text style={styles.switchLink}>Sign in</Text>
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
    fontSize: font.title,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textFaint,
    fontSize: font.sm,
    marginTop: 6,
    textAlign: 'center',
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
    marginTop: spacing.sm,
  },
});
