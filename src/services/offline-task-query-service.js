// @ts-check
import { waitForSettlement } from "../core/async-settlement.js";
import { parseBooleanSetting } from "../core/feature-helpers.js";
import { LifecycleScope } from "../core/lifecycle-scope.js";

const KEY = "jhs_extension_offline_tasks_v1";
export class OfflineTaskQueryService {
    /** @param {{offline: any, storage: any, settings: any, token: () => Promise<string>, clock?: () => number}} dependencies */
    constructor(dependencies) {
        this.deps = dependencies;
        this.clock = dependencies.clock ?? Date.now;
        /** @type {Promise<any>|null} */ this.running = null;
        /** @type {LifecycleScope|null} */ this.query = null;
    }
    async read() { return await this.deps.storage.get(KEY) || {}; }
    /** @param {string} providerId */
    async resetProvider(providerId) {
        this.query?.dispose();
        const previous = this.running;
        this.running = (async () => {
            await waitForSettlement(previous);
            const state = { ...await this.read() };
            delete state[providerId];
            await this.deps.storage.set(KEY, state);
            return state;
        })();
        const reset = this.running;
        try { await reset; }
        finally { if (this.running === reset) this.running = null; }
    }
    /** @param {boolean} [force] @param {AbortSignal} [signal] */
    refresh(force = false, signal) {
        if (this.running) return this.running;
        const query = this.query = new LifecycleScope("offline-task-query");
        const cancel = () => query.dispose();
        if (signal?.aborted) cancel();
        signal?.addEventListener("abort", cancel, { once: true });
        const refresh = this.execute(force, query).finally(() => {
            signal?.removeEventListener("abort", cancel);
            query.dispose();
            if (this.query === query) this.query = null;
            if (this.running === refresh) this.running = null;
        });
        this.running = refresh;
        return refresh;
    }
    /** @param {boolean} force @param {LifecycleScope} query */
    async execute(force, query) {
        const state = { ...await this.read() };
        const settings = this.deps.settings.snapshot();
        const token = await this.deps.token();
        /** @type {Array<[string, boolean]>} */
        const providers = [["pan123", parseBooleanSetting(settings.enable123Offline, true)], ["one115", parseBooleanSetting(settings.enable115Offline, false)]];
        for (const [id, enabled] of providers) {
            query.assertActive();
            const previous = state[id] || {};
            if (!enabled || id === "pan123" && !token) {
                state[id] = { enabled, needsLogin: enabled, items: [], reason: enabled ? "请登录 123 云盘" : "服务已关闭" };
                continue;
            }
            if (!force && previous.nextPollAt > this.clock()) continue;
            try {
                const page = await this.deps.offline.listTasks(id, { token, page: 1, scope: query });
                state[id] = { ...page, enabled: true, checkedAt: this.clock(), nextPollAt: this.clock() + (page.items.length ? 60000 : 300000), failures: 0 };
            } catch (error) {
                query.assertActive();
                const failures = (previous.failures || 0) + 1;
                const expired = /** @type {{code?: string}|null} */ (error)?.code === "AUTH_REQUIRED";
                const retained = expired ? { items: [], total: 0, needsLogin: true } : previous;
                state[id] = { ...retained, items: retained.items || [], total: retained.total || 0, enabled: true,
                    reason: expired ? "授权已失效，请重新登录" : error instanceof Error ? error.message : String(error),
                    failures, nextPollAt: this.clock() + Math.min(30, 2 ** Math.min(failures - 1, 5)) * 60000 };
            }
        }
        query.assertActive();
        await this.deps.storage.set(KEY, state);
        return state;
    }
}
