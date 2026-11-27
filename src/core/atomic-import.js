// @ts-check

import { PORTABLE_DATA_KEYS, getPortableDataKeys, hasPortableUserData, mergePortableSettings, runDataMigrations } from "./migration.js";
import { ACTRESS_PROFILE_BACKFILL_KEY, createActressProfileBackfillState, hasFutureActressProfileBackfillSchema } from "./actress-profile-backfill-state.js";
import { SNAPSHOTS_KEY, createPortableSnapshot } from "./portable-snapshots.js";
import { SyncPendingLedger, SYNC_PENDING_KEY } from "./sync-pending-ledger.js";
import { SYNC_DOMAINS } from "./webdav-sync-model.js";

const SYNC_STATE_KEY = "jhs_webdav_sync_state_v1";
/** @param {any} value */
const clone = value => structuredClone(value);

/** Run migrations on isolated values. @param {Record<string, any>} expected */
function createDraft(expected) {
    const values = new Map(Object.entries(expected).filter(([, entry]) => entry.exists).map(([key, entry]) => [key, clone(entry.value)]));
    /** @type {Set<string>} */ const touched = new Set();
    const write = async (/** @type {string} */ key, /** @type {any} */ value) => { values.set(key, clone(value)); touched.add(key); };
    const store = {
        get: async (/** @type {string} */ key) => values.has(key) ? clone(values.get(key)) : null,
        set: write,
        remove: async (/** @type {string} */ key) => { values.delete(key); touched.add(key); },
        keys: async () => [...values.keys()],
    };
    return { store, values, touched };
}

/** Prepare every business and synchronization write before opening the commit transaction. @param {import("../services/storage-service.js").StorageService} storage @param {any} imported @param {any[]} warnings @param {number} version @param {boolean} resetActressProfileBackfill */
export async function prepareAtomicImport(storage, imported, warnings, version, resetActressProfileBackfill, snapshotSource = "auto-import") {
    const keys = [...PORTABLE_DATA_KEYS, ...getPortableDataKeys(0), "data_version", "data_health_warnings", SNAPSHOTS_KEY, SYNC_PENDING_KEY, SYNC_STATE_KEY];
    if (resetActressProfileBackfill) keys.push(ACTRESS_PROFILE_BACKFILL_KEY);
    // V3 removes the old HTTP cache namespace as part of the same batch.
    if (version < 3) keys.push(...(await storage.keys()).filter((/** @type {string} */ key) => key.startsWith("jhs_http_public_cache:v1:")));
    const expected = await storage.readAtomicSnapshot([...new Set(keys)]);
    const { store, values, touched } = createDraft(expected);
    if (await hasPortableUserData(store)) await createPortableSnapshot(store, snapshotSource === "auto-restore" ? "恢复前自动备份" : "导入前自动备份", snapshotSource);
    await runDataMigrations(store);
    if (Object.hasOwn(imported, "setting")) imported.setting = mergePortableSettings(await store.get("setting") || {}, imported.setting);
    for (const [key, value] of Object.entries(imported)) await store.set(key, value);
    if (resetActressProfileBackfill && !hasFutureActressProfileBackfillSchema(expected[ACTRESS_PROFILE_BACKFILL_KEY]?.value)) {
        await store.set(ACTRESS_PROFILE_BACKFILL_KEY, createActressProfileBackfillState(crypto.randomUUID()));
    }
    if (warnings.length) await store.set("data_health_warnings", [...(await store.get("data_health_warnings") || []), ...warnings]);
    const changed = [...touched].filter(key => !expected[key]?.exists || !values.has(key) || JSON.stringify(expected[key].value) !== JSON.stringify(values.get(key)));
    const domains = changed.filter(key => SYNC_DOMAINS.includes(key));
    if (domains.length || Object.hasOwn(imported, "activity_log")) {
        const ledger = new SyncPendingLedger(store);
        for (const key of domains) await ledger.capture(key, undefined);
        if (Object.hasOwn(imported, "activity_log")) {
            const pending = await ledger.read();
            pending.epoch = crypto.randomUUID(); pending.localUndoIds = [];
            const state = await store.get(SYNC_STATE_KEY);
            if (state) {
                state.undoEligible = []; state.undoEpoch = pending.epoch;
                if (!Number.isSafeInteger(++pending.metadataRevision)) throw new Error("同步元数据版本已超出安全范围");
                await store.set(SYNC_STATE_KEY, state);
            }
            await ledger.write(pending);
        }
    }
    /** @type {Record<string, any>} */ const puts = {};
    const deletes = [];
    for (const key of touched) { if (values.has(key)) puts[key] = values.get(key); else deletes.push(key); }
    return { expected, puts, deletes, domains };
}
