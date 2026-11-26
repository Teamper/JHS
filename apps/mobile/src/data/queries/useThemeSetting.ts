import { useQuery } from '@tanstack/react-query';
import type { Workspace } from '../workspace/createWorkspace.ts';
import { queryKeys } from './queryKeys.ts';

export type ThemeSetting = 'system' | 'light' | 'dark';

function selectTheme(snapshot: Readonly<Record<string, unknown>>): ThemeSetting {
  return snapshot.theme === 'dark' || snapshot.theme === 'light' ? snapshot.theme : 'system';
}

export function useSettingsValue<T>(workspace: Workspace, select: (snapshot: Readonly<Record<string, unknown>>) => T) {
  return useQuery({
    queryKey: queryKeys.settings, queryFn: () => workspace.settings.snapshot(),
    initialData: () => workspace.settings.snapshot(), select,
  }).data;
}

export function useThemeSetting(workspace: Workspace) {
  return useSettingsValue(workspace, selectTheme);
}
