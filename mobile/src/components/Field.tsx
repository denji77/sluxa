import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { colors, font, radius, spacing } from '../theme';

interface Props extends TextInputProps {
  label?: string;
  hint?: string;
}

/** Labeled dark text input used across forms. */
export default function Field({ label, hint, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textGhost}
        style={[styles.input, rest.multiline && styles.multiline, style]}
        {...rest}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    color: colors.textSub,
    fontSize: font.sm,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    color: colors.text,
    fontSize: font.md,
  },
  multiline: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  hint: {
    color: colors.textGhost,
    fontSize: font.xs,
  },
});
