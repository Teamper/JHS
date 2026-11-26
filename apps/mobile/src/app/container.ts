import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { File } from 'expo-file-system';
import { openDatabaseAsync } from 'expo-sqlite';
import { Platform } from 'react-native';
import { QueryClient } from '@tanstack/react-query';
import { DependencyContainer, IntegrationRegistry, DiagnosticsService, SERVICE, googleTranslate, TranslationService, HttpService, ExternalUrlPolicy } from '@jhs/core';
import { MobileDatabase } from '../data/sqlite/MobileDatabase.ts';
import { installPortableCrypto } from '../platform/crypto/portableCrypto.ts';
import { applyLegacySnapshot, migrationKey } from '../platform/migration/v28Migration.ts';
import { androidDevice, secure } from '../platform/device/nativeBridge.ts';
import { installSync } from '../data/workspace/syncAdapter.ts';
import { createWorkspace, privacyKey, type Workspace } from '../data/workspace/createWorkspace.ts';

import { CatalogSource } from '../data/catalog/CatalogSource.ts';
import { mobileHttp } from '../platform/http/mobileHttp.ts';
import { installConnections } from '../data/connections/installConnections.ts';
import { jhsSession } from '../platform/session/jhsSession';

const sample = Platform.OS === 'web' || process.env.EXPO_PUBLIC_JHS_SAMPLE === '1';

export async function createMobileAppContainer() {
  installPortableCrypto();
  const db = await openDatabaseAsync(sample ? 'jhs-samples.sqlite' : 'jhs.sqlite', {
    // The FTS virtual table owns its internal statements until SQLite closes the connection.
    finalizeUnusedStatementsBeforeClosing: false,
  });
  const database = new MobileDatabase(db, work => Platform.OS === 'web'
    ? db.withTransactionAsync(() => work(db))
    : db.withExclusiveTransactionAsync(work), Platform.OS === 'web');
  await database.initialize();
  if (androidDevice && !sample && await database.getItem(migrationKey) === null) {
    const snapshot = await androidDevice.readLegacySnapshot();
    if (snapshot) {
      const file = new File(snapshot.uri);
      try {
        if (file.size > 64 * 1024 * 1024) throw new Error('旧片库副本超过大小限制，已保留原数据。');
        const text = await file.text();
        if (await digestStringAsync(CryptoDigestAlgorithm.SHA256, text) !== snapshot.sha256) throw new Error('旧片库副本校验失败，已保留原数据。');
        await applyLegacySnapshot(database, text);
      } finally { if (file.exists) file.delete(); }
    }
  }
  const workspace: Workspace = await createWorkspace(database, sample);
  if (!sample) workspace.sync = await installSync(workspace);
  if (androidDevice && !sample) await database.setItem(migrationKey, 'active');
  workspace.sync?.start();
  const queryClient = new QueryClient({ defaultOptions: {
    queries: { staleTime: 30_000, retry: false, networkMode: 'always' },
    mutations: { networkMode: 'always' },
  } });
  const diagnostics = new DiagnosticsService();
  const dependencies = new DependencyContainer(diagnostics);
  dependencies.register(SERVICE.http, new HttpService(mobileHttp, new ExternalUrlPolicy()));
  const integrations = new IntegrationRegistry(dependencies, diagnostics);
  integrations.register(googleTranslate);
  const translation = new TranslationService(integrations, null, { settings: workspace.settings, googleOnly: true });
  const connections = await installConnections(workspace, queryClient, diagnostics);
  return { workspace, catalog: new CatalogSource(mobileHttp, connections.accounts), queryClient, translation, connections };
}

export async function readPrivacy(workspace: Workspace) {
  const enabled = androidDevice && !workspace.sample ? await secure.getValue(privacyKey, false) === true
    : await workspace.database.getItem(privacyKey) === true;
  await androidDevice?.setPrivacy(enabled);
  await jhsSession?.setPrivacy(enabled);
  return enabled;
}

export async function savePrivacy(workspace: Workspace, enabled: boolean) {
  if (androidDevice && !workspace.sample) await secure.setValue(privacyKey, enabled);
  else await workspace.database.setItem(privacyKey, enabled);
  await androidDevice?.setPrivacy(enabled);
  await jhsSession?.setPrivacy(enabled);
}

export type MobileAppContainer = Awaited<ReturnType<typeof createMobileAppContainer>>;
