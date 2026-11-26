import { ActorSourceHealth, LifecycleScope, NewVideoScanController, parseTaskInterval, parseTaskTimestamp } from '@jhs/core';
import { savedActorRef } from '../models/movie.ts';
import type { Workspace } from '../workspace/createWorkspace.ts';
import type { CatalogSource } from './CatalogSource.ts';

const healthKey = 'jhs_new_video_source_health_v1';
const sources = new WeakMap<Workspace, Promise<{ health: ActorSourceHealth; flush: () => Promise<unknown> }>>();

async function readHealth(database: Workspace['database']) {
  let value = await database.getItem(healthKey);
  let saved: Promise<unknown> = Promise.resolve();
  const health = new ActorSourceHealth({
    getLocal: () => value,
    setLocal: (_key, next) => {
      value = next;
      saved = database.setItem(healthKey, next);
      void saved.catch(() => {});
    },
  });
  return { health, flush: () => saved };
}

export async function scanFollow(workspace: Workspace, catalog: CatalogSource, scope: LifecycleScope, force: boolean) {
  const { state, storage, events } = workspace;
  const settings = workspace.settings.snapshot();
  const failures: { id: string; error: unknown }[] = [];
  let cache = sources.get(workspace);
  if (!cache) {
    cache = readHealth(workspace.database);
    sources.set(workspace, cache);
    void cache.catch(() => sources.delete(workspace));
  }
  const { health: sourceHealth, flush } = await cache;
  scope.assertActive();
  const scanner = new NewVideoScanController({
    scope, sourceHealth, allowHidden: true, preserveNewVideo: true,
    getTimestamp: () => new Date().toISOString(),
    readTitleKeywords: () => storage.getTitleFilterKeyword(),
    state: {
      getFavoriteActressList: () => state.getFavoriteActressList(),
      getBlacklistCarList: () => state.getBlacklistCarList(),
      getNewVideoDecisions: () => state.getNewVideoDecisions(),
      getCarMap: () => state.getCarMap(),
      async updateFavoriteActress(update: Parameters<typeof state.updateFavoriteActress>[0], options: { scan: boolean }) {
        scope.assertActive();
        const result = await state.updateFavoriteActress(update, { ...options, keepUnseen: true, signal: scope.signal });
        if (result) events.emit({ domain: 'follow' });
        return result;
      },
    },
    actressInfo: {
      async movies(_site: string, { actorId }: { actorId: string }) {
        const actor = savedActorRef(actorId, '');
        const result = await catalog.actor(actor, 1, scope.signal, true);
        return result.items.map(movie => ({ ...movie, publishTime: movie.releaseDate, score: movie.rating }));
      },
    },
    onNewItems: () => {},
    logger: { error(_message: string, url: string, error: unknown) {
      failures.push({ id: new URL(url).pathname.split('/').at(-1)!, error });
    } },
  });
  scope.addCleanup(() => scanner.dispose());
  const result = await scanner.scanActresses({
    baseUrl: 'https://javdb.com', concurrency: 2, sleepMs: 350, force,
    ruleHours: force ? 0 : Number(settings.checkNewVideo_ruleTime ?? 8760),
    intervalHours: parseTaskInterval('newVideo', settings.checkNewVideo_intervalTime),
    isUnnecessaryCheck: (date, hours) => {
      const time = parseTaskTimestamp(date);
      return time != null && Date.now() - time < hours * 3_600_000;
    },
    isNetworkBlocked: () => false,
    sleep: ms => new Promise<void>(resolve => {
      const release = scope.addCleanup(() => { clearTimeout(timer); resolve(); });
      const timer = setTimeout(release, ms);
    }),
  }).finally(flush);
  return { ...result, failures };
}
