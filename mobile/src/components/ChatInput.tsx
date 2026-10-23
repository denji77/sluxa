import React from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, gradient, radius, spacing } from '../theme';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  placeholder?: string;
  footer?: string;
}

/** Shared message composer for chat screens. */
export default function ChatInput({
  value,
  onChangeText,
  onSend,
  sending,
  placeholder = 'Type a message…',
  footer,
}: Props) {
  const canSend = !sending && value.trim().length > 0;
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={sending ? 'Waiting for reply…' : placeholder}
          placeholderTextColor={colors.textGhost}
          editable={!sending}
          multiline
          style={styles.input}
        />
        <Pressable onPress={onSend} disabled={!canSend} style={{ opacity: canSend ? 1 : 0.45 }}>
          <LinearGradient
            colors={canSend ? [...gradient] : ['#2A2A38', '#2A2A38']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sendBtn}
          >
            <Ionicons
              name={sending ? 'hourglass-outline' : 'arrow-up'}
              size={20}
              color="#fff"
            />
          </LinearGradient>
        </Pressable>
      </View>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: 'rgba(10,10,20,0.92)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: 11,
    paddingBottom: 11,
    color: colors.text,
    fontSize: font.md,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    color: colors.textGhost,
    fontSize: font.xs,
    textAlign: 'center',
    paddingVertical: 6,
  },
});
