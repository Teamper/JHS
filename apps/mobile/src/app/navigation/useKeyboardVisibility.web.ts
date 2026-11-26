import { useEffect, useState } from 'react';

export function useKeyboardVisibility() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const difference = window.innerHeight - viewport.height;
      setHeight(viewport.scale <= 1 && difference > 120 ? difference : 0);
    };
    viewport.addEventListener('resize', update);
    update();
    return () => viewport.removeEventListener('resize', update);
  }, []);
  return height;
}
