import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, font, spacing } from '../theme';

interface Props {
  emoji: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ emoji, title, subtitle, action }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {action ? <View style={{ marginTop: spacing.lg }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  emoji: {
    fontSize: 44,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: font.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textFaint,
    fontSize: font.sm,
    textAlign: 'center',
    lineHeight: 19,
  },
});
