// @ts-check
import { getNowStr } from "../../core/ui-date-time.js";
import "./vendors.js";
import { bootstrapJhs } from "../../app/bootstrap.js";
import { CHANNEL, EXTENSION_STATE_METHODS, pack, unpack, failure, checkMessage, unwrapResponse } from "../../contracts/extension-protocol.js";
import { JhsEventBus } from "../../core/event-bus.js";
import { NewVideoScanController } from "../../features/discovery/new-video-scan-controller.js";
import { ActorSourceHealth } from "../../features/discovery/actor-source-health.js";
import { TaskExecutionService } from "../../features/discovery/task-execution-service.js";
import { PORT } from "../../contracts/tokens.js";
import { ExtensionHttpAdapter } from "../../platform/extension/http-adapter.js";
import { UserscriptHttpAdapter } from "../../platform/userscript/userscript-http-adapter.js";
import { OfflineTaskQueryService } from "../../services/offline-task-query-service.js";
import { LibraryStatsService } from "../../services/library-stats-service.js";
import { parseDisabledPlugins, migrateDisabledPlugins } from "../../core/legacy-plugin-contributions.js";

/** @param {any} notice */
const broadcast = notice => chrome.runtime.sendMessage({ channel: CHANNEL, target: "broadcast", notice: pack(notice) });
/** @param {string} method @param {any[]} [args] @param {AbortSignal} [signal] @returns {Promise<any>} */
const platformCall = async (method, args = [], signal) => {
    const id = crypto.randomUUID();
    const cancel = () => { void chrome.runtime.sendMessage({ channel: CHANNEL, target: "cancel", id, method: "cancel", args: [] }); };
    signal?.addEventListener("abort", cancel, { once: true });
    let response;
    try { response = await chrome.runtime.sendMessage({ channel: CHANNEL, target: "platform", id, method, args: pack(args) }); }
    finally { signal?.removeEventListener("abort", cancel); }
    return unwrapResponse(response);
};

async function initialize() {
    const values = new Map(Object.entries(await platformCall("values.all")));
    /** @type {Record<string, (...args: any[]) => any>} */
    const gm = {
        GM_getValue: (key, fallback) => values.has(key) ? values.get(key) : fallback,
        GM_setValue: async (key, value) => { await platformCall("values.set", [key, value]); values.set(key, value); },
        GM_deleteValue: async key => { await platformCall("values.remove", [key]); values.delete(key); },
        GM_listValues: () => [...values.keys()],
        GM_addValueChangeListener: () => null, GM_removeValueChangeListener() {},
        GM_openInTab: url => platformCall("navigation.open", [url]),
        GM_xmlhttpRequest: options => {
            const controller = new AbortController();
            const id = crypto.randomUUID();
            chrome.runtime.sendMessage({ channel: CHANNEL, target: "network", id, method: "http.request", args: pack([options]) })
                .then(response => response.ok ? options.onload(unpack(response.value)) : options.onerror(response.error));
            return { abort: () => { controller.abort(); void chrome.runtime.sendMessage({ channel: CHANNEL, target: "cancel", id, method: "cancel", args: [] }); } };
        },
    };
    Object.assign(globalThis, gm, { unsafeWindow: window });
    const events = new JhsEventBus("jhs-extension-domain");
    events.channel.postMessage = event => { void broadcast(event); };
    const context = await bootstrapJhs({ headless: true, location: new URL("https://javdb.com"), bundledStyles: true, eventBus: events, platform: {
        http: new ExtensionHttpAdapter({ call: platformCall }, new UserscriptHttpAdapter(gm.GM_xmlhttpRequest), false),
        backgroundWork: { waitForTurn: () => Promise.resolve(), expedite() {}, markReady() {}, dispose() {} },
        createWorker: () => new Worker("sync-worker.js"),
    } });
    if (!context) throw new Error("扩展运行时启动失败");
    await context.services.webdavSync.initialize();
    // Alarm scheduling is owned by the service worker, including after offscreen recreation.
    context.services.webdavSync.schedule = (/** @type {number} */ delay) => { void platformCall("tasks.wake", [delay]); };
    context.services.webdavSync.start(context.rootScope, document);
    context.services.webdavSync.addEventListener("status", () => { void broadcast({ type: "sync-status" }); });
    const scan = new NewVideoScanController({
        state: context.services.state, actressInfo: context.services.actressInfo, readTitleKeywords: () => context.services.keywordRules.getTitleKeywords(),
        sourceHealth: new ActorSourceHealth(context.services.storage), scope: context.rootScope, allowHidden: true,
        events, window,
        logger: context.feedback.clog, getTimestamp: getNowStr, onNewItems() {},
    });
    const taskWindow = new Proxy(/** @type {any} */ (window), { get(target, key) { if (key === "location") return new URL("https://javdb.com"); if (key === "isListPage") return true; const value = target[key]; return typeof value === "function" ? value.bind(target) : value; } });
    const tasks = new TaskExecutionService({
        runtimeServices: { ...context.services, events, scope: () => context.rootScope, runWithoutPage: true, hostAdapters: { javdb: context.container.resolveDeclared([PORT.javdbHost])[PORT.javdbHost], javbus: context.container.resolveDeclared([PORT.javbusHost])[PORT.javbusHost] } },
        getNewVideoScanner: () => scan,
        logger: context.feedback.clog, jquery: context.services.domUi.jquery, window: taskWindow, notifications: context.services.notifications,
    });
    const offlineTasks = new OfflineTaskQueryService({ offline: context.services.offline, settings: context.services.settings, storage: context.services.storage, token: () => context.services.pan123Credential.getStoredToken() });
    return { context, tasks, offlineTasks, values, gm };
}

const ready = initialize();
/** @param {any} object */
const methodNames = object => new Set(Object.getOwnPropertyNames(Object.getPrototypeOf(object)).filter(name => name !== "constructor" && !name.startsWith("_") && typeof object[name] === "function"));

/** @param {string} method @param {any[]} args */
export async function dispatchDomain(method, args) {
    const { context, tasks, offlineTasks, values, gm } = await ready;
    const { services } = context;
    const taskSnapshot = () => ({ config: tasks.taskConfig, states: Object.fromEntries(/** @type {Array<"blacklist"|"favoriteActress"|"newVideo">} */ (["blacklist", "favoriteActress", "newVideo"]).map(name => [name, tasks.getTaskStatusSnapshot(name)])) });
    if (method === "runtime.snapshot") return { settings: services.settings.snapshot(), values: Object.fromEntries(values), tasks: taskSnapshot() };
    if (method === "stats.snapshot") {
        const libraryStats = new LibraryStatsService({ state: services.state });
        const [snapshot, pendingNewVideos] = await Promise.all([libraryStats.loadSnapshot(), libraryStats.getPendingNewVideoTotal()]);
        return { ...snapshot, pendingNewVideos };
    }
    if (method === "scan.snapshot") return taskSnapshot();
    if (method === "settings.read") return services.settings.refresh();
    if (method === "settings.readStoredSnapshot") return services.settings.readStoredSnapshot();
    if (method === "cache.clearThirdPartyCache") return services.cache.clearThirdPartyCache();
    if (method === "cache.deleteThirdPartyCacheEntry") return services.cache.deleteThirdPartyCacheEntry(args[0]);
    if (method === "tasks.offline") return offlineTasks.refresh(Boolean(args[0]));
    if (method === "tasks.offlineStatus") return offlineTasks.read();
    if (method === "values.set" || method === "values.remove") {
        if (method === "values.set") await gm.GM_setValue(...args);
        else await gm.GM_deleteValue(...args);
        await services.credential.notifyChanged(args[0]);
        return;
    }
    if (method === "settings.commit") return services.settings.update((/** @type {Record<string, any>} */ draft) => {
        for (const [key, change] of Object.entries(args[0])) {
            if (JSON.stringify(draft[key]) !== JSON.stringify(change.before)) throw Object.assign(new Error("设置已被其他页面修改，请重新保存"), { code: "CONFIG_CONFLICT" });
            if (change.exists) draft[key] = change.value;
            else delete draft[key];
        }
    });
    if (method === "tasks.scan") {
        const disabled = migrateDisabledPlugins(parseDisabledPlugins(services.settings.snapshot().disabledPlugins));
        if (disabled.includes("scheduler") || disabled.includes("discovery.scheduler")) return { skipped: true };
        await tasks.invalidateConfig(true);
        await tasks.doTask();
        return { completed: true };
    }
    const [owner, name] = method.split(".");
    if (owner === "backup") {
        const backup = services.backup;
        switch (name) {
            case "exportData": return backup.exportData();
            case "importData": return backup.importData(args[0]);
            case "createSnapshot": return backup.createSnapshot(...args);
            case "getSnapshotList": return backup.getSnapshotList();
            case "getSnapshot": return backup.getSnapshot(args[0]);
            case "deleteSnapshot": return backup.deleteSnapshot(args[0]);
            case "restoreSnapshot": return backup.restoreSnapshot(args[0]);
            case "inspectDataHealth": return backup.inspectDataHealth();
            case "repairDataHealth": return backup.repairDataHealth();
            default: throw new Error("备份操作不受支持");
        }
    }
    if (owner === "keywords") {
        const rules = services.keywordRules;
        switch (name) {
            case "getTitleKeywords": return rules.getTitleKeywords();
            case "getReviewKeywords": return rules.getReviewKeywords();
            case "saveTitleKeywords": return rules.saveTitleKeywords(args[0]);
            case "saveReviewKeywords": return rules.saveReviewKeywords(args[0]);
            case "addReviewKeyword": return rules.addReviewKeyword(args[0]);
            default: throw new Error("关键词操作不受支持");
        }
    }
    if (owner === "scan") {
        if (!["checkBlacklist", "checkFavoriteActress", "checkNewVideo", "checkOneNewVideo", "invalidateConfig", "triggerProfileBackfill"].includes(name)) throw new Error("扫描操作不受支持");
        if (name !== "invalidateConfig") await tasks.invalidateConfig();
        return /** @type {any} */ (tasks)[name](...args);
    }
    if (owner === "storage") {
        switch (name) {
            case "get": return services.storage.get(args[0]);
            case "set": return services.storage.set(args[0], args[1]);
            case "remove": return services.storage.remove(args[0]);
            case "keys": return services.storage.keys();
            default: throw new Error("存储操作不受支持");
        }
    }
    if (owner === "state") {
        if (!EXTENSION_STATE_METHODS.includes(name)) throw new Error("状态操作不受支持");
        return services.state[name](...args);
    }
    /** @type {Record<string, any>} */ const objects = { credential: services.credential, sync: services.webdavSync, receipts: services.offlineSubmissionReceipts };
    const object = objects[owner];
    if (!object || !methodNames(object).has(name)) throw new Error(`扩展操作不受支持 ${method}`);
    if (name.endsWith("WithoutLock")) throw new Error("该操作须通过业务事务执行");
    if (owner === "sync" && name === "restore") args[2] = context.rootScope;
    if (owner === "sync" && name === "listRecoveryFiles") args[0] = context.rootScope;
    return object[name](...args);
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.channel !== CHANNEL || message.target !== "domain" || sender.id !== chrome.runtime.id) return;
    Promise.resolve().then(() => { checkMessage(message); return dispatchDomain(message.method, unpack(message.args)); })
        .then(value => respond({ ok: true, value: pack(value) }), error => respond(failure(error)));
    return true;
});
