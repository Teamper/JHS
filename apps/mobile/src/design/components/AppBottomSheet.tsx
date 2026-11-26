import { useId, useLayoutEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import BottomSheet, { BottomSheetScrollView, type BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useAppearance } from '../appearance.ts';
import { putNativeSheet, removeNativeSheet } from '../overlayState.ts';
import { GlassSurface } from '../glass/GlassSurface';

export type AppBottomSheetProps = { open: boolean; title: string; close: () => void; children: ReactNode };
export { BottomSheetTextInput as SheetTextInput } from '@gorhom/bottom-sheet';

function SheetBackground({ style }: BottomSheetBackgroundProps) {
  const { reduceTransparency } = useAppearance();
  return <GlassSurface radius={26} reduceTransparency={reduceTransparency} style={style} />;
}

function SheetLayer({ title, close, children }: Omit<AppBottomSheetProps, 'open'>) {
  const { palette, reduceMotion } = useAppearance();
  const insets = useSafeAreaInsets();
  return <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Pressable accessibilityLabel="关闭弹层" accessibilityRole="button" onPress={close}
        style={[StyleSheet.absoluteFill, { backgroundColor: palette.scrim }]} />
      {/* Android's edge-to-edge window keeps its height when the keyboard appears. */}
      <BottomSheet index={0} enableDynamicSizing enablePanDownToClose onClose={close} animateOnMount={!reduceMotion}
        topInset={insets.top + 16} keyboardBehavior="interactive" keyboardBlurBehavior="restore" android_keyboardInputMode="adjustPan"
        handleIndicatorStyle={{ backgroundColor: palette.textTertiary }}
        backgroundComponent={SheetBackground}>
        <BottomSheetScrollView keyboardShouldPersistTaps="handled" accessibilityLabel={title} accessibilityViewIsModal
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 20, gap: 12 }}>
          {children}
        </BottomSheetScrollView>
      </BottomSheet>
  </View>;
}

export function AppBottomSheet({ open, title, close, children }: AppBottomSheetProps) {
  const id = useId();
  const showing = useIsFocused() && open;
  useLayoutEffect(() => {
    if (!showing) return;
    putNativeSheet({ id, close, view: <SheetLayer key={id} title={title} close={close}>{children}</SheetLayer> });
  }, [showing, id, title, close, children]);
  useLayoutEffect(() => {
    if (showing) return () => removeNativeSheet(id);
  }, [id, showing]);
  return null;
}
