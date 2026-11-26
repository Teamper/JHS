import { createContext, useContext } from 'react';
import { useUI } from '../data/stores/uiStore.ts';
import type { Palette } from './tokens/palette.ts';

export const AppearanceContext = createContext<{
  palette: Palette;
  darkMode: boolean;
  reduceMotion: boolean;
  reduceTransparency: boolean;
} | null>(null);

export const TogglePrivacyContext = createContext<(() => void) | null>(null);

export function useAppearance() {
  return useContext(AppearanceContext)!;
}

export function usePrivacy() {
  return { masked: useUI(state => state.masked), togglePrivacy: useContext(TogglePrivacyContext)! };
}
