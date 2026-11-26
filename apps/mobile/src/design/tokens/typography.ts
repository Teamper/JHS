import type { TextStyle } from 'react-native';

export const typography = {
  title: { fontSize: 34, lineHeight: 42, fontWeight: '700', letterSpacing: -0.6 },
  section: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 13, lineHeight: 20, fontWeight: '600' },
  tabular: { fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;
