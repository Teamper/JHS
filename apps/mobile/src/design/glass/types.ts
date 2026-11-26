import type { ReactNode, RefObject } from 'react';
import type { StyleProp, View, ViewStyle } from 'react-native';

export type GlassTarget = RefObject<View | null>;
export type GlassProps = {
  radius?: number;
  lens?: boolean;
  reduceTransparency?: boolean;
  blurTarget?: GlassTarget;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};
