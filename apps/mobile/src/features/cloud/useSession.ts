import { useCallback, useRef, useSyncExternalStore } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { SessionSite } from '../../platform/session/types.ts';
import { useApp } from '../../data/workspace/context.ts';

export function useAccount(site: SessionSite) {
  const { connections: { accounts } } = useApp();
  const subscribe = useCallback((change: () => void) => {
    accounts.addEventListener('change', change);
    return () => accounts.removeEventListener('change', change);
  }, [accounts]);
  return useSyncExternalStore(subscribe, () => accounts.get(site), () => accounts.get(site));
}

export function useScreenSignal() {
  const controller = useRef<AbortController | null>(null);
  useFocusEffect(useCallback(() => {
    const next = new AbortController();
    controller.current = next;
    return () => next.abort();
  }, []));
  return () => controller.current?.signal;
}
