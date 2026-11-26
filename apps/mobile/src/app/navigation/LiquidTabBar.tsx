import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAppearance } from '../../design/appearance.ts';
import { Icon, type IconName } from '../../design/components/Icon.tsx';
import { GlassSurface } from '../../design/glass/GlassSurface';
import { LiquidLens } from '../../design/glass/LiquidLens';
import { useActiveBackdrop } from '../../design/glass/backdropContext.tsx';
import { tabBar } from '../../design/tokens/metrics.ts';
import { lensSpring, shortTransition } from '../../design/tokens/motion.ts';
import { useKeyboardVisibility } from './useKeyboardVisibility';

const icons: Record<string, IconName> = { Discover: 'grid', Follow: 'inbox', Library: 'bookmark', Mine: 'user' };
const lensHeight = tabBar.height - 8;

function hapticTab() {
  void Haptics.selectionAsync().catch(() => undefined);
}

function TabGlyph({ position, index, title, icon }: {
  position: SharedValue<number>; index: number; title: string; icon: IconName;
}) {
  const { palette, reduceMotion } = useAppearance();
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: reduceMotion ? 1 : 1 + 0.12 * Math.max(0, 1 - Math.abs(index - position.value)) }],
  }));
  const label = useAnimatedStyle(() => ({
    color: interpolateColor(Math.min(1, Math.abs(index - position.value)), [0, 1], [palette.accent, palette.textSecondary]),
  }));
  const glyph = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - Math.abs(index - position.value)) }));
  return <Animated.View style={[styles.glyph, style]}>
    <View><Icon name={icon} size={19} color={palette.textSecondary} />
      <Animated.View style={[StyleSheet.absoluteFill, glyph]}><Icon name={icon} size={19} color={palette.accent} /></Animated.View>
    </View>
    <Animated.Text numberOfLines={1} style={[styles.label, label]}>{title}</Animated.Text>
  </Animated.View>;
}

export function LiquidTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { reduceMotion, reduceTransparency, palette } = useAppearance();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisibility();
  const bar = useRef<View>(null);
  const [width, setWidth] = useState(0);
  const press = useRef({ dragging: false, released: 0 });
  const selected = state.index;
  const count = state.routes.length;
  const slot = (width - 8) / count;
  const position = useSharedValue(selected);
  const scale = useSharedValue(1);
  const hidden = useSharedValue(0);
  const last = useSharedValue(selected);
  const drag = useSharedValue(false);
  const scene = state.routes[selected].key;
  const activeBackdrop = useActiveBackdrop();
  const backdrop = activeBackdrop?.routeKey === scene ? activeBackdrop : null;
  const target = backdrop?.target;

  function markDrag(dragging: boolean) {
    press.current.dragging = dragging;
    if (!dragging) press.current.released = Date.now();
  }

  function activate(index: number, fromDrag = false) {
    if (!fromDrag && (press.current.dragging || Date.now() - press.current.released < 120)) return;
    const item = state.routes[index];
    const event = navigation.emit({ type: 'tabPress', target: item.key, canPreventDefault: true });
    if (selected === index || event.defaultPrevented) {
      if (event.defaultPrevented) position.value = reduceMotion ? selected : withSpring(selected, lensSpring);
      return;
    }
    if (!fromDrag) hapticTab();
    navigation.navigate(item.name, item.params);
  }

  useEffect(() => {
    if (!drag.value) position.value = reduceMotion ? selected : withSpring(selected, lensSpring);
  }, [drag, position, reduceMotion, selected]);
  useEffect(() => {
    const offset = keyboard ? tabBar.height + insets.bottom + tabBar.gap + 8 : 0;
    hidden.value = reduceMotion ? offset : withTiming(offset, { duration: shortTransition });
  }, [hidden, insets.bottom, keyboard, reduceMotion]);

  const pan = Gesture.Pan().enabled(!keyboard && slot > 0)
    .activeOffsetX([-8, 8]).failOffsetY([-15, 15]).maxPointers(1)
    .onBegin(() => {
      last.value = selected;
      scale.value = reduceMotion ? 1 : withSpring(1.12, lensSpring);
    })
    .onStart(() => {
      drag.value = true;
      scheduleOnRN(markDrag, true);
    })
    .onUpdate(event => {
      const value = Math.min(count - 1, Math.max(0, (event.x - 4) / slot - 0.5));
      position.value = value;
      const nearest = Math.round(value);
      if (nearest !== last.value) {
        last.value = nearest;
        scheduleOnRN(hapticTab);
      }
    })
    .onEnd(() => {
      const nearest = Math.round(position.value);
      position.value = reduceMotion ? nearest : withSpring(nearest, lensSpring);
      scheduleOnRN(activate, nearest, true);
    })
    .onFinalize((_event, success) => {
      if (drag.value) scheduleOnRN(markDrag, false);
      drag.value = false;
      scale.value = reduceMotion ? 1 : withSpring(1, lensSpring);
      if (!success) position.value = reduceMotion ? selected : withSpring(selected, lensSpring);
    });
  const lensStyle = useAnimatedStyle(() => ({ transform: [{ translateX: position.value * slot }, { scale: scale.value }] }));
  const barStyle = useAnimatedStyle(() => ({ transform: [{ translateY: hidden.value }] }));
  return <View pointerEvents={keyboard ? 'none' : 'box-none'} style={[styles.position, { bottom: insets.bottom + tabBar.gap }]}>
    <Animated.View accessibilityElementsHidden={!!keyboard} importantForAccessibility={keyboard ? 'no-hide-descendants' : 'auto'}
      style={[styles.shell, { shadowColor: palette.canvas }, barStyle]}>
      <GestureDetector gesture={pan} touchAction="pan-y">
        <View ref={bar} collapsable={false} onLayout={event => setWidth(event.nativeEvent.layout.width)}
          accessibilityRole="tablist" accessibilityLabel="主导航" style={styles.bar}>
          <GlassSurface blurTarget={target} reduceTransparency={reduceTransparency} style={StyleSheet.absoluteFill} />
          {slot > 0 && <Animated.View testID="navigation-lens" pointerEvents="none" style={[styles.lens, { width: slot - 4 }, lensStyle]}>
            <LiquidLens scene={backdrop?.instance ?? scene} width={slot - 4} height={lensHeight} blurTarget={target} captureTarget={backdrop?.capture} barRef={bar}
              position={position} tracking={drag} style={StyleSheet.absoluteFill} />
          </Animated.View>}
          {state.routes.map((route, index) => {
            const options = descriptors[route.key].options;
            const title = options.title ?? route.name;
            const focused = selected === index;
            return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={title} accessibilityState={{ selected: focused }} aria-selected={focused}
              onPressIn={() => { if (!press.current.dragging) press.current.released = 0; }}
              onPress={() => { Keyboard.dismiss(); activate(index); }} onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={styles.tab}>
              <TabGlyph position={position} index={index} title={title} icon={icons[route.name]} />
            </Pressable>;
          })}
        </View>
      </GestureDetector>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  position: { position: 'absolute', left: tabBar.inset, right: tabBar.inset, alignItems: 'center' },
  shell: { width: '100%', maxWidth: tabBar.maxWidth, borderRadius: 32, shadowOffset: { width: 0, height: 4 }, shadowRadius: 14, shadowOpacity: 0.3 },
  bar: { height: tabBar.height, flexDirection: 'row', paddingHorizontal: 4, borderRadius: 32 },
  lens: { position: 'absolute', left: 6, top: 4, height: lensHeight },
  tab: { flex: 1, minWidth: 48, justifyContent: 'center', alignItems: 'center' },
  glyph: { alignItems: 'center', justifyContent: 'center', gap: 3, width: '100%' },
  label: { fontSize: 12, fontWeight: '600', lineHeight: 16, textAlign: 'center', paddingHorizontal: 2 },
});
