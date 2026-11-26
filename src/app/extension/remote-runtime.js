// @ts-check
import { createLegacyRuntime } from "../../core/legacy-runtime.js";
import { JhsEventBus } from "../../core/event-bus.js";
import { RemoteSettings } from "../../services/extension-settings-service.js";
import { ExtensionHttpAdapter } from "../../platform/extension/http-adapter.js";
import { UserscriptHttpAdapter } from "../../platform/userscript/userscript-http-adapter.js";

/** @param {import("../../platform/extension/client.js").ExtensionClient} client */
export async function createRemoteRuntime(client) {
    const eventBus = new JhsEventBus("jhs-extension-page");
    // Extension messaging carries events across host origins. BroadcastChannel stays local.
    eventBus.channel.close();
    eventBus.channel.postMessage = () => {};
    const boot = await client.call("runtime.snapshot");
    let taskSnapshot = boot.tasks;
    const taskExecution = {
        taskConfig: taskSnapshot.config,
        getTaskStatusSnapshot: (/** @type {string} */ name) => taskSnapshot.states[name],
    };
    const refreshTasks = async () => { taskSnapshot = await client.call("scan.snapshot"); taskExecution.taskConfig = taskSnapshot.config; };
    for (const method of ["checkBlacklist", "checkFavoriteActress", "checkNewVideo", "checkOneNewVideo", "invalidateConfig"]) {
        /** @type {any} */ (taskExecution)[method] = async (/** @type {any} */ argument) => {
            const result = await client.call(`scan.${method}`, [argument]);
            await refreshTasks();
            return result;
        };
    }
    const values = new Map(Object.entries(boot.values));
    /** @type {Record<string, (...args: any[]) => any>} */
    const gm = {
        GM_getValue: (key, fallback) => values.has(key) ? values.get(key) : fallback,
        GM_setValue: (key, value) => client.call("values.set", [key, value]).then(() => values.set(key, value)),
        GM_deleteValue: key => client.call("values.remove", [key]).then(() => values.delete(key)),
        GM_listValues: () => [...values.keys()],
        GM_addValueChangeListener: () => null, GM_removeValueChangeListener() {},
        GM_openInTab: url => { void client.call("navigation.open", [url]); },
        GM_xmlhttpRequest: options => {
            const controller = new AbortController();
            client.call("http.request", [options], controller.signal).then(options.onload, error => error.name === "AbortError" ? options.onabort?.(error) : options.onerror?.(error));
            return { abort: () => controller.abort() };
        },
    };
    Object.assign(globalThis, gm, { unsafeWindow: window });
    const forage = Object.fromEntries(["getItem", "setItem", "removeItem", "keys"].map(name => [name, /** @param {...any} args */ (...args) => client.call(`forage.${name}`, args)]));
    const local = createLegacyRuntime(eventBus, { forage });
    const localMethods = new Set(["_invalidateCache", "invalidateSettingCache", "getCacheHitStats", "diffData", "_diffArrays", "_diffObjects", "_stableStringify", "_getArrayKey", "_groupDuplicateItems", "_dedupeByKey"]);
    const storageManager = new Proxy(local.storageManager, { get(target, key) {
        if (typeof key !== "string") return Reflect.get(target, key);
        const value = target[key];
        if (typeof value !== "function") return value;
        if (key === "importDataWithGuard") return async (/** @type {any} */ data, /** @type {any} */ options = {}) => {
            await options.assertActive?.();
            const prepared = options.prepareData ? await options.prepareData() : data;
            await options.assertActive?.();
            return client.call("legacy.importData", [prepared]);
        };
        return localMethods.has(key) ? value.bind(target) : /** @param {...any} args */ (...args) => client.call(`legacy.${key}`, args);
    } });
    const stateService = new Proxy(local.stateService, { get(target, key) {
        const value = target[key];
        if (key === "getCommittedListSnapshot") return () => null;
        if (typeof value !== "function") return value;
        return /** @param {...any} args */ (...args) => {
            if (["patch", "toggle"].includes(String(key))) args[2] = { ...args[2], metadata: { url: location.href, ...args[2]?.metadata } };
            return client.call(`state.${String(key)}`, args);
        };
    } });
    const settings = new RemoteSettings(client);
    settings.accept(boot.settings);
    const credential = new Proxy(/** @type {any} */ (new EventTarget()), { get(target, key) {
        if (typeof key !== "string") return Reflect.get(target, key);
        if (["addEventListener", "removeEventListener", "dispatchEvent"].includes(key)) return target[key].bind(target);
        if (key === "dispose") return () => {};
        return /** @param {...any} args */ (...args) => client.call(`credential.${key}`, args);
    } });
    const webdavSync = new Proxy(/** @type {any} */ (new EventTarget()), { get(target, key) {
        if (typeof key !== "string") return Reflect.get(target, key);
        if (["addEventListener", "removeEventListener", "dispatchEvent"].includes(key)) return target[key].bind(target);
        if (["start", "cancel", "dispose", "schedule", "initialize"].includes(key)) return () => {};
        return /** @param {...any} args */ (...args) => client.call(`sync.${key}`, args);
    } });
    const syncState = { dispose() {}, requestReconciliation() {}, begin() {}, finish() {}, capture() {}, recoverBeforeMutation() {}, enabled: false };
    /** @type {Record<string, (...args: any[]) => any>} */ const storage = {
        get: key => client.call("storage.get", [key]), set: (key, value) => client.call("storage.set", [key, value]),
        remove: key => client.call("storage.remove", [key]), keys: () => forage.keys(),
        getLocal: key => localStorage.getItem(key), setLocal: (key, value) => localStorage.setItem(key, value), removeLocal: key => localStorage.removeItem(key),
        getValue: gm.GM_getValue, setValue: gm.GM_setValue, removeValue: gm.GM_deleteValue,
        listValues: gm.GM_listValues,
    };
    client.addEventListener("event", async event => {
        const notice = /** @type {CustomEvent} */ (event).detail;
        if (notice.type === "values") {
            notice.deleted ? values.delete(notice.key) : values.set(notice.key, notice.value);
            credential.dispatchEvent(new CustomEvent("credentials.changed", { detail: { key: notice.key, revision: notice.value?.id ?? null } }));
            return;
        }
        if (notice.type === "settings-changed") void settings.refresh();
        if (notice.type === "sync-status") { webdavSync.dispatchEvent(new Event("status")); return; }
        if (notice.type === "task-status-changed") await refreshTasks();
        await eventBus._receive({ ...notice, originId: "extension-domain" });
    });
    const receipts = Object.fromEntries(["getRaw", "read", "prune", "write", "restore"].map(method => [method, /** @param {...any} args */ (...args) => client.call(`receipts.${method}`, args)]));
    return { eventBus, legacyRuntime: { ...local, storageManager, stateService }, platform: {
        http: new ExtensionHttpAdapter(client, new UserscriptHttpAdapter(gm.GM_xmlhttpRequest)),
        storage, settings, credential, webdavSync, syncState, receipts, taskExecution,
        createWorker: () => new Worker(chrome.runtime.getURL("sync-worker.js")),
    }, remote: true, bundledStyles: true };
}
