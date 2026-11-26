import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAppearance } from '../appearance.ts';
import { Body } from './Body.tsx';
import { Button } from './Button.tsx';

export function EmptyState({ message, busy = false, retry }: { message: string; busy?: boolean; retry?: () => void }) {
  const { palette } = useAppearance();
  return <View accessibilityLiveRegion="polite" accessibilityState={{ busy }} style={styles.container}>
    {busy && <ActivityIndicator color={palette.accent} />}
    <Body muted style={styles.label}>{message}</Body>
    {retry && <Button variant="tonal" icon="rotate-ccw" onPress={retry}>重试</Button>}
  </View>;
}

const styles = StyleSheet.create({
  container: { minHeight: 108, padding: 16, gap: 10, alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center' },
});
