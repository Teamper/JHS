import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { errorText } from '../design/components/ui.tsx';
import { dark } from '../design/tokens/palette.ts';
import { createMobileAppContainer, readPrivacy, type MobileAppContainer } from './container.ts';
import { AppProvider } from './providers/AppProvider.tsx';

let opening: Promise<MobileAppContainer> | undefined;

export default function App() {
  const [ready, setReady] = useState<{ container: MobileAppContainer; privacy: boolean } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    opening ??= createMobileAppContainer();
    void opening.then(async container => {
      const privacy = await readPrivacy(container.workspace);
      if (mounted) setReady({ container, privacy });
    }).catch(failure => { if (mounted) setError(errorText(failure)); });
    return () => { mounted = false; };
  }, []);
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider>{ready ? <AppProvider container={ready.container} initialPrivacy={ready.privacy} /> :
    <View style={{ flex: 1, backgroundColor: dark.canvas, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
      {!error && <ActivityIndicator color={dark.accent} />}
      <Text style={{ color: dark.textPrimary, textAlign: 'center', fontSize: 16 }}>{error || '正在打开 JHS 片库'}</Text>
    </View>}
  </SafeAreaProvider></GestureHandlerRootView>;
}
