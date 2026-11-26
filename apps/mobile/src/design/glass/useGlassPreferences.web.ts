import { useEffect, useState } from 'react';

export function useGlassPreferences() {
  const [preferences, setPreferences] = useState({ reduceMotion: false, reduceTransparency: false });
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const transparency = window.matchMedia('(prefers-reduced-transparency: reduce)');
    const update = () => setPreferences({ reduceMotion: motion.matches, reduceTransparency: transparency.matches });
    update();
    motion.addEventListener('change', update);
    transparency.addEventListener('change', update);
    return () => {
      motion.removeEventListener('change', update);
      transparency.removeEventListener('change', update);
    };
  }, []);
  return preferences;
}
