import { StyleSheet, View } from 'react-native';
import { useAppearance } from '../appearance.ts';

export function Skeleton({ columns }: { columns: number }) {
  const { palette } = useAppearance();
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.row}>
    {Array.from({ length: columns }, (_, index) => <View key={index} style={styles.item}>
      <View style={[styles.cover, { backgroundColor: palette.surfaceElevated }]} />
      <View style={[styles.label, { backgroundColor: palette.surfaceRecessed }]} />
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 4, paddingVertical: 12 },
  item: { flex: 1, gap: 9 },
  cover: { aspectRatio: 1.62, borderRadius: 12 },
  label: { width: '65%', height: 12, borderRadius: 6 },
});
