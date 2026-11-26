import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useAppearance } from '../appearance.ts';
import { touchTarget } from '../tokens/metrics.ts';
import { Icon, type IconName } from './Icon.tsx';

type Variant = 'primary' | 'tonal' | 'ghost' | 'outline' | 'danger';

export function Button({ children, onPress, icon, selected, primary = false, variant = primary ? 'primary' : selected ? 'tonal' : 'outline',
  disabled = false, style }: {
  children: string; onPress: () => void; icon?: IconName; selected?: boolean; primary?: boolean;
  variant?: Variant; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useAppearance();
  const colors: Record<Variant, { foreground: string; background: string }> = {
    primary: { foreground: palette.onAccent, background: palette.accent },
    tonal: { foreground: palette.accent, background: palette.accentSoft },
    ghost: { foreground: palette.textSecondary, background: 'transparent' },
    outline: { foreground: palette.textPrimary, background: 'transparent' },
    danger: { foreground: palette.danger, background: 'transparent' },
  };
  const { foreground, background } = colors[variant];
  return <Pressable accessibilityRole="button" accessibilityLabel={children} accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, style, { backgroundColor: pressed && variant !== 'primary' ? palette.surfaceElevated : background,
      borderColor: variant === 'outline' ? palette.hairline : 'transparent', opacity: disabled ? 0.45 : pressed && variant === 'primary' ? 0.8 : 1 }]}>
    {icon && <Icon name={icon} size={16} color={foreground} />}
    <Text style={{ color: foreground, fontSize: 14, fontWeight: '600', flexShrink: 1 }}>{children}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: touchTarget, minWidth: touchTarget, borderRadius: 24, paddingHorizontal: 13, paddingVertical: 6,
    borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
