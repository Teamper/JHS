import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useAppearance } from '../appearance.ts';
import { lensSpring } from '../tokens/motion.ts';

export function SegmentedControl<T extends string>({ value, options, onChange }: {
  value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void;
}) {
  const { palette, reduceMotion } = useAppearance();
  const [width, setWidth] = useState(0);
  const slot = width / options.length;
  const target = Math.max(0, options.findIndex(option => option.value === value)) * slot;
  const lastSlot = useRef(0);
  const position = useSharedValue(0);
  useEffect(() => {
    position.value = reduceMotion || lastSlot.current !== slot ? target : withSpring(target, lensSpring);
    lastSlot.current = slot;
  }, [position, reduceMotion, slot, target]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: position.value }] }));
  return <View accessibilityRole="tablist" style={[styles.track, { backgroundColor: palette.surfaceRecessed }]}>
    <View style={styles.options} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      {slot > 0 && <Animated.View testID="segmented-indicator" pointerEvents="none"
        style={[styles.indicator, { width: slot, backgroundColor: palette.surfaceElevated }, indicator]} />}
      {options.map(option => <Pressable key={option.value} accessibilityRole="tab" accessibilityLabel={option.label}
        accessibilityState={{ selected: value === option.value }} aria-selected={value === option.value} onPress={() => onChange(option.value)} style={styles.option}>
        <Text style={{ textAlign: 'center', color: value === option.value ? palette.accent : palette.textSecondary,
          fontSize: 13, fontWeight: '600' }}>{option.label}</Text>
      </Pressable>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  track: { padding: 4, borderRadius: 26, overflow: 'hidden' },
  options: { flexDirection: 'row' },
  indicator: { position: 'absolute', left: 0, top: 1, bottom: 1, borderRadius: 24 },
  option: { flex: 1, minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
});
