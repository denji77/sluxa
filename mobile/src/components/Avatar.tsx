import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors, withAlpha } from '../theme';

interface Props {
  name?: string | null;
  url?: string | null;
  size?: number;
  color?: string;
  /** Border ring width; 0 disables the ring. */
  ring?: number;
}

/** Character/user avatar: image when available, colored initials otherwise. */
export default function Avatar({
  name,
  url,
  size = 40,
  color = colors.primary,
  ring = 2,
}: Props) {
  const base = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: ring,
    borderColor: color,
  };
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={base}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View style={[styles.fallback, base, { backgroundColor: withAlpha(color, 0.2) }]}>
      <Text style={[styles.initials, { fontSize: size * 0.34, color }]}>
        {(name || '?').slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '700',
  },
});
