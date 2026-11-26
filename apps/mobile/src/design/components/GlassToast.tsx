import { StyleSheet, View } from 'react-native';
import { useAppearance } from '../appearance.ts';
import { GlassSurface } from '../glass/GlassSurface';
import { Body } from './Body.tsx';
import { Button } from './Button.tsx';

export function GlassToast({ message, bottom, undo }: { message: string; bottom: number; undo?: () => void }) {
  const { reduceTransparency } = useAppearance();
  return <View testID="glass-toast" pointerEvents="box-none" style={[styles.position, { bottom }]}>
    <GlassSurface radius={26} reduceTransparency={reduceTransparency} style={styles.toast}>
      <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.message}><Body>{message}</Body></View>
      {undo && <Button variant="tonal" onPress={undo}>撤销</Button>}
    </GlassSurface>
  </View>;
}

const styles = StyleSheet.create({
  position: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { width: '100%', maxWidth: 420, minHeight: 54, alignItems: 'center', flexDirection: 'row', gap: 8, paddingLeft: 16, paddingRight: 4, paddingVertical: 4 },
  message: { flex: 1, minWidth: 0 },
});
