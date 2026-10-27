// @ts-check

import { getPortableDataKeys, hasPortableUserData, mergePortableSettings, runDataMigrations } from "./migration.js";
import { SyncPendingLedger, SYNC_PENDING_KEY } from "./sync-pending-ledger.js";
import { SYNC_DOMAINS } from "./webdav-sync-model.js";

const SYNC_STATE_KEY = "jhs_webdav_sync_state_v1";
/** @param {any} value */
const clone = value => structuredClone(value);

/** Run the existing migration/snapshot code against owned memory, never live services. @param {any} storage @param {Record<string, any>} expected */
function createDraft(storage, expected) {
    const values = new Map(Object.entries(expected).filter(([, entry]) => entry.exists).map(([key, entry]) => [key, clone(entry.value)]));
    /** @type {Set<string>} */ const touched = new Set();
    const draft = Object.create(Object.getPrototypeOf(storage));
    for (const key of Object.keys(storage)) if (key.endsWith("_key")) draft[key] = storage[key];
    const write = async (/** @type {string} */ key, /** @type {any} */ value) => { values.set(key, clone(value)); touched.add(key); };
    draft.forage = {
        getItem: async (/** @type {string} */ key) => values.has(key) ? clone(values.get(key)) : null,
        setItem: write,
        removeItem: async (/** @type {string} */ key) => { values.delete(key); touched.add(key); },
        keys: async () => [...values.keys()],
    };
    draft._invalidateCache = () => {};
    draft._setItemAndInvalidate = write;
    for (const [method, key] of Object.entries({ getCarList: "car_list", getBlacklist: "blacklist", getBlacklistCarList: "blacklist_car_list", getFavoriteActressList: "favorite_actresses" })) {
        draft[method] = async () => await draft.forage.getItem(key) || [];
    }
    draft.getDataVersion = async () => await draft.forage.getItem("data_version") || 0;
    draft.setDataVersion = (/** @type {number} */ version) => write("data_version", version);
    draft.updateSettingWithoutLock = async (/** @type {(settings: any) => void} */ update) => {
        const settings = await draft.forage.getItem("setting") || {};
        update(settings); await write("setting", settings);
    };
    return { draft, values, touched };
}

/** Prepare every business and synchronization write before opening the commit transaction. @param {any} storage @param {any} atomic @param {any} imported @param {any[]} warnings @param {number} version */
export async function prepareAtomicImport(storage, atomic, imported, warnings, version) {
    const keys = [...getPortableDataKeys(0), "data_version", "data_health_warnings", "snapshots", SYNC_PENDING_KEY, SYNC_STATE_KEY];
    // V3 removes the old HTTP cache namespace as part of the same batch.
    if (version < 3) keys.push(...(await storage.forage.keys()).filter((/** @type {string} */ key) => key.startsWith("jhs_http_public_cache:v1:")));
    const expected = await atomic.readAtomicSnapshot([...new Set(keys)]);
    const { draft, values, touched } = createDraft(storage, expected);
    if (await hasPortableUserData(draft)) await draft._createSnapshotWithoutMutation("导入前自动备份", "auto-import");
    await runDataMigrations(draft, null, true);
    if (Object.hasOwn(imported, "setting")) imported.setting = mergePortableSettings(await draft.forage.getItem("setting") || {}, imported.setting);
    for (const [key, value] of Object.entries(imported)) await draft._setItemAndInvalidate(key, value);
    if (warnings.length) await draft.forage.setItem("data_health_warnings", [...(await draft.forage.getItem("data_health_warnings") || []), ...warnings]);
    const changed = [...touched].filter(key => !expected[key]?.exists || !values.has(key) || JSON.stringify(expected[key].value) !== JSON.stringify(values.get(key)));
    const domains = changed.filter(key => SYNC_DOMAINS.includes(key));
    if (domains.length || Object.hasOwn(imported, "activity_log")) {
        const ledger = new SyncPendingLedger(draft.forage);
        for (const key of domains) await ledger.capture(key, undefined);
        if (Object.hasOwn(imported, "activity_log")) {
            const pending = await ledger.read();
            pending.epoch = crypto.randomUUID(); pending.localUndoIds = [];
            const state = await draft.forage.getItem(SYNC_STATE_KEY);
            if (state) {
                state.undoEligible = []; state.undoEpoch = pending.epoch;
                if (!Number.isSafeInteger(++pending.metadataRevision)) throw new Error("同步元数据版本已超出安全范围");
                await draft.forage.setItem(SYNC_STATE_KEY, state);
            }
            await ledger.write(pending);
        }
    }
    /** @type {Record<string, any>} */ const puts = {};
    const deletes = [];
    for (const key of touched) { if (values.has(key)) puts[key] = values.get(key); else deletes.push(key); }
    return { expected, puts, deletes, domains };
}
