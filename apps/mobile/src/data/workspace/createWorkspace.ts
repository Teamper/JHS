import { CURRENT_DATA_VERSION, decryptPortableBackup, normalizePortableData, assertSupportedDataVersion, runDataMigrations, StateService, StorageService, StorageMutationCoordinator, aggregateNewVideoRecords, SettingsService, KeywordRulesService, PortableBackupService, findMatchedTitleKeyword, normalizeMovieCarNum, WebDavSyncStore, SettingsRegistry, registerDefaultSettings } from '@jhs/core';
import { MobileDatabase } from '../sqlite/MobileDatabase.ts';
import { actorKey, movieRecord, savedActorRef, type ActorRef, type ActorProfile, type Movie, type MovieFlag } from '../models/movie.ts';
import { sampleActors, sampleLibrary, sampleMovies } from '../models/samples.ts';
import { DomainEventEmitter, publishStorageEvent } from './DomainEventEmitter.ts';

export type Decision = 'snoozed' | 'ignored' | 'dismissed' | null;
export const privacyKey = 'jhs_privacy_enabled_v1';
const recentKey = 'jhs_mobile_recent_works_v1';
type Rules = { numbers: Set<string | null>; names: Set<string>; ids: Set<string>; keywords: string[] };

export function visibleActor(rules: Rules, actor: ActorRef) {
  return !rules.ids.has(actorKey(actor)) && !rules.names.has(actor.name);
}

export function visibleWork(rules: Rules, movie: Movie) {
  return !rules.numbers.has(movie.carNum) && !findMatchedTitleKeyword(rules.keywords, movie.title, movie.carNum ?? '')
    && !movie.actors?.some(name => rules.names.has(name))
    && !movie.cast?.some(actor => actor.id && rules.ids.has(actorKey({ ...actor, id: actor.id })));
}

export async function createWorkspace(database: MobileDatabase, sample: boolean) {
  await database.initialize();
  const events = new DomainEventEmitter();
  const coordinator = new StorageMutationCoordinator();
  const local = new Map<string, string>();
  const storage = new StorageService({
    get: key => database.getItem(key),
    set: async (key, value) => { await database.setItem(key, value); },
    remove: key => database.removeItem(key),
    keys: () => database.keys(),
    commitLockedBatch: batch => database.commitLockedBatch(batch),
    readAtomicSnapshot: keys => database.readAtomicSnapshot(keys),
    commitAtomicBatch: batch => database.commitAtomicBatch(batch),
    getLocal: key => local.get(key) ?? null,
    setLocal: (key, value) => { local.set(key, value); },
    removeLocal: key => { local.delete(key); },
    getValue: async (key, fallback) => await database.getItem(`jhs_mobile_value:${key}`) ?? fallback,
    setValue: (key, value) => database.setItem(`jhs_mobile_value:${key}`, value),
    removeValue: key => database.removeItem(`jhs_mobile_value:${key}`),
  });
  const settings = new SettingsService(storage, { mutationCoordinator: coordinator });
  const state = new StateService(storage, { publishCommitted: (notices: { type: string; payload: { carNums?: string[] } }[]) => {
    for (const { type, payload } of notices) publishStorageEvent(events, type, payload);
  } }, coordinator, {
    now: () => new Date().toISOString(),
    currentUrl: () => 'https://javdb.com/',
    origin: () => 'https://javdb.com',
    incrementalCarStore: database,
  });
  const keywordRules = new KeywordRulesService({ storage, coordinator, state });
  const registry = new SettingsRegistry();
  registerDefaultSettings(registry);
  const validateSetting = (key: string, value: unknown) => registry.validateSync(key, value);
  const syncStore = sample ? undefined : new WebDavSyncStore({
    coordinator, storage, settings, validateSetting,
    events: { emit: (type: string, notice: Parameters<typeof publishStorageEvent>[2]) => publishStorageEvent(events, type, notice) },
    recoverState: () => state.recoverPendingTransactionWithoutLock(),
  });
  const backupService = new PortableBackupService({ storage, coordinator, state, sync: syncStore, settings });
  if (syncStore) {
    coordinator.observer = syncStore;
    coordinator.beforeMutation = syncStore.recoverBeforeMutation;
    storage.beforeWrite = key => syncStore.capture(key);
  }
  await coordinator.runExclusive(async () => {
    await assertSupportedDataVersion(storage);
    if (!(await storage.keys()).length) {
      const seed = sample ? { car_list: sampleLibrary(), favorite_actresses: sampleActors } : {};
      await storage.commitLockedBatch({ puts: { ...seed, data_version: CURRENT_DATA_VERSION } });
    }
    await runDataMigrations(storage, {
      updateSettings: mutator => settings.updateWithoutLock(mutator),
      recoverBeforeV4: () => state.recoverPendingTransactionWithoutLock(),
    });
    await keywordRules.getReviewKeywordsWithoutLock();
    await state.recoverPendingTransactionWithoutLock();
  });
  await settings.load();
  settings.addEventListener('settings.changed', event => events.emit({ domain: 'settings', keys: (event as CustomEvent<{ names: string[] }>).detail.names }));
  async function recent() {
    return (await database.getItem(recentKey) as Movie[] | null) ?? [];
  }

  return {
    database, storage, settings, state, coordinator, sample, events, keywordRules, backupService, syncStore, validateSetting,
    async toggle(movie: Movie, flag: MovieFlag) {
      if (!movie.carNum) throw new Error('作品番号尚未确认。');
      return state.toggle(movie.carNum, flag, { preserveNewVideo: true, record: movieRecord(movie) });
    },
    async mark(movies: Movie[], flag: MovieFlag, value: boolean) {
      const records = movies.filter(movie => movie.carNum && movie.stateEligibility?.eligible !== false).map(movieRecord);
      if (!records.length) return { transactionId: null, changed: [] };
      return state.patch(records.map(record => record.carNum!), { [flag]: value }, { preserveNewVideo: true, existingOnly: true, records });
    },
    async saveRemark(movie: Movie, remark: string) {
      if (!movie.carNum) throw new Error('作品番号尚未确认。');
      return state.patch(movie.carNum, {}, { record: { ...movieRecord(movie), remark }, replaceMetadata: true, preserveNewVideo: true });
    },
    async changeCollection(movies: Movie[], collection: string, selected: boolean) {
      const records = movies.map(movieRecord).filter(record => record.carNum && record.stateEligibility?.eligible !== false);
      return state.setCollectionMembership(records.map(record => record.carNum!), collection, selected, { records });
    },
    async removeWorks(movies: Movie[]) {
      return state.remove(movies.flatMap(movie => movie.carNum && movie.stateEligibility?.eligible !== false ? [movie.carNum] : []));
    },
    async actors() {
      const saved = await state.getFavoriteActressList() as { starId: string; name: string; avatar?: string; allName?: string[] }[];
      return saved.map(actor => ({ ...savedActorRef(actor.starId, actor.name, actor.avatar), names: actor.allName ?? [actor.name] }));
    },
    async favoriteActor(actor: ActorRef, selected: boolean) {
      if (selected) await state.addFavoriteActressList([{ starId: actorKey(actor), name: actor.name, avatar: actor.coverUrl }]);
      else await state.removeFavoriteActress(actorKey(actor));
      events.emit({ domain: 'follow' });
    },
    async saveActorProfile(profile: ActorProfile) {
      const result = await state.updateFavoriteActress({
        starId: actorKey(profile), name: profile.name, allName: profile.names, avatar: profile.coverUrl, actressType: profile.actressType,
      });
      if (!result) throw new Error('请先收藏该演员。');
      events.emit({ domain: 'follow' });
    },
    async visibility(): Promise<Rules> {
      const [blocked, actorWorks, blacklist, keywords] = await Promise.all([
        database.blockedNumbers(), state.getBlacklistCarList(), state.getBlacklist(), keywordRules.getTitleKeywords(),
      ]);
      const blockedActors = blacklist as { starId?: string; name?: string; allName?: string[] }[];
      const numbers = [...blocked.map(item => item.number), ...actorWorks.map(item => item.number ?? item.carNum)];
      return { numbers: new Set(numbers.map(normalizeMovieCarNum).filter(Boolean)),
        ids: new Set(blockedActors.flatMap(item => item.starId ? [String(item.starId)] : [])),
        names: new Set(blockedActors.flatMap(item => [item.name, ...(Array.isArray(item.allName) ? item.allName : [])]).filter((name): name is string => !!name)),
        keywords };
    },
    recent,
    async visit(movie: Movie) {
      await coordinator.runExclusive(async () => {
        const { id, source, carNum, title, url, coverUrl, actors, cast, releaseDate, rating, stateEligibility } = movie;
        const rest = (await recent()).filter(item => carNum ? item.carNum !== carNum : item.id !== id || item.source !== source);
        await database.setItem(recentKey, [{ id, source, carNum, title, url, coverUrl, actors, cast, releaseDate, rating, stateEligibility }, ...rest].slice(0, 16));
      });
      events.emit({ domain: 'recent' });
    },
    async queue() {
      const [actors, decisions] = await Promise.all([state.getFavoriteActressList(), state.getNewVideoDecisions()]);
      const numbers = actors.flatMap(actor => Array.isArray(actor.newVideoList)
        ? actor.newVideoList.map((item: string | { carNum: string }) => typeof item === 'string' ? item : item.carNum) : []);
      const movies = await state.getCarMap(numbers);
      return aggregateNewVideoRecords(actors, movies, decisions).map(row => ({
        movie: (sample ? sampleMovies.find(movie => movie.carNum === row.carNum) : undefined) ?? {
          id: row.carNum, source: /^https:\/\/(?:www\.)?javbus\.com\//.test(row.url) ? 'javbus' as const
            : row.carNum.startsWith('FC2') ? 'fc2' as const : 'javdb' as const, carNum: row.carNum, title: row.title || row.carNum,
          url: row.url || undefined, coverUrl: row.coverUrl || undefined, actors: row.actresses, releaseDate: row.publishTime,
        },
        actors: row.actresses, starIds: row.starIds, status: row.decisionState,
      }));
    },
    async decide(movie: Movie, decision: Decision) {
      if (!movie.carNum) throw new Error('作品番号尚未确认。');
      const until = decision === 'snoozed' ? new Date(Date.now() + 86_400_000).toISOString() : null;
      return state.setNewVideoDecision(movie.carNum, decision, until);
    },
    async backup() {
      return JSON.stringify(await backupService.exportPortableData(), null, 2);
    },
    async previewBackup(text: string) {
      const content = text.trim().replace(/^\uFEFF/, '');
      const incoming = JSON.parse(content.startsWith('{') ? content : await decryptPortableBackup(content));
      const { data } = normalizePortableData(incoming);
      return { incoming, movies: Array.isArray(data.car_list) ? data.car_list.length : undefined };
    },
    async restoreBackup(incoming: unknown) {
      await backupService.importData(incoming);
      events.emit({ domain: 'reset' });
    },
  };
}

export type Workspace = Awaited<ReturnType<typeof createWorkspace>> & { sync?: import('./syncAdapter.ts').SyncControls };
