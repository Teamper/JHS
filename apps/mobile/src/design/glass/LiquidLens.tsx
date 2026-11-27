import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Blur, Canvas, Group, ImageShader, Paint, RoundedRect, Shader, Skia, makeImageFromView, type SkImage, type SkRuntimeEffect } from '@shopify/react-native-skia';
import Animated, { useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useAppearance, usePrivacy } from '../appearance.ts';
import { shortTransition } from '../tokens/motion.ts';
import { GlassSurface } from './GlassSurface';
import type { GlassTarget } from './types.ts';

const refraction = Platform.OS === 'android' ? Skia.RuntimeEffect.Make(`
  uniform shader scene;
  uniform float2 size;

  half4 main(float2 p) {
    float2 center = size * 0.5;
    float2 uv = (p - center) / center;
    float radius = min(1.0, length(uv));
    float rim = radius * radius * radius * radius;
    float2 q = p - uv * (rim * 8.0);
    half4 sample = scene.eval(q);
    half luma = dot(sample.rgb, half3(0.2126, 0.7152, 0.0722));
    sample.rgb = mix(half3(luma), sample.rgb, 1.24);
    return sample;
  }
`) : null;

export type LensProps = {
  scene: string;
  width: number;
  height: number;
  blurTarget?: GlassTarget;
  captureTarget?: GlassTarget;
  barRef: GlassTarget;
  position: SharedValue<number>;
  tracking: SharedValue<boolean>;
  style?: StyleProp<ViewStyle>;
};

type Frame = { image: SkImage; x: number; y: number; width: number; height: number };
type RefractionProps = Pick<LensProps, 'width' | 'height' | 'position' | 'tracking'> & { effect: SkRuntimeEffect };

function CapturedLens({ frame: { image, x, y, width: sourceWidth, height: sourceHeight }, width, height, position, tracking, effect }: RefractionProps & { frame: Frame }) {
  const { palette } = useAppearance();
  // Reanimated only needs the geometry. The Canvas owns the JS-side image reference.
  const rect = useDerivedValue(() => ({
    x: x - position.value * (width + 4) - 6,
    y, width: sourceWidth, height: sourceHeight,
  }));
  const opacity = useSharedValue(0);
  useAnimatedReaction(() => tracking.value, active => {
    opacity.value = withTiming(active ? 0.46 : 0.18, { duration: shortTransition });
  });
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: height / 2, overflow: 'hidden' }, fade]}>
    <Canvas style={StyleSheet.absoluteFill}>
      <Group layer={<Paint><Blur blur={9} mode="clamp" /></Paint>}>
        <RoundedRect x={0} y={0} width={width} height={height} r={height / 2}>
          <Shader source={effect} uniforms={{ size: [width, height] }}>
            <ImageShader image={image} rect={rect} fit="fill" tx="clamp" ty="clamp" />
          </Shader>
        </RoundedRect>
      </Group>
    </Canvas>
    <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.glassLensTint }]} />
  </Animated.View>;
}

function Refraction({ captureTarget, barRef, tracking, ...props }: RefractionProps & { captureTarget: GlassTarget; barRef: GlassTarget }) {
  const [frame, setFrame] = useState<Frame | null>(null);
  const [dragging, setDragging] = useState(false);
  const owned = useRef<SkImage | null>(null);
  const captured = frame !== null;

  useAnimatedReaction(() => tracking.value, (active, previous) => {
    if (!captured && active !== previous) scheduleOnRN(setDragging, active);
  });

  useEffect(() => () => {
    // Let the Canvas finish detaching before releasing its image.
    const image = owned.current;
    owned.current = null;
    if (image) queueMicrotask(() => image.dispose());
  }, []);

  useEffect(() => {
    if (captured || dragging) return;
    let active = true;
    const timer = setTimeout(() => {
      const target = captureTarget.current;
      const bar = barRef.current;
      if (!target || !bar || tracking.get()) return;
      target.measureInWindow((targetX, targetY, width, height) => {
        if (!active || !width || !height) return;
        bar.measureInWindow((barX, barY) => {
          if (!active) return;
          void Promise.resolve().then(() => active && !tracking.get() ? makeImageFromView(captureTarget) : null).then(image => {
            if (!image) return;
            if (!active || tracking.get()) {
              image.dispose();
              return;
            }
            owned.current = image;
            setFrame({ image, x: targetX - barX, y: targetY - barY - 4, width, height });
          }, () => { /* Live blur remains visible if the view detaches before capture. */ });
        });
      });
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [barRef, captureTarget, captured, dragging, tracking]);

  return frame && <CapturedLens {...props} tracking={tracking} frame={frame} />;
}

export function LiquidLens({ scene, width, height, blurTarget, captureTarget, barRef, position, tracking, style }: LensProps) {
  const { darkMode, reduceMotion, reduceTransparency } = useAppearance();
  const { masked } = usePrivacy();
  return <View pointerEvents="none" style={style}>
    <GlassSurface lens blurTarget={blurTarget} reduceTransparency={reduceTransparency} radius={height / 2} style={StyleSheet.absoluteFill} />
    {refraction && captureTarget && !masked && !reduceMotion && !reduceTransparency &&
      <Refraction key={scene + ':' + width + ':' + height + ':' + darkMode} effect={refraction} captureTarget={captureTarget} barRef={barRef}
        width={width} height={height} position={position} tracking={tracking} />}
  </View>;
}

