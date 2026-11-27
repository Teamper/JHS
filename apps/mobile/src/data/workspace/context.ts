import { createContext, useContext } from 'react';
import type { CatalogSource } from '../catalog/CatalogSource.ts';
import type { Workspace } from './createWorkspace.ts';
import type { TranslationService } from '@jhs/core';
import type { Connections } from '../connections/installConnections.ts';

export const AppContext = createContext<{
  workspace: Workspace;
  catalog: CatalogSource;
  translation: TranslationService;
  connections: Connections;
  feedback: (message: string, transactionId?: string | null) => void;
} | null>(null);

export function useApp() { return useContext(AppContext)!; }

