import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, font, radius, withAlpha } from '../theme';
import type { ChatMode } from '../types';

interface Props {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
}

const OPTIONS: { value: ChatMode; label: string; emoji: string }[] = [
  { value: 'descriptive', label: 'Descriptive', emoji: '🎭' },
  { value: 'normal', label: 'Casual', emoji: '💬' },
];

/** Roleplay style toggle — descriptive (actions/narration) vs casual texting. */
export default function ChatModeToggle({ mode, onChange }: Props) {
  return (
    <View style={styles.track}>
      {OPTIONS.map((opt) => {
        const active = mode === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {opt.emoji} {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.full,
  },
  pillActive: {
    backgroundColor: withAlpha(colors.primary, 0.3),
    borderWidth: 1,
    borderColor: withAlpha(colors.primary, 0.5),
    paddingVertical: 4,
    paddingHorizontal: 11,
  },
  label: {
    color: colors.textFaint,
    fontSize: font.xs,
    fontWeight: '600',
  },
  labelActive: {
    color: colors.text,
  },
});
