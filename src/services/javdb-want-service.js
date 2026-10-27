// @ts-check

import { LifecycleScope } from "../core/lifecycle-scope.js";
import { O as createJavDbSignature } from "../core/javdb-api.js";

const TOKEN_KEY = "jhs_appAuthorization", API = "https://jdforrepam.com/api";

/** Account-owned, cancellable want-watch index. Never persists credentials or account results. */
export class JavDbWantService {
    /** @param {{http: any, credential: any, invalidate?: (id: string) => Promise<unknown>, logger?: any, sign?: () => string}} deps */
    constructor(deps) {
        this.deps = deps;
        /** @type {any} */ this.index = null;
        this.changed = (/** @type {any} */ event) => { if (event.detail?.key === TOKEN_KEY) this.reset(); };
        deps.credential?.addEventListener?.("credentials.changed", this.changed);
    }
    reset() { this.index?.requestScope?.dispose(); this.index = null; }
    dispose() { this.reset(); this.deps.credential?.removeEventListener?.("credentials.changed", this.changed); }
    async session() {
        return this.deps.credential.readEntry ? this.deps.credential.readEntry(TOKEN_KEY) : { value: await this.deps.credential.get(TOKEN_KEY), revision: null };
    }
    /** @param {any} session @param {string} method @param {string} path @param {{scope?: LifecycleScope, body?: string}} [options] */
    async request(session, method, path, options = {}) {
        const response = await this.deps.http.request({
            providerId: "javdb", capability: method === "GET" ? "account.want-read" : "account.want-write",
            method, url: `${API}${path}`, responseType: "json", body: options.body,
            cacheScope: "none", retryCount: 0, ...(method === "POST" ? { circuitGroup: "account-mutation" } : {}),
            headers: { "user-agent": "Dart/3.5 (dart:io)", "accept-language": "zh-TW", authorization: `Bearer ${session.value}`, jdsignature: (this.deps.sign ?? createJavDbSignature)(), ...(options.body ? { "content-type": "multipart/form-data; boundary=----jhs-javdb-want-watch" } : {}) },
            urlPolicy: { trustClass: "builtin-public", hosts: ["jdforrepam.com"] },
        }, options.scope);
        return response.data;
    }
    /** @param {any} session */
    state(session) {
        if (this.index && (this.index.revision !== session.revision || !this.index.pending && !this.index.consumers.size && Date.now() > this.index.expires)) this.reset();
        const state = this.index ?? { revision: session.revision, ids: new Set(), page: 1, complete: false, expires: Date.now() + 60_000, consumers: new Set(), pending: null, requestScope: null };
        if (session.revision) this.index = state;
        return state;
    }
    /** @param {string} id @param {{scope?: LifecycleScope}} [options] @returns {Promise<boolean | null>} */
    async get(id, { scope } = {}) {
        scope?.assertActive();
        const session = await this.session();
        if (!session.value) return null;
        const state = this.state(session), consumer = Symbol();
        state.consumers.add(consumer);
        const release = () => {
            state.consumers.delete(consumer);
            if (!state.consumers.size) state.requestScope?.dispose();
        };
        const releaseOwner = scope?.addCleanup(release);
        try {
            while (!state.ids.has(id) && !state.complete && state.page <= 100) {
                scope?.assertActive();
                if (!state.pending) {
                    const requestScope = new LifecycleScope("javdb-want-index");
                    state.requestScope = requestScope;
                    state.pending = (async () => {
                        const response = await this.request(session, "GET", `/v2/users/review_movies?status=want_watch&type=0&sort_by=create&order_by=desc&page=${state.page}&limit=48`, { scope: requestScope });
                        requestScope.assertActive();
                        const movies = response?.data?.movies ?? response?.movies;
                        if (!Array.isArray(movies)) throw new Error("JavDB 想看状态响应无效");
                        for (const movie of movies) state.ids.add(String(movie.id));
                        state.page++; state.complete = movies.length < 48;
                    })().finally(() => { requestScope.dispose(); state.pending = null; if (state.requestScope === requestScope) state.requestScope = null; });
                }
                await this.wait(state.pending, scope);
                if ((await this.session()).revision !== session.revision) return null;
            }
            return state.ids.has(id) ? true : state.complete ? false : null;
        } finally { releaseOwner ? releaseOwner() : release(); }
    }
    /** A cancelled consumer need not wait for another workspace's shared request. @param {Promise<any>} pending @param {LifecycleScope} [scope] */
    async wait(pending, scope) {
        if (!scope) return pending;
        scope.assertActive();
        let abort = () => {};
        const cancelled = new Promise((_, reject) => { abort = () => reject(new DOMException("查询已取消", "AbortError")); scope.signal.addEventListener("abort", abort, { once: true }); });
        try { return await Promise.race([pending, cancelled]); }
        finally { scope.signal.removeEventListener("abort", abort); }
    }
    /** @param {string} id @param {{scope?: LifecycleScope}} [options] */
    async mark(id, { scope } = {}) {
        scope?.assertActive();
        const session = await this.session();
        if (!session.value) throw Object.assign(new Error("请先登录 JavDB 账号"), { code: "LOGIN_REQUIRED" });
        const boundary = "----jhs-javdb-want-watch";
        const body = [["status", "want_watch"], ["score", "0"], ["content", ""]].map(([name, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`).join("") + `--${boundary}--\r\n`;
        let response;
        try {
            response = await this.request(session, "POST", `/v1/movies/${encodeURIComponent(id)}/reviews`, { scope, body });
            if (response?.success === 0) throw response;
        } catch (cause) {
            const error = /** @type {any} */ (cause);
            if (error?.status === 401 || error?.details?.status === 401 || error?.action === "JWTVerificationError" || /未登录|unauthorized|jwt/i.test(error?.message || "")) {
                if ((await this.session()).revision === session.revision) await this.deps.credential.remove(TOKEN_KEY);
                throw Object.assign(new Error("JavDB 登录已失效，请重新登录"), { code: "LOGIN_REQUIRED" });
            }
            throw cause instanceof Error ? cause : new Error(error?.message || "加入 JavDB 想看失败");
        }
        // A returned POST success is committed, even if the view closed or local cleanup fails.
        try { if ((await this.session()).revision === session.revision && session.revision) this.state(session).ids.add(id); }
        catch { /* account results must never be applied to a different revision */ }
        try { await this.deps.invalidate?.(id); }
        catch (error) { try { this.deps.logger?.warn("JavDB 想看已提交，详情缓存清理失败", error); } catch { /* committed */ } }
        return response;
    }
}
