import { createContext, useCallback, useContext, useId, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import type { GlassTarget } from './types.ts';

type Backdrop = { routeKey: string; instance: string; target: GlassTarget; capture?: GlassTarget };

const ActiveBackdrop = createContext<Backdrop | null>(null);
const SetActiveBackdrop = createContext<Dispatch<SetStateAction<Backdrop | null>> | null>(null);
export const ScreenBackdrop = createContext<GlassTarget | null>(null);

export function GlassBackdropProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Backdrop | null>(null);
  return <SetActiveBackdrop.Provider value={setActive}>
    <ActiveBackdrop.Provider value={active}>{children}</ActiveBackdrop.Provider>
  </SetActiveBackdrop.Provider>;
}

export function useRegisterBackdrop(target: GlassTarget, capture?: GlassTarget) {
  const setActive = useContext(SetActiveBackdrop)!;
  const { key: routeKey } = useRoute();
  const instance = useId();
  useFocusEffect(useCallback(() => {
    setActive({ routeKey, instance, target, capture });
    return () => setActive(current => current?.target === target ? null : current);
  }, [capture, instance, routeKey, setActive, target]));
}

export function useActiveBackdrop() {
  return useContext(ActiveBackdrop);
}

export function useGlassBackdrop() {
  const screen = useContext(ScreenBackdrop);
  const active = useActiveBackdrop();
  return screen ?? active?.target;
}
