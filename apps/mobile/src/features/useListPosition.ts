import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { FlashListRef } from '@shopify/flash-list';

export function useListPosition<Item>(query: object) {
  const list = useRef<FlashListRef<Item>>(null);
  const saved = useRef<{ query: object; offset: number } | null>(null);

  useFocusEffect(useCallback(() => {
    const anchor = saved.current;
    if (anchor?.query !== query) return;
    const frame = requestAnimationFrame(() => {
      list.current?.scrollToOffset({ offset: anchor.offset, animated: false, skipFirstItemOffset: true });
      saved.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [query]));

  return { list, remember: () => { saved.current = { query, offset: list.current?.getAbsoluteLastScrollOffset() ?? 0 }; } };
}
