import { useEffect } from 'react';
import { BackHandler, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../data/workspace/context.ts';
import { useUI, useUIStore } from '../../data/stores/uiStore.ts';
import { GlassToast } from '../../design/components/GlassToast.tsx';
import { errorText } from '../../design/components/ui.tsx';
import { settingsFooter, tabBar, touchTarget } from '../../design/tokens/metrics.ts';
import { useNativeSheet, useSheetOpen } from '../../design/overlayState.ts';
import { useKeyboardVisibility } from '../navigation/useKeyboardVisibility';

export function OverlayHost() {
  const { workspace, feedback } = useApp();
  const store = useUIStore();
  const notice = useUI(state => state.notice);
  const route = useUI(state => state.route);
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisibility();
  const sheetOpen = useSheetOpen();
  const sheet = useNativeSheet();
  const sheetId = sheet?.id;
  useEffect(() => {
    if (!sheetId) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (Keyboard.isVisible()) Keyboard.dismiss();
      else sheet?.close();
      return true;
    });
    return () => listener.remove();
  }, [sheet, sheetId]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => {
      if (store.getState().notice === notice) store.setState({ notice: null });
    }, notice.transactionId ? 8500 : 4300);
    return () => clearTimeout(timer);
  }, [notice, store]);
  if (sheet) return sheet.view;
  if (!notice || sheetOpen || route === 'Gallery') return null;

  function undo(transactionId: string) {
    store.setState({ notice: null });
    void workspace.state.undoTransaction(transactionId).then(result => feedback(result.reverted.length ? '已撤销' : '这条记录当前不可撤销。'),
      error => feedback(errorText(error)));
  }

  const controls = route === 'Home' ? tabBar.height + tabBar.gap
    : route === 'Settings' ? touchTarget + settingsFooter.top + settingsFooter.bottom : 0;
  const bottom = Math.max(keyboard, insets.bottom + (keyboard ? 0 : controls)) + tabBar.gap;
  const id = notice.transactionId;
  return <GlassToast message={notice.message} bottom={bottom} undo={id ? () => undo(id) : undefined} />;
}
