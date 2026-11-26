import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAppearance } from '../appearance.ts';
import { useSheetPresence } from '../overlayState.ts';
import { GlassSurface } from '../glass/GlassSurface';
import type { AppBottomSheetProps } from './AppBottomSheet.tsx';

export { TextInput as SheetTextInput } from 'react-native';

export function AppBottomSheet({ open, title, close, children }: AppBottomSheetProps) {
  const { palette, reduceMotion, reduceTransparency } = useAppearance();
  useSheetPresence(open);
  return <Modal transparent visible={open} animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={close}>
    <View style={styles.root}>
      <Pressable accessibilityLabel="关闭弹层" accessibilityRole="button" onPress={close}
        style={[StyleSheet.absoluteFill, { backgroundColor: palette.scrim }]} />
      <GlassSurface radius={24} reduceTransparency={reduceTransparency} style={styles.surface}>
        <View style={[styles.handle, { backgroundColor: palette.textTertiary }]} />
        <ScrollView role="dialog" accessibilityLabel={title} accessibilityViewIsModal
          keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {children}
        </ScrollView>
      </GlassSurface>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  surface: { width: '100%', maxWidth: 520, maxHeight: '86%' },
  handle: { height: 4, width: 32, borderRadius: 2, alignSelf: 'center', marginTop: 10, opacity: 0.65 },
  content: { padding: 18, gap: 12 },
});
