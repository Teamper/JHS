import { BlurTargetView, BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';
import { useAppearance } from '../appearance.ts';
import { useGlassBackdrop } from './backdropContext.tsx';
import type { GlassProps, GlassTarget } from './types.ts';

export function GlassBackdrop({ target, capture, ...props }: ViewProps & { target: GlassTarget; capture?: GlassTarget }) {
  return Platform.OS === 'android' ? <BlurTargetView ref={target} style={styles.fill}>
    <View {...props} ref={capture} collapsable={false} />
  </BlurTargetView> : <View {...props} />;
}

export function GlassSurface({ radius = 32, lens = false, reduceTransparency = false, blurTarget, style, children }: GlassProps) {
  const { palette, darkMode } = useAppearance();
  const screen = useGlassBackdrop();
  const target = blurTarget ?? screen;
  const iosGlass = Platform.OS === 'ios' && isLiquidGlassAvailable() && !reduceTransparency;
  // The Android navigation lens sits on top of the tab bar's live blur.
  const blur = !reduceTransparency && (Platform.OS === 'ios' || (!lens && !!target));
  const tint = lens ? palette.glassLensTint : palette.glassTint;
  const rim = { borderRadius: radius, overflow: 'hidden' as const };
  return <View style={[rim, style]}>
    {iosGlass ? <GlassView pointerEvents="none" style={[StyleSheet.absoluteFill, rim]}
      glassEffectStyle={lens ? 'clear' : 'regular'} isInteractive={lens} tintColor={tint} /> :
      blur && <BlurView pointerEvents="none" blurTarget={target} style={StyleSheet.absoluteFill} intensity={lens ? 24 : 64}
        blurMethod="dimezisBlurView" tint={darkMode ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'} />}
    {!iosGlass && <View pointerEvents="none" style={[StyleSheet.absoluteFill, rim, {
      backgroundColor: reduceTransparency ? lens ? palette.surfaceRecessed : palette.surfaceElevated : tint,
      borderColor: palette.hairline, borderTopColor: palette.glassRim, borderWidth: StyleSheet.hairlineWidth,
    }]} />}
    {children}
  </View>;
}

const styles = StyleSheet.create({ fill: { flex: 1, minWidth: 0 } });
