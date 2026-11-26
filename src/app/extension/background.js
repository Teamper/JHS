// @ts-check
import { extensionFetch } from "../../platform/extension/network.js";
import { ExternalUrlPolicy } from "../../services/external-url-policy.js";
import { CHANNEL, pack, unpack, failure, checkMessage } from "../../contracts/extension-protocol.js";

const ports = new Set();
const requests = new Map();
/** @type {Promise<void>|null|undefined} */ let creating;
let running = false;
let pendingDomain = 0;
let requestedWakeAt = Infinity;
/** @type {ReturnType<typeof setTimeout>|null} */ let wakeTimer = null;
const rulesReady = chrome.declarativeNetRequest.getSessionRules().then(rules => chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: rules.map(rule => rule.id) }));

/** @param {number} delay */
async function scheduleWake(delay) {
    const when = Date.now() + Math.max(0, delay);
    if (when >= requestedWakeAt) return;
    requestedWakeAt = when;
    await chrome.storage.local.set({ syncWakeAt: when });
    await chrome.alarms.create("jhs-tasks", { when });
    if (wakeTimer !== null) clearTimeout(wakeTimer);
    if (delay < 30000) wakeTimer = setTimeout(() => { void runTasks(); }, Math.max(0, delay));
}

async function closeIdleDomain() {
    if (ports.size || running || pendingDomain || requests.size) return;
    if ((await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] })).length) await chrome.offscreen.closeDocument();
}

async function ensureDomain() {
    if ((await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] })).length) return;
    if (!creating) creating = chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["DOM_PARSER", "WORKERS", "LOCAL_STORAGE"], justification: "解析来源页面，运行共享业务服务和同步计算线程" }).finally(() => { creating = null; });
    await creating;
}

/** @param {any} message */
async function domain(message) {
    pendingDomain++;
    try {
        for (let attempt = 0; attempt < 6; attempt++) {
            await ensureDomain();
            try {
                return await chrome.runtime.sendMessage({ ...message, target: "domain" });
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                if (attempt === 5 || !/Receiving end does not exist|message port closed/i.test(msg)) throw error;
                await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
            }
        }
    } finally { pendingDomain--; }
}

/** @param {chrome.runtime.MessageSender|undefined} sender */
function trusted(sender) {
    if (!sender) return false;
    return sender.id === chrome.runtime.id && !!sender.url && (sender.url.startsWith(chrome.runtime.getURL("")) || /^https?:\/\//.test(sender.url));
}

/** @param {string} method @param {any[]} args @returns {Promise<any>} */
async function platform(method, args) {
    if (method === "values.all") return (await chrome.storage.local.get("values")).values || {};
    if (method === "values.set" || method === "values.remove") {
        await navigator.locks.request("jhs-extension-values", async () => {
            const values = await platform("values.all", []);
            if (method === "values.remove") delete values[args[0]];
            else values[args[0]] = args[1];
            await chrome.storage.local.set({ values });
        });
        publish({ type: "values", key: args[0], value: args[1], deleted: method === "values.remove" });
        return;
    }
    if (method === "navigation.open") {
        const url = new URL(args[0]);
        if (!["https:", "http:"].includes(url.protocol)) throw new Error("链接协议不受支持");
        await chrome.tabs.create({ url: url.href });
        return;
    }
    if (method === "tasks.wake") return scheduleWake(Number(args[0] ?? 30000));
    if (method === "permissions.request") {
        const url = new URL(args[0]);
        if (url.protocol !== "https:") throw new Error("自定义站点须使用 HTTPS");
        return chrome.permissions.request({ origins: [`${url.origin}/*`] });
    }
    if (method === "sites.register") {
        const url = new URL(args[0]);
        if (url.protocol !== "https:" || !await chrome.permissions.contains({ origins: [`${url.origin}/*`] })) throw new Error("来源尚未授权");
        const id = `jhs-${url.hostname.replace(/[^a-z0-9]/gi, "-")}`;
        const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
        if (!existing.length) await chrome.scripting.registerContentScripts([{ id, matches: [`${url.origin}/*`], js: ["vendors.js", "content.js"], css: ["vendor.css"], runAt: "document_idle", allFrames: true }]);
        return;
    }
    throw new Error("平台操作不受支持");
}

/** @param {any} notice */
function publish(notice) {
    for (const port of ports) port.postMessage(pack(notice));
}

/** @param {string} id @param {any} options */
async function requestHttp(id, options) {
    const controller = new AbortController();
    requests.set(id, controller);
    const timer = setTimeout(() => controller.abort(), options.timeout || 30000);
    const policy = new ExternalUrlPolicy({ localOrigins: options.urlPolicy?.trustClass === "user-local" ? [new URL(options.url).origin] : [] });
    try { return await extensionFetch(options, controller.signal, policy); }
    finally { clearTimeout(timer); requests.delete(id); }
}

async function runTasks() {
    if (running) return;
    running = true;
    requestedWakeAt = Infinity;
    if (wakeTimer !== null) clearTimeout(wakeTimer);
    wakeTimer = null;
    await chrome.storage.local.remove("syncWakeAt");
    const previous = /** @type {any} */ ((await chrome.storage.local.get("tasks")).tasks || {});
    const startedAt = Date.now();
    await chrome.storage.local.set({ tasks: { ...previous, state: "running", startedAt } });
    try {
        for (const method of ["sync.check", "tasks.scan", "tasks.offline"]) {
            const response = await domain({ channel: CHANNEL, id: crypto.randomUUID(), method, args: method === "sync.check" ? [{ scheduled: true }] : [] });
            if (!response.ok) throw Object.assign(new Error(response.error.message), response.error);
        }
        await chrome.storage.local.set({ tasks: { state: "idle", completedAt: Date.now(), retryAt: 0, failures: 0 } });
    } catch (error) {
        const failures = (previous.failures || 0) + 1;
        const retryAt = Date.now() + Math.min(30, 2 ** Math.min(failures - 1, 5)) * 60000;
        await chrome.storage.local.set({ tasks: { state: "error", error: error instanceof Error ? error.message : String(error), failures, retryAt } });
        await chrome.alarms.create("jhs-tasks", { when: retryAt });
    } finally {
        running = false;
        publish({ type: "tasks-changed" });
        const tasks = /** @type {any} */ ((await chrome.storage.local.get("tasks")).tasks);
        await chrome.alarms.create("jhs-tasks", { when: Math.min(requestedWakeAt, tasks?.retryAt || Date.now() + 60000) });
        await closeIdleDomain();
    }
}

chrome.runtime.onConnect.addListener(port => {
    if (port.name !== CHANNEL || !trusted(port.sender)) return;
    ports.add(port);
    port.onDisconnect.addListener(() => { ports.delete(port); void chrome.alarms.create("jhs-domain-cleanup", { when: Date.now() + 30000 }); });
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.channel !== CHANNEL || !trusted(sender) || message.target === "domain") return;
    if (message.target === "broadcast") { publish(unpack(message.notice)); return; }
    if (message.target === "cancel") { requests.get(message.id)?.abort(); return; }
    const execute = async () => {
        await rulesReady;
        checkMessage(message);
        const args = unpack(message.args);
        if (message.method === "http.request") return requestHttp(message.id, args[0]);
        if (message.method === "tasks.status") return (await chrome.storage.local.get("tasks")).tasks || { state: "idle" };
        if (message.method === "page.ready") { publish({ type: "page-ready", tabId: sender.tab?.id }); return; }
        if (message.method === "tasks.run") { void runTasks(); return { state: "scheduled" }; }
        if (message.target === "platform" || /^(navigation\.|permissions\.|sites\.)/.test(message.method)) return platform(message.method, args);
        const response = await domain(message);
        if (!response.ok) throw Object.assign(new Error(response.error.message), response.error);
        return unpack(response.value);
    };
    execute().then(value => respond({ ok: true, value: pack(value) }), error => respond(failure(error)));
    return true;
});
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === "jhs-tasks") void runTasks(); if (alarm.name === "jhs-domain-cleanup") void closeIdleDomain(); });
async function initialize() {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    if (!await chrome.alarms.get("jhs-tasks")) await chrome.alarms.create("jhs-tasks", { periodInMinutes: 1 });
    const stored = /** @type {number|undefined} */ ((await chrome.storage.local.get("syncWakeAt")).syncWakeAt);
    if (stored) await scheduleWake(Math.max(0, stored - Date.now()));
}
chrome.runtime.onInstalled.addListener(() => { void initialize(); });
chrome.runtime.onStartup.addListener(() => { void initialize(); void runTasks(); });
void initialize();
