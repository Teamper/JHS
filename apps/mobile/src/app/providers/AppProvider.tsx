import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StatusBar, View, useColorScheme } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppearanceContext, TogglePrivacyContext } from '../../design/appearance.ts';
import { AppContext } from '../../data/workspace/context.ts';
import { errorText } from '../../design/components/ui.tsx';
import { useGlassPreferences } from '../../design/glass/useGlassPreferences';
import { GlassBackdropProvider } from '../../design/glass/backdropContext.tsx';
import { dark, light } from '../../design/tokens/palette.ts';
import { createUIStore, UIStoreContext, useUIStore } from '../../data/stores/uiStore.ts';
import { subscribeInvalidation } from '../../data/queries/invalidation.ts';
import { useThemeSetting } from '../../data/queries/useThemeSetting.ts';
import { savePrivacy, type MobileAppContainer } from '../container.ts';
import { RootNavigator } from '../navigation/RootNavigator.tsx';
import { OverlayHost } from './OverlayHost.tsx';
import { useSheetOpen } from '../../design/overlayState.ts';

export function AppProvider({ container, initialPrivacy }: { container: MobileAppContainer; initialPrivacy: boolean }) {
  const [store] = useState(() => createUIStore(initialPrivacy));
  return <QueryClientProvider client={container.queryClient}>
    <UIStoreContext.Provider value={store}><AppShell container={container} /></UIStoreContext.Provider>
  </QueryClientProvider>;
}

function AppShell({ container }: { container: MobileAppContainer }) {
  const { workspace, catalog, queryClient, translation, connections } = container;
  const store = useUIStore();
  const colorScheme = useColorScheme();
  const { reduceMotion, reduceTransparency } = useGlassPreferences();
  const setting = useThemeSetting(workspace);
  const darkMode = setting === 'dark' || (setting === 'system' && colorScheme !== 'light');
  const palette = darkMode ? dark : light;
  const sheetOpen = useSheetOpen();
  useEffect(() => subscribeInvalidation(workspace.events, queryClient), [workspace, queryClient]);

  const feedback = useCallback((message: string, transactionId?: string | null) => store.setState({ notice: { message, transactionId } }), [store]);
  const app = useMemo(() => ({ workspace, catalog, translation, connections, feedback }), [workspace, catalog, translation, connections, feedback]);
  const appearance = useMemo(() => ({ palette, darkMode, reduceMotion, reduceTransparency }), [palette, darkMode, reduceMotion, reduceTransparency]);

  const togglePrivacy = useCallback(() => {
    const { masked, privacySaving } = store.getState();
    if (privacySaving) return;
    store.setState({ masked: !masked, privacySaving: true });
    void savePrivacy(workspace, !masked).catch(error => {
      store.setState({ masked });
      feedback(errorText(error));
    }).finally(() => store.setState({ privacySaving: false }));
  }, [feedback, store, workspace]);
  const setRoute = useCallback((route: string) => store.setState({ route }), [store]);

  return <AppContext.Provider value={app}>
    <AppearanceContext.Provider value={appearance}>
      <TogglePrivacyContext.Provider value={togglePrivacy}>
        <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
        <GlassBackdropProvider>
          <View style={{ flex: 1 }} importantForAccessibility={Platform.OS !== 'web' && sheetOpen ? 'no-hide-descendants' : 'auto'}
            accessibilityElementsHidden={Platform.OS !== 'web' && sheetOpen}>
            <RootNavigator palette={palette} darkMode={darkMode} onRouteChange={setRoute} />
          </View>
          <OverlayHost />
        </GlassBackdropProvider>
      </TogglePrivacyContext.Provider>
    </AppearanceContext.Provider>
  </AppContext.Provider>;
}
