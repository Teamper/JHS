// @ts-check
import { LifecycleScope } from "../core/lifecycle-scope.js";
import { assertMovieStateEligible, normalizeCarNum } from "../core/movie-identity.js";
import { MEDIA_CONNECTIONS_KEY, normalizeMediaConnection, mediaConnectionErrorLabel, mediaItemCode, mediaItemLink } from "../core/media-library-model.js";
import { movieCodeKey } from "../core/movie-code-evidence.js";

const CACHE_MS = 600000;

/** Account/config-bound local cache and shared two-request scheduler. */
export class MediaLibraryService extends EventTarget {
    /** @param {{integrations: any, credential: any, storage: any, settings: any, urlPolicy: any}} options */
    constructor({ integrations, credential, storage, settings, urlPolicy }) {
        super();
        this.integrations = integrations;
        this.credential = credential;
        this.storage = storage;
        this.settings = settings;
        this.urlPolicy = urlPolicy;
        /** @type {any[]} */ this.connections = [];
        /** @type {Map<string, any>} */ this.indexes = new Map();
        /** @type {Map<string, any>} */ this.loading = new Map();
        /** @type {Map<string, any>} */ this.results = new Map();
        /** @type {any[]} */ this.queue = [];
        this.active = 0;
        this.generation = 0;
        this.loadSequence = 0;
        this.ready = /** @type {Promise<void> | null} */ (null);
        this.configurationError = "";
        this.configurationFailure = /** @type {any} */ (null);
        this.configurationRevision = /** @type {string|null} */ (null);
        this.disposed = false;
        this.listener = storage.listenValue(MEDIA_CONNECTIONS_KEY, () => { void this.reload().catch(() => {}); });
        this.onCredential = (/** @type {any} */ event) => { if (event.detail?.key === MEDIA_CONNECTIONS_KEY) void this.reload().catch(() => {}); };
        credential.addEventListener("credentials.changed", this.onCredential);
        this.onSettings = (/** @type {any} */ event) => { if (event.detail?.names?.includes("enableMediaLibrary")) this.invalidate(); };
        settings.addEventListener("settings.changed", this.onSettings);
    }
    enabled() { return [true, "yes"].includes(this.settings.snapshot().enableMediaLibrary); }
    listConnections() { return this.connections.map(item => ({ ...item })); }
    async initialize() {
        let pending;
        do { pending = this.ready || this.reload(); await pending.catch(() => {}); } while (pending !== this.ready);
    }
    reload() {
        const operation = this.loadConfiguration();
        this.ready = operation;
        return operation;
    }
    async loadConfiguration() {
        if (this.disposed) return;
        const sequence = ++this.loadSequence;
        this.configurationError = "";
        this.connections = [];
        this.urlPolicy.setLocalOriginOwner("media-library", []);
        this.invalidate();
        try {
            const entry = await (this.credential.readVersioned?.(MEDIA_CONNECTIONS_KEY) ?? this.credential.readEntry(MEDIA_CONNECTIONS_KEY));
            const parsed = entry.value ? JSON.parse(entry.value) : [];
            if (!Array.isArray(parsed) || parsed.length > 20) throw new Error("媒体库连接配置无效，请重新保存");
            const next = parsed.map(normalizeMediaConnection);
            if (new Set(next.map(item => item.id)).size !== next.length) throw new Error("媒体服务器标识重复");
            if (sequence !== this.loadSequence || this.disposed) return;
            this.connections = next;
            this.configurationRevision = entry.revision ?? null;
            this.urlPolicy.setLocalOriginOwner("media-library", next.filter(item => item.enabled).map(item => new URL(item.address).origin));
            this.dispatchEvent(new Event("media.changed"));
        } catch (error) {
            if (sequence !== this.loadSequence || this.disposed) return;
            this.configurationFailure = error;
            this.configurationError = "媒体库连接无法读取，请重新保存连接配置";
            this.dispatchEvent(new Event("media.changed"));
            throw new Error(this.configurationError);
        }
    }
    async getConfiguration() {
        await this.initialize();
        if (this.configurationError) throw this.configurationFailure || new Error(this.configurationError);
        return { connections: this.listConnections(), revision: this.configurationRevision };
    }
    /** @param {any[]} values @param {string[]} revisions */
    async resolveConfiguration(values, revisions) {
        if (!Array.isArray(values) || values.length > 20) throw new Error("最多配置 20 个媒体服务器");
        const next = values.map(normalizeMediaConnection);
        if (new Set(next.map(item => item.id)).size !== next.length) throw new Error("媒体服务器标识重复");
        await this.credential.setVersioned(MEDIA_CONNECTIONS_KEY, JSON.stringify(next), revisions);
        await this.reload();
    }
    /** One encrypted replacement keeps addresses, user scopes and keys local. @param {any[]} values @param {string|null} [revision] */
    async saveConnections(values, revision) {
        await this.initialize();
        if (this.configurationError) throw new Error(this.configurationError);
        revision = revision === undefined ? this.configurationRevision : revision;
        if (!Array.isArray(values) || values.length > 20) throw new Error("最多配置 20 个媒体服务器");
        const next = values.map(normalizeMediaConnection);
        if (new Set(next.map(item => item.id)).size !== next.length) throw new Error("媒体服务器标识重复");
        if (this.credential.setVersioned) await this.credential.setVersioned(MEDIA_CONNECTIONS_KEY, JSON.stringify(next), revision);
        else await this.credential.set(MEDIA_CONNECTIONS_KEY, JSON.stringify(next));
        await this.reload();
    }
    /** Explicit connection tests temporarily authorize only the submitted origin. @param {any} value @param {LifecycleScope} scope */
    async testConnection(value, scope) {
        const connection = normalizeMediaConnection(value), owner = `media-test:${crypto.randomUUID()}`;
        this.urlPolicy.setLocalOriginOwner(owner, [new URL(connection.address).origin]);
        const release = scope.addCleanup(() => this.urlPolicy.setLocalOriginOwner(owner, []));
        try {
            const adapter = this.integrations.getAdapter("media-library");
            const info = await this.schedule(() => adapter.serverInfo(connection, { scope }), scope);
            await this.schedule(() => adapter.readPage(connection, { offset: 0, scope }), scope);
            return info;
        } finally { release(); this.urlPolicy.setLocalOriginOwner(owner, []); }
    }
    invalidate() {
        this.generation++;
        for (const entry of this.loading.values()) entry.scope.dispose();
        this.loading.clear();
        this.indexes.clear();
        this.results.clear();
        this.dispatchEvent(new Event("media.changed"));
    }
    /** @param {string} carNum */
    peek(carNum) { return this.results.get(carNum) || { status: "unknown", servers: [], hits: [] }; }
    /** @param {() => Promise<any>} run @param {LifecycleScope} scope */
    schedule(run, scope) {
        scope.assertActive();
        return new Promise((resolve, reject) => {
            const job = { run, scope, resolve, reject, detach: () => {} };
            const cancel = () => { const index = this.queue.indexOf(job); if (index >= 0) { this.queue.splice(index, 1); reject(new DOMException("已取消", "AbortError")); } };
            scope.signal.addEventListener("abort", cancel, { once: true });
            job.detach = () => scope.signal.removeEventListener("abort", cancel);
            this.queue.push(job);
            this.drain();
        });
    }
    drain() {
        while (this.active < 2 && this.queue.length) {
            const job = this.queue.shift();
            job.detach();
            if (job.scope.disposed) { job.reject(new DOMException("已取消", "AbortError")); continue; }
            this.active++;
            Promise.resolve().then(() => { job.scope.assertActive(); return job.run(); }).then(job.resolve, job.reject).finally(() => { this.active--; this.drain(); });
        }
    }
    /** @param {any} connection @param {LifecycleScope | undefined} scope */
    async index(connection, scope) {
        const cached = this.indexes.get(connection.id);
        if (cached?.expires > Date.now()) return cached;
        let entry = this.loading.get(connection.id);
        if (entry?.scope.disposed) { this.loading.delete(connection.id); entry = null; }
        if (!entry) {
            const generation = this.generation, requestScope = new LifecycleScope(`media:${connection.id}`);
            entry = { scope: requestScope, consumers: 0, promise: Promise.resolve() };
            entry.promise = this.readIndex(connection, requestScope).then(result => {
                requestScope.assertActive();
                if (generation !== this.generation) throw new DOMException("配置已变化", "AbortError");
                const cached = { ...result, expires: Date.now() + CACHE_MS };
                this.indexes.set(connection.id, cached);
                return cached;
            }).finally(() => { if (this.loading.get(connection.id) === entry) this.loading.delete(connection.id); requestScope.dispose(); });
            this.loading.set(connection.id, entry);
        }
        scope?.assertActive();
        entry.consumers++;
        let released = false;
        const release = () => { if (released) return; released = true; if (--entry.consumers === 0) entry.scope.dispose(); };
        return new Promise((resolve, reject) => {
            const abort = () => { release(); reject(new DOMException("已取消", "AbortError")); };
            scope?.signal.addEventListener("abort", abort, { once: true });
            entry.promise.then(resolve, reject).finally(() => { scope?.signal.removeEventListener("abort", abort); release(); });
            if (scope?.disposed) abort();
        });
    }
    /** @param {any} connection @param {LifecycleScope} scope */
    async readIndex(connection, scope) {
        const adapter = this.integrations.getAdapter("media-library");
        const server = await this.schedule(() => adapter.serverInfo(connection, { scope }), scope);
        /** @type {Map<string, any[]>} */ const movies = new Map();
        const seen = new Set();
        let total = -1, offset = 0;
        for (let pages = 0; pages < 1000; pages++) {
            const page = await this.schedule(() => adapter.readPage(connection, { offset, scope }), scope);
            scope.assertActive();
            if (total !== -1 && total !== page.total) throw new Error("媒体目录在查询期间变化，请刷新后重试");
            total = page.total;
            for (const item of page.items) {
                if (seen.has(item.Id)) throw new Error("媒体目录分页重复，请刷新后重试");
                seen.add(item.Id);
                const code = mediaItemCode(item);
                if (!code) continue;
                const versions = movies.get(code) || [];
                versions.push({ Id: item.Id, Name: item.Name, Path: item.Path || item.MediaSources?.[0]?.Path });
                movies.set(code, versions);
            }
            offset += page.items.length;
            if (offset === total) return { serverId: server.id, movies };
            if (offset > total || !page.items.length) throw new Error("媒体目录分页不完整");
        }
        throw new Error("媒体目录未完整读取，请缩小用户范围后刷新");
    }
    /** @param {any} movie @param {{scope?: LifecycleScope, refresh?: boolean, onUpdate?: (result: any) => void}} [options] */
    async queryMovie(movie, options = {}) {
        assertMovieStateEligible(movie);
        await this.initialize();
        options.scope?.assertActive();
        const carNum = String(normalizeCarNum(movie.carNum));
        if (!this.enabled()) return { status: "unknown", servers: [], hits: [] };
        if (this.configurationError) return { status: "unknown", servers: [{ name: "媒体库", status: "error", error: this.configurationError }], hits: [] };
        if (options.refresh) this.invalidate();
        const generation = this.generation;
        const connections = this.connections.filter(item => item.enabled);
        const servers = connections.map(item => ({ id: item.id, name: item.name, status: "loading", hits: /** @type {any[]} */ ([]), error: "" }));
        const snapshot = () => {
            const hits = servers.flatMap(server => server.hits);
            const status = hits.length ? "present" : servers.some(server => server.status === "loading") ? "loading" : !servers.length || servers.some(server => server.status === "error") ? "unknown" : "absent";
            return structuredClone({ status, servers, hits });
        };
        const publish = () => {
            options.scope?.assertActive();
            if (generation !== this.generation) throw new DOMException("媒体库配置已变化", "AbortError");
            const result = snapshot();
            this.results.set(carNum, result);
            options.onUpdate?.(result);
            this.dispatchEvent(new CustomEvent("media.result", { detail: { carNum, result } }));
        };
        publish();
        await Promise.all(connections.map(async (connection, index) => {
            const server = servers[index];
            try {
                const data = await this.index(connection, options.scope);
                server.hits = (data.movies.get(movieCodeKey(carNum)) || []).map((/** @type {any} */ item) => ({ serverId: connection.id, serverName: connection.name, itemId: item.Id, name: String(item.Name || carNum), path: String(item.Path || ""), url: mediaItemLink(connection, item.Id, data.serverId) }));
                server.status = server.hits.length ? "present" : "absent";
            } catch (error) {
                options.scope?.assertActive();
                server.status = "error";
                server.error = mediaConnectionErrorLabel(error);
            }
            publish();
        }));
        return snapshot();
    }
    dispose() {
        this.disposed = true;
        this.loadSequence++;
        this.connections = [];
        if (this.listener != null) this.storage.unlistenValue(this.listener);
        this.credential.removeEventListener("credentials.changed", this.onCredential);
        this.settings.removeEventListener("settings.changed", this.onSettings);
        this.invalidate();
        this.urlPolicy.setLocalOriginOwner("media-library", []);
    }
}
