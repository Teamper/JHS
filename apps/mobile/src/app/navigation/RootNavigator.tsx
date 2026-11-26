import { DarkTheme, DefaultTheme, NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { Palette } from '../../design/tokens/palette.ts';
import { Activity } from '../../features/mine/Activity.tsx';
import { ActorWorks, FavoriteActors } from '../../features/actor/Actors.tsx';
import { Follow } from '../../features/follow/Follow.tsx';
import { Mine } from '../../features/mine/Mine.tsx';
import { Discover } from '../../features/discover/Discover.tsx';
import { Library } from '../../features/library/Library.tsx';
import { Work } from '../../features/detail/Work.tsx';
import { Gallery } from '../../features/gallery/Gallery.tsx';
import { Backup } from '../../features/settings/Backup.tsx';
import { Settings } from '../../features/settings/Settings.tsx';
import { Sync } from '../../features/settings/Sync.tsx';
import { Accounts } from '../../features/cloud/Accounts.tsx';
import { CloudTasks } from '../../features/cloud/CloudTasks.tsx';
import { RemoteLists } from '../../features/cloud/RemoteLists.tsx';
import { LiquidTabBar } from './LiquidTabBar.tsx';
import type { Routes, Tabs as TabRoutes } from './types.ts';

const Stack = createNativeStackNavigator<Routes>();
const Tabs = createBottomTabNavigator<TabRoutes>();

function Home() {
  return <Tabs.Navigator screenOptions={{ headerShown: false }} tabBar={props => <LiquidTabBar {...props} />}>
    <Tabs.Screen name="Discover" component={Discover} options={{ title: '发现' }} />
    <Tabs.Screen name="Follow" component={Follow} options={{ title: '追新' }} />
    <Tabs.Screen name="Library" component={Library} options={{ title: '片库' }} />
    <Tabs.Screen name="Mine" component={Mine} options={{ title: '我的' }} />
  </Tabs.Navigator>;
}

export function RootNavigator({ palette, darkMode, onRouteChange }: { palette: Palette; darkMode: boolean; onRouteChange: (route: string) => void }) {
  const navigation = useNavigationContainerRef<Routes>();
  const notify = () => {
    const state = navigation.getRootState();
    if (state) onRouteChange(state.routes[state.index].name);
  };
  const base = darkMode ? DarkTheme : DefaultTheme;
  return <NavigationContainer ref={navigation} onReady={notify} onStateChange={notify}
    theme={{ ...base, colors: { ...base.colors, background: palette.canvas, card: palette.surface,
      text: palette.textPrimary, primary: palette.accent, border: palette.hairline } }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Work" component={Work} />
        <Stack.Screen name="Settings" component={Settings} />
        <Stack.Screen name="Sync" component={Sync} />
        <Stack.Screen name="Backup" component={Backup} />
        <Stack.Screen name="Activity" component={Activity} />
        <Stack.Screen name="Accounts" component={Accounts} />
        <Stack.Screen name="Cloud" component={CloudTasks} />
        <Stack.Screen name="RemoteLists" component={RemoteLists} />
        <Stack.Screen name="FavoriteActors" component={FavoriteActors} />
        <Stack.Screen name="ActorWorks" component={ActorWorks} />
        <Stack.Screen name="Gallery" component={Gallery} options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack.Navigator>
    </NavigationContainer>;
}
