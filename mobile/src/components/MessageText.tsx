import React from 'react';
import { Text, TextStyle } from 'react-native';

interface Props {
  content: string;
  style?: TextStyle;
}

type Segment = { text: string; kind: 'plain' | 'bold' | 'italic' | 'code' };

/**
 * Lightweight markdown for chat bubbles: **bold**, *italic* (roleplay
 * actions), and `inline code`. Full markdown is overkill for chat.
 */
function parse(content: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /(\*\*([^*]+)\*\*)|(\*([^*\n]+)\*)|(`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    if (m.index > last) {
      segments.push({ text: content.slice(last, m.index), kind: 'plain' });
    }
    if (m[2] !== undefined) segments.push({ text: m[2], kind: 'bold' });
    else if (m[4] !== undefined) segments.push({ text: m[4], kind: 'italic' });
    else if (m[6] !== undefined) segments.push({ text: m[6], kind: 'code' });
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    segments.push({ text: content.slice(last), kind: 'plain' });
  }
  return segments;
}

export default function MessageText({ content, style }: Props) {
  const segments = parse(content);
  return (
    <Text style={style}>
      {segments.map((seg, i) => {
        switch (seg.kind) {
          case 'bold':
            return (
              <Text key={i} style={{ fontWeight: '700' }}>
                {seg.text}
              </Text>
            );
          case 'italic':
            return (
              <Text key={i} style={{ fontStyle: 'italic', opacity: 0.85 }}>
                {seg.text}
              </Text>
            );
          case 'code':
            return (
              <Text
                key={i}
                style={{
                  fontFamily: 'monospace',
                  backgroundColor: 'rgba(0,0,0,0.35)',
                  fontSize: (style?.fontSize ?? 15) - 1,
                }}
              >
                {` ${seg.text} `}
              </Text>
            );
          default:
            return <Text key={i}>{seg.text}</Text>;
        }
      })}
    </Text>
  );
}
