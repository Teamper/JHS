import { useLayoutEffect, type ReactNode } from 'react';
import { create } from 'zustand';

type Sheet = { id: string; view: ReactNode; close: () => void };
const overlay = create<{ sheets: number; nativeSheets: Sheet[] }>(() => ({ sheets: 0, nativeSheets: [] }));

export function putNativeSheet(sheet: Sheet) {
  overlay.setState(({ nativeSheets }) => ({
    nativeSheets: nativeSheets.some(item => item.id === sheet.id)
      ? nativeSheets.map(item => item.id === sheet.id ? sheet : item)
      : [...nativeSheets, sheet],
  }));
}

export function removeNativeSheet(id: string) {
  overlay.setState(({ nativeSheets }) => ({ nativeSheets: nativeSheets.filter(item => item.id !== id) }));
}

export function useNativeSheet() {
  return overlay(state => state.nativeSheets.at(-1));
}

export function useSheetPresence(open: boolean) {
  useLayoutEffect(() => {
    if (!open) return;
    overlay.setState(state => ({ sheets: state.sheets + 1 }));
    return () => overlay.setState(state => ({ sheets: state.sheets - 1 }));
  }, [open]);
}

export function useSheetOpen() {
  return overlay(state => state.sheets > 0 || state.nativeSheets.length > 0);
}
