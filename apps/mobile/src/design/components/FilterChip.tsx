import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppearance } from '../appearance.ts';

export function FilterChip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const { palette } = useAppearance();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} aria-pressed={!!selected}
    onPress={onPress} style={styles.target}>
    <View style={[styles.chip, { backgroundColor: selected ? palette.accentSoft : palette.surfaceRecessed }]}>
      <Text style={{ color: selected ? palette.accent : palette.textSecondary, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  target: { minHeight: 48, minWidth: 48, justifyContent: 'center' },
  chip: { minHeight: 34, paddingHorizontal: 13, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
