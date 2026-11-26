import { useCallback, useRef, useState } from 'react';
import { StatusBar, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Image } from 'expo-image';
import type { Routes } from '../../app/navigation/types.ts';
import { AppearanceContext, useAppearance, usePrivacy } from '../../design/appearance.ts';
import { GlassPillButton } from '../../design/components/GlassPillButton.tsx';
import { Body } from '../../design/components/ui.tsx';
import { GlassBackdrop } from '../../design/glass/GlassSurface';
import { ScreenBackdrop, useRegisterBackdrop } from '../../design/glass/backdropContext.tsx';
import { lensSpring } from '../../design/tokens/motion.ts';
import { dark } from '../../design/tokens/palette.ts';
import { useRoot } from '../navigation.ts';

function boundedOffset(offset: number, size: number, scale: number) {
  'worklet';
  const edge = size * (scale - 1) / 2;
  return Math.min(edge, Math.max(-edge, offset));
}

export function Gallery() {
  const { images, index } = useRoute<RouteProp<Routes, 'Gallery'>>().params;
  const navigation = useRoot();
  const insets = useSafeAreaInsets();
  const appearance = useAppearance();
  const { reduceMotion } = appearance;
  const { masked, togglePrivacy } = usePrivacy();
  const window = useWindowDimensions();
  const [viewport, setViewport] = useState({ width: window.width, height: window.height });
  const [selected, setSelected] = useState(index);
  const target = useRef<View>(null);
  useRegisterBackdrop(target);
  const { width, height } = viewport;
  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const axis = useSharedValue(0);
  const pinching = useSharedValue(false);
  const pinchScale = useSharedValue(1);
  const pinchX = useSharedValue(0);
  const pinchY = useSharedValue(0);

  useFocusEffect(useCallback(() => () => {
    cancelAnimation(x);
    cancelAnimation(y);
    cancelAnimation(scale);
  }, [scale, x, y]));

  function close() {
    if (navigation.isFocused()) navigation.goBack();
  }

  function goTo(next: number) {
    if (!navigation.isFocused() || next < 0 || next >= images.length) return;
    scale.value = 1;
    x.value = 0;
    y.value = 0;
    setSelected(next);
  }

  function settle(value: number) {
    'worklet';
    return reduceMotion ? value : withSpring(value, lensSpring);
  }

  const pinch = Gesture.Pinch()
    .onStart(event => {
      pinching.value = true;
      cancelAnimation(scale);
      cancelAnimation(x);
      cancelAnimation(y);
      pinchScale.value = scale.value;
      pinchX.value = event.focalX - width / 2 - x.value;
      pinchY.value = event.focalY - height / 2 - y.value;
    })
    .onUpdate(event => {
      const nextScale = Math.min(4, Math.max(1, pinchScale.value * event.scale));
      const ratio = nextScale / pinchScale.value;
      scale.value = nextScale;
      x.value = boundedOffset(event.focalX - width / 2 - pinchX.value * ratio, width, nextScale);
      y.value = boundedOffset(event.focalY - height / 2 - pinchY.value * ratio, height, nextScale);
    })
    .onFinalize(() => { pinching.value = false; });

  const doubleTap = Gesture.Tap().numberOfTaps(2).maxDistance(18).onEnd((event, success) => {
    if (!success) return;
    const next = scale.value > 1.01 ? 1 : 2.5;
    scale.value = settle(next);
    x.value = settle(boundedOffset((width / 2 - event.x) * (next - 1), width, next));
    y.value = settle(boundedOffset((height / 2 - event.y) * (next - 1), height, next));
  });

  const pan = Gesture.Pan().minDistance(8).maxPointers(1)
    .onStart(() => {
      cancelAnimation(x);
      cancelAnimation(y);
      dragX.value = x.value;
      dragY.value = y.value;
      axis.value = 0;
    })
    .onUpdate(event => {
      if (pinching.value) return;
      if (scale.value > 1.01) {
        x.value = boundedOffset(dragX.value + event.translationX, width, scale.value);
        y.value = boundedOffset(dragY.value + event.translationY, height, scale.value);
        return;
      }
      if (axis.value === 0) {
        const horizontal = Math.abs(event.translationX);
        const vertical = Math.abs(event.translationY);
        if (Math.max(horizontal, vertical) < 8) return;
        axis.value = horizontal >= vertical ? 1 : 2;
      }
      if (axis.value === 1) {
        const atEdge = event.translationX > 0 ? selected === 0 : selected === images.length - 1;
        x.value = atEdge ? event.translationX * 0.2 : event.translationX;
      } else {
        y.value = Math.max(0, event.translationY);
      }
    })
    .onEnd((event, success) => {
      if (!success || pinching.value || scale.value > 1.01) return;
      if (axis.value === 2 && event.translationY > Math.min(140, height * 0.2)) {
        scheduleOnRN(close);
        return;
      }
      if (axis.value === 1 && (Math.abs(event.translationX) > Math.min(90, width * 0.2) ||
        (Math.abs(event.translationX) > 25 && Math.abs(event.velocityX) > 620))) {
        const next = selected + (event.translationX < 0 ? 1 : -1);
        if (next >= 0 && next < images.length) scheduleOnRN(goTo, next);
      }
      x.value = settle(0);
      y.value = settle(0);
    })
    .onFinalize((_event, success) => {
      if (success || pinching.value || scale.value > 1.01) return;
      x.value = settle(0);
      y.value = settle(0);
    });

  const transform = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
    opacity: scale.value > 1.01 ? 1 : 1 - Math.min(y.value / height, 0.65),
  }));

  return <AppearanceContext.Provider value={{ ...appearance, palette: dark, darkMode: true }}>
    <StatusBar barStyle="light-content" />
    <ScreenBackdrop.Provider value={target}><View style={styles.screen}>
    <GlassBackdrop target={target} style={styles.screen}>
      {masked ? <View style={styles.hidden}><Body style={styles.counter}>媒体已隐藏</Body></View> :
        <GestureDetector gesture={Gesture.Simultaneous(pinch, doubleTap, pan)} touchAction="none">
          <View testID="gallery-viewport" collapsable={false} style={styles.viewport} onLayout={event => {
            const { width, height } = event.nativeEvent.layout;
            setViewport(previous => previous.width === width && previous.height === height ? previous : { width, height });
          }}>
            <Animated.View pointerEvents="none" testID="gallery-transform" style={[StyleSheet.absoluteFill, transform]}>
              <Image accessibilityLabel={'第 ' + (selected + 1) + ' 张图片'} accessible source={{ uri: images[selected] }}
                recyclingKey={images[selected]} transition={0} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} contentFit="contain" />
            </Animated.View>
          </View>
        </GestureDetector>}
    </GlassBackdrop>
    <View pointerEvents="box-none" style={[styles.top, { top: insets.top + 12, left: insets.left + 16, right: insets.right + 16 }]}>
      <GlassPillButton label="返回" icon="arrow-left" onPress={close} />
      {!masked && <Body style={styles.counter} tabular>{selected + 1} / {images.length}</Body>}
      <GlassPillButton label={masked ? '关闭隐私遮罩' : '打开隐私遮罩'} icon={masked ? 'eye-off' : 'eye'} onPress={togglePrivacy} />
    </View>
    {!masked && images.length > 1 && <View pointerEvents="box-none" style={[styles.bottom, { bottom: insets.bottom + 14 }]}>
      {selected > 0 && <GlassPillButton label="上一张" icon="chevron-left" onPress={() => goTo(selected - 1)} />}
      {selected + 1 < images.length && <GlassPillButton label="下一张" icon="chevron-right" onPress={() => goTo(selected + 1)} />}
    </View>}
    </View></ScreenBackdrop.Provider>
  </AppearanceContext.Provider>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.canvas },
  viewport: { flex: 1, overflow: 'hidden' },
  hidden: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  bottom: { position: 'absolute', flexDirection: 'row', justifyContent: 'center', left: 12, right: 12, gap: 12 },
  counter: { color: dark.textPrimary, backgroundColor: dark.glassTint, overflow: 'hidden', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 3 },
});
