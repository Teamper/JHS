import { Pressable, StyleSheet } from 'react-native';
import { GlassSurface } from '../glass/GlassSurface';
import { useAppearance } from '../appearance.ts';
import { Icon, type IconName } from './Icon.tsx';

export function GlassPillButton({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  const { reduceTransparency } = useAppearance();
  return <Pressable accessibilityLabel={label} accessibilityRole="button" hitSlop={4} onPress={onPress}
    style={({ pressed }) => [styles.button, { opacity: pressed ? 0.7 : 1 }]}>
    <GlassSurface radius={22} reduceTransparency={reduceTransparency} style={styles.material}><Icon name={icon} size={19} /></GlassSurface>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 22 },
  material: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
