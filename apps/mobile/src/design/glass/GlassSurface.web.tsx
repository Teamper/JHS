import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { useAppearance } from '../appearance.ts';
import type { GlassProps, GlassTarget } from './types.ts';

export function GlassBackdrop({ target, capture: _capture, ...props }: ViewProps & { target: GlassTarget; capture?: GlassTarget }) {
  return <View ref={target} {...props} />;
}

export function GlassSurface({ radius = 32, lens = false, reduceTransparency = false, style, children }: GlassProps) {
  const { palette } = useAppearance();
  const rim = { borderRadius: radius, overflow: 'hidden' as const };
  return <View style={[rim, { isolation: 'isolate' } as ViewStyle, style]}>
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, rim, {
      zIndex: -1, backdropFilter: reduceTransparency ? 'none' : 'blur(18px) saturate(160%)',
      backgroundColor: reduceTransparency ? lens ? palette.surfaceRecessed : palette.surfaceElevated : lens ? palette.glassLensTint : palette.glassTint,
      borderWidth: 1, borderColor: palette.hairline, borderTopColor: palette.glassRim,
      boxShadow: 'inset 0 1px 0 ' + palette.glassRim,
    } as ViewStyle]} />
    {children}
  </View>;
}
