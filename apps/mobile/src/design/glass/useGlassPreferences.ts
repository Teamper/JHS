import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export function useGlassPreferences() {
  const [reduceMotion, setMotion] = useState(false);
  const [reduceTransparency, setTransparency] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setMotion(value); });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setMotion);
    const transparency = Platform.OS === 'ios'
      ? AccessibilityInfo.addEventListener('reduceTransparencyChanged', setTransparency) : null;
    if (transparency) void AccessibilityInfo.isReduceTransparencyEnabled().then(value => { if (active) setTransparency(value); });
    return () => { active = false; motion.remove(); transparency?.remove(); };
  }, []);
  return { reduceMotion, reduceTransparency };
}
