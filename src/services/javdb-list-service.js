// @ts-check
import { LifecycleScope } from "../core/lifecycle-scope.js";
import { normalizeCarNum, assertMovieStateEligible } from "../core/movie-identity.js";
import { detectSite } from "../core/site-context.js";

const PREFIX = "jhs_javdb_list_task_v1:";
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const PAIR_STATES = ["checking", "submitting", "success", "failed", "unknown"];

/** @param {string} code @param {string} message */
const failure = (code, message) => Object.assign(new Error(message), { code });
/** @param {unknown} error */
function accountChanged(error) { return /** @type {any} */ (error)?.code === "LIST_ACCOUNT_CHANGED"; }
/** @param {string} text */
async function fingerprint(text) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join("");
}

/** Persist each pair separately so a large task never rewrites every result per request. */
export class JavDbListService extends EventTarget {
    /** @param {{integrations: any, storage: any, context: () => any, locks?: any}} options */
    constructor(options) {
        super();
        this.integrations = options.integrations;
        this.storage = options.storage;
        this.context = options.context;
        this.locks = options.locks === undefined ? globalThis.navigator?.locks : options.locks;
        /** @type {Map<string, any>} */ this.runs = new Map();
        this.disposed = false;
    }
    adapter() { return this.integrations.getAdapter("javdb"); }
    currentContext() {
        const context = this.context();
        if (!context?.origin || !context.accountUrl) throw failure("LIST_READ_ONLY", "请在 JavDB 网页中核对账号后管理清单");
        const origin = new URL(context.origin), account = new URL(context.accountUrl);
        if (origin.protocol !== "https:" || !detectSite(origin).isJavDB || account.origin !== origin.origin || account.username || account.password) throw failure("LIST_READ_ONLY", "网页账号来源无法核对，清单保持只读");
        account.search = "";
        account.hash = "";
        return { origin: origin.origin, accountUrl: account.href };
    }
    /** @param {any} context @param {any} [scope] */
    async readAccount(context, scope) {
        const current = this.currentContext();
        if (current.origin !== context.origin) throw failure("LIST_ACCOUNT_CHANGED", "站点来源已变化，任务已暂停");
        const account = await this.adapter().readWebAccount(context.origin, context.accountUrl, { scope });
        if (!account?.identity || !account.csrf) return null;
        return { fingerprint: await fingerprint(`${context.origin}\u0000${account.identity}`), label: account.label, csrf: account.csrf };
    }
    /** Fresh webpage evidence is required for every mutation and verification. @param {any} task @param {any} scope */
    async assertAccount(task, scope) {
        const account = await this.readAccount(task, scope);
        if (!account || account.fingerprint !== task.accountFingerprint) throw failure("LIST_ACCOUNT_CHANGED", "网页账号已变化或无法核对，任务已暂停");
        return account;
    }
    /** @param {any} [scope] */
    async access(scope) {
        const context = this.currentContext(), account = await this.readAccount(context, scope);
        return { ...context, account: account ? { fingerprint: account.fingerprint, label: account.label } : null,
            writable: !!account && typeof this.locks?.request === "function",
            reason: !account ? "未取得可靠网页账号标识，清单保持只读" : !this.locks?.request ? "当前环境不支持跨标签互斥，清单保持只读" : "" };
    }
    /** @param {any} context @param {string | null} videoId @param {any} [scope] */
    async directory(context, videoId, scope) {
        const lists = new Map(), visited = new Set();
        const first = new URL("/users/simple_lists", context.origin);
        if (videoId) first.searchParams.set("vid", videoId);
        let url = first.href;
        do {
            scope?.assertActive();
            if (visited.has(url) || visited.size >= 100) throw new Error("清单目录分页不完整，已停止操作");
            visited.add(url);
            const page = await this.adapter().readListPage(context.origin, videoId, { url, scope });
            for (const list of page.lists) {
                const previous = lists.get(list.id);
                if (previous && JSON.stringify(previous) !== JSON.stringify(list)) throw new Error("清单分页状态已变化，请重新读取");
                lists.set(list.id, list);
            }
            url = page.nextUrl;
        } while (url);
        return [...lists.values()];
    }
    /** @param {any[]} movies @param {string} origin */
    normalizeMovies(movies, origin) {
        const selected = new Map();
        for (const movie of movies) {
            assertMovieStateEligible(movie);
            const carNum = normalizeCarNum(movie.carNum), url = new URL(movie.url || "", origin);
            const videoId = /^\/v\/([A-Za-z0-9_-]{1,128})\/?$/.exec(url.pathname)?.[1];
            if (!carNum || !videoId || url.origin !== origin || url.username || url.password) throw new Error(`${carNum || "影片"} 缺少当前 JavDB 影片链接`);
            const previous = selected.get(videoId);
            if (previous && previous.carNum !== carNum) throw new Error("同一 JavDB 影片链接对应多个番号，已停止操作");
            selected.set(videoId, { carNum, videoId, url: `${origin}/v/${videoId}` });
        }
        if (!selected.size) throw new Error("请先选择影片");
        return [...selected.values()];
    }
    /** @param {{movies: any[], lists: any[], checked: boolean, expectedAccount: string}} input @param {any} [scope] */
    async createTask(input, scope) {
        if (this.disposed) throw new Error("清单功能已停用");
        const access = await this.access(scope);
        scope?.assertActive();
        if (this.disposed) throw new Error("清单功能已停用");
        if (!access.writable || !access.account) throw failure("LIST_READ_ONLY", access.reason);
        if (access.account.fingerprint !== input.expectedAccount) throw failure("LIST_ACCOUNT_CHANGED", "确认后的网页账号已变化，请重新核对");
        if (typeof input.checked !== "boolean" || !input.lists.length || input.lists.some(list => !ID.test(list.id) || !list.name || list.disabled)) throw new Error("请选择可操作的现有清单");
        const task = { schema: 1, id: crypto.randomUUID(), origin: access.origin, accountUrl: access.accountUrl, accountFingerprint: access.account.fingerprint, accountLabel: access.account.label,
            movies: this.normalizeMovies(input.movies, access.origin), lists: [...new Map(input.lists.map(list => [list.id, { id: list.id, name: String(list.name) }])).values()],
            checked: input.checked, state: "ready", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await this.storage.set(PREFIX + task.id, task);
        return task;
    }
    /** @param {any} task */
    validateTask(task) {
        if (!task || task.schema !== 1 || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(task.id) || typeof task.checked !== "boolean" || !/^[a-f0-9]{64}$/.test(task.accountFingerprint) || !Array.isArray(task.movies) || !Array.isArray(task.lists) || !task.lists.length || task.lists.some((/** @type {any} */ list) => !ID.test(list.id) || typeof list.name !== "string" || !list.name.trim())) throw new Error("清单恢复记录版本或格式无效，已保留记录");
        const context = this.currentContext();
        const accountUrl = new URL(task.accountUrl);
        if (task.origin !== context.origin || accountUrl.origin !== task.origin || accountUrl.username || accountUrl.password || accountUrl.search || accountUrl.hash) throw failure("LIST_READ_ONLY", "该任务属于其他 JavDB 来源，请回到原来源恢复");
        const movies = this.normalizeMovies(task.movies, task.origin);
        if (movies.length !== task.movies.length || movies.some((movie, index) => movie.carNum !== task.movies[index].carNum || movie.videoId !== task.movies[index].videoId || movie.url !== task.movies[index].url) || new Set(task.lists.map((/** @type {any} */ list) => list.id)).size !== task.lists.length) throw new Error("清单恢复记录的影片或清单身份不一致");
        return task;
    }
    /** @returns {Promise<any[]>} */
    async listTasks() {
        const keys = await this.storage.keys(), tasks = [];
        for (const key of keys) if (key.startsWith(PREFIX) && !key.slice(PREFIX.length).includes("/")) {
            const task = await this.storage.get(key);
            if (task?.origin === this.context()?.origin) tasks.push(task);
        }
        return tasks.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
    }
    /** @param {any} task */
    async readResults(task) {
        const prefix = `${PREFIX}${task.id}/`, keys = await this.storage.keys(), results = new Map();
        for (const key of keys) if (key.startsWith(prefix)) {
            if (!/^(0|[1-9]\d*)\/(0|[1-9]\d*)$/.test(key.slice(prefix.length))) throw new Error("清单执行记录标识无效");
            const parts = key.slice(prefix.length).split("/"), movie = Number(parts[0]), list = Number(parts[1]);
            const value = await this.storage.get(key);
            if (parts.length !== 2 || !Number.isInteger(movie) || movie < 0 || movie >= task.movies.length || !Number.isInteger(list) || list < 0 || list >= task.lists.length || !value || value.schema !== 1 || !PAIR_STATES.includes(value.state)) throw new Error("清单执行记录格式无效，已保留记录");
            results.set(`${movie}/${list}`, value);
        }
        return results;
    }
    /** @param {any} task @param {Map<string, any>} results */
    progress(task, results) {
        const counts = { success: 0, failed: 0, unknown: 0, unstarted: task.movies.length * task.lists.length - results.size };
        for (const item of results.values()) {
            if (item.state === "success") counts.success++;
            else if (item.state === "failed") counts.failed++;
            else counts.unknown++;
        }
        return { task, counts, results: [...results.entries()].map(([key, value]) => ({ key, ...value })) };
    }
    /** @param {any} run */
    changed(run) { this.dispatchEvent(new CustomEvent("lists.progress", { detail: this.progress(run.task, run.results) })); }
    /** @param {any} task */
    async inspect(task) { this.validateTask(task); return this.progress(task, await this.readResults(task)); }
    /** @param {any} run @param {number} movie @param {number} list @param {string} state @param {string} [message] */
    async saveResult(run, movie, list, state, message = "") {
        const key = `${movie}/${list}`, value = { schema: 1, state, message, updatedAt: new Date().toISOString() };
        await this.storage.set(`${PREFIX}${run.task.id}/${key}`, value);
        run.results.set(key, value);
        this.changed(run);
    }
    /** @param {any} run @param {number} movieIndex @param {number} listIndex */
    async processPair(run, movieIndex, listIndex) {
        const task = run.task, movie = task.movies[movieIndex], list = task.lists[listIndex];
        await this.saveResult(run, movieIndex, listIndex, "checking");
        try {
            await this.assertAccount(task, run.scope);
            let current = (await this.directory(task, movie.videoId, run.scope)).find(item => item.id === list.id);
            if (!current) throw new Error("目标清单已移除");
            if (current.checked !== task.checked) {
                if (current.disabled) throw new Error("目标清单不可操作");
                const account = await this.assertAccount(task, run.scope);
                await this.saveResult(run, movieIndex, listIndex, "submitting");
                let outcome = "unknown";
                try { outcome = await this.adapter().setListMember(task.origin, { videoId: movie.videoId, listId: list.id, checked: task.checked, csrf: account.csrf }, { scope: run.scope }); }
                catch { /* Read the server before classifying an ambiguous submission. */ }
                current = (await this.directory(task, movie.videoId, run.scope)).find(item => item.id === list.id);
                await this.assertAccount(task, run.scope);
                if (current?.checked !== task.checked) return this.saveResult(run, movieIndex, listIndex, outcome === "rejected" ? "failed" : "unknown", outcome === "rejected" ? "网站拒绝提交" : "提交结果未能核实，继续前将重新读取网站状态");
            } else await this.assertAccount(task, run.scope);
            await this.saveResult(run, movieIndex, listIndex, "success", "网站已确认目标成员状态");
        } catch (error) {
            if (accountChanged(error)) { run.stop = true; run.accountChanged = true; }
            const state = run.results.get(`${movieIndex}/${listIndex}`)?.state;
            await this.saveResult(run, movieIndex, listIndex, state === "submitting" || accountChanged(error) ? "unknown" : "failed", accountChanged(error) ? "网页账号已变化，任务已暂停" : "读取或核实失败，请检查网页登录状态后继续");
        }
    }
    /** @param {any} run @param {string} id */
    async executeTask(run, id) {
        const task = this.validateTask(await this.storage.get(PREFIX + id));
        if (task.id !== id) throw new Error("清单任务标识与恢复记录不一致");
        run.task = task;
        const execute = async (/** @type {any} */ lock) => {
            if (!lock) throw failure("LIST_TASK_BUSY", "该任务正在另一个标签页执行");
            run.results = await this.readResults(task);
            if (!run.stop) {
                try { await this.assertAccount(task, run.scope); }
                catch (error) {
                    if (accountChanged(error)) {
                        task.state = "account-changed";
                        await this.storage.set(PREFIX + id, task);
                        this.changed(run);
                    }
                    throw error;
                }
            }
            task.state = "running";
            task.updatedAt = new Date().toISOString();
            await this.storage.set(PREFIX + id, task);
            this.changed(run);
            let cursor = 0;
            const worker = async () => {
                while (!run.stop && cursor < task.movies.length) {
                    const movieIndex = cursor++;
                    for (let listIndex = 0; listIndex < task.lists.length && !run.stop; listIndex++) {
                        if (run.results.get(`${movieIndex}/${listIndex}`)?.state === "success") continue;
                        const name = `jhs_javdb_list_pair:${task.origin}:${task.movies[movieIndex].videoId}:${task.lists[listIndex].id}`;
                        try { await this.locks.request(name, async () => { if (!run.stop) await this.processPair(run, movieIndex, listIndex); }); }
                        catch (error) { run.stop = true; throw error; }
                    }
                }
            };
            const settled = await Promise.allSettled(Array.from({ length: Math.min(2, task.movies.length) }, worker));
            const counts = this.progress(task, run.results).counts;
            task.state = run.accountChanged ? "account-changed" : counts.success === task.movies.length * task.lists.length ? "complete" : run.stop ? "stopped" : "needs-review";
            task.updatedAt = new Date().toISOString();
            await this.storage.set(PREFIX + id, task);
            this.changed(run);
            const rejected = settled.find(result => result.status === "rejected");
            if (rejected?.status === "rejected") throw rejected.reason;
            return this.progress(task, run.results);
        };
        return this.locks.request(`jhs_javdb_list_task:${task.origin}:${id}`, { ifAvailable: true }, execute);
    }
    /** @param {string} id */
    resume(id) {
        if (this.disposed || !this.locks?.request) return Promise.reject(failure("LIST_READ_ONLY", "当前环境无法安全执行跨标签清单操作"));
        if (this.runs.has(id)) return this.runs.get(id).promise;
        const run = { task: /** @type {any} */ (null), results: new Map(), stop: false, accountChanged: false, scope: new LifecycleScope(`lists:task:${id}`), promise: /** @type {Promise<any> | null} */ (null) };
        run.promise = this.executeTask(run, id).finally(() => { run.scope.dispose(); this.runs.delete(id); });
        this.runs.set(id, run);
        return run.promise;
    }
    /** Stop scheduling and let already dispatched reads, mutations and verification settle. @param {string} id */
    async stop(id) { const run = this.runs.get(id); if (run) { run.stop = true; await run.promise; } }
    async stopAll() { for (const run of this.runs.values()) run.stop = true; await Promise.allSettled([...this.runs.values()].map(run => run.promise)); }
    async dispose() { this.disposed = true; await this.stopAll(); }
}
