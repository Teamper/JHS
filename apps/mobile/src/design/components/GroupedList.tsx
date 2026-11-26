import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppearance } from '../appearance.ts';
import { Body } from './Body.tsx';
import { Icon, type IconName } from './Icon.tsx';

export function GroupedList({ children }: { children: ReactNode }) {
  const { palette } = useAppearance();
  return <View style={[styles.group, { backgroundColor: palette.surface }]}>
    {Children.toArray(children).map((child, index) => <Fragment key={index}>
      {index > 0 && <View style={[styles.separator, { backgroundColor: palette.hairline }]} />}
      {child}
    </Fragment>)}
  </View>;
}

export function Line({ label, subtitle, icon, onPress }: { label: string; subtitle?: string; icon: IconName; onPress: () => void }) {
  const { palette } = useAppearance();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => [styles.line, { backgroundColor: pressed ? palette.accentSoft : palette.surface }]}>
    <View style={[styles.icon, { backgroundColor: palette.accentSoft }]}><Icon name={icon} color={palette.accent} size={17} /></View>
    <View style={styles.copy}><Body bold>{label}</Body>{subtitle && <Body muted size={13}>{subtitle}</Body>}</View>
    <Icon name="chevron-right" size={16} color={palette.textTertiary} />
  </Pressable>;
}

const styles = StyleSheet.create({
  group: { borderRadius: 18, overflow: 'hidden' },
  line: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 60 },
  copy: { flex: 1, minWidth: 0 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
