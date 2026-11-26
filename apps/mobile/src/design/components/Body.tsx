import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useAppearance } from '../appearance.ts';
import { typography } from '../tokens/typography.ts';

export function Body({ children, muted = false, bold = false, numberOfLines, size = 15, tabular, style }: {
  children: ReactNode; muted?: boolean; bold?: boolean; numberOfLines?: number; size?: number; tabular?: boolean; style?: StyleProp<TextStyle>;
}) {
  const { palette } = useAppearance();
  return <Text numberOfLines={numberOfLines} style={[{
    color: muted ? palette.textSecondary : palette.textPrimary, fontSize: size,
    lineHeight: Math.ceil(size * 1.4), fontWeight: bold ? '700' : '400',
  }, tabular && typography.tabular, style]}>{children}</Text>;
}
