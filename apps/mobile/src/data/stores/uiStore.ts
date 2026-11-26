import { createContext, useContext } from 'react';
import { createStore, useStore } from 'zustand';

export type Notice = { message: string; transactionId?: string | null };
type UIState = { masked: boolean; privacySaving: boolean; notice: Notice | null; route: string };

export function createUIStore(masked: boolean) {
  return createStore<UIState>()(() => ({ masked, privacySaving: false, notice: null, route: 'Home' }));
}

export const UIStoreContext = createContext<ReturnType<typeof createUIStore> | null>(null);

export function useUIStore() { return useContext(UIStoreContext)!; }

export function useUI<T>(select: (state: UIState) => T) {
  return useStore(useUIStore(), select);
}
