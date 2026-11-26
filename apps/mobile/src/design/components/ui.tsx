import { StyleSheet } from 'react-native';

export { Body } from './Body.tsx';
export { Button } from './Button.tsx';
export { Choices, type Menu } from './Choices.tsx';
export { EmptyState as Status } from './EmptyState.tsx';
export { GroupedList, Line } from './GroupedList.tsx';
export { Icon, type IconName } from './Icon.tsx';
export { Cover, MovieCard as MovieTile } from './MovieCard.tsx';
export { ScreenScaffold as Page } from './ScreenScaffold.tsx';
export { SearchBar as Search } from './SearchBar.tsx';

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请重试。';
}

export const styles = StyleSheet.create({
  fill: { flex: 1, minWidth: 0 },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  controls: { paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  section: { gap: 12 },
  image: { width: '100%', height: '100%' },
});
