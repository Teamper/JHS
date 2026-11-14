// @ts-check
import { LifecycleScope } from "../core/lifecycle-scope.js";
import { JhsError } from "../core/jhs-error.js";
import { DEFAULT_TRANSLATION_PROMPT, GOOGLE_TRANSLATION_PROFILE, TRANSLATION_CONNECTIONS_KEY, normalizeTranslationConfiguration, normalizeTranslationProfile, normalizeTranslationPrompt } from "../core/translation-model.js";

const CACHE_TTL = 2_592_000_000, CACHE_LIMIT = 1_000, CACHE_KEY = "translation_cache_v2", V1_PREFIX = "translation:v1:";

export class TranslationService extends EventTarget {
    /** @param {import("../app/integration-registry.js").IntegrationRegistry} integrations @param {import("./storage-service.js").StorageService | null} [storage] @param {{credential?:any, settings?:any, urlPolicy?:any, enabled?:boolean}} [options] */
    constructor(integrations, storage = null, options = {}) {
        super();
        this.integrations = integrations, this.storage = storage, this.memoryCache = new Map, this.inflight = new Map,
        this.legacyCache = null, this.hydrationPromise = null, this.cacheGeneration = 0, this.persistTimer = null;
        this.credential = options.credential;
        this.settings = options.settings;
        this.urlPolicy = options.urlPolicy;
        this.enabled = options.enabled ?? true;
        this.disposed = false;
        this.configuration = normalizeTranslationConfiguration({schema:1,profiles:[],primary:"google",fallbacks:[]});
        this.configurationReady = /** @type {Promise<void>|null} */ (null);
        this.configurationError = "";
        this.configurationFailure = /** @type {any} */ (null);
        this.configurationRevision = /** @type {string|null} */ (null);
        /** @type {string | null} */ this._serializedChain = null;
        this.loadSequence = 0;
        this.requestGeneration = 0;
        /** @type {any[]} */ this.queue = [];
        /** @type {Set<LifecycleScope>} */ this.workScopes = new Set();
        this.active = 0;
        this.onCredential = (/** @type {any} */ event) => { if (event.detail?.key === TRANSLATION_CONNECTIONS_KEY) void this.reloadConfiguration().catch(() => {}); };
        this.onSettings = (/** @type {any} */ event) => { if (event.detail?.names?.some((/** @type {string} */ name) => ["translationPrompt","translationConcurrency"].includes(name))) this.configurationChanged(); };
        this.listener = storage?.listenValue?.(TRANSLATION_CONNECTIONS_KEY, () => { void this.reloadConfiguration().catch(() => {}); });
        this.credential?.addEventListener("credentials.changed",this.onCredential);
        this.settings?.addEventListener("settings.changed",this.onSettings);
    }
    async initializeConfiguration() {
        let pending;
        do { pending = this.configurationReady || this.reloadConfiguration(false); await pending; } while (pending !== this.configurationReady);
    }
    /** Initial hydration preserves the consumers awaiting that same configuration. @param {boolean} [notify] */
    reloadConfiguration(notify = true) {
        const sequence = ++this.loadSequence;
        if (notify) this.cancelAll();
        const operation = Promise.resolve().then(() => this.loadConfiguration(sequence,notify));
        this.configurationReady = operation;
        return operation;
    }
    /** @param {number} sequence @param {boolean} notify */
    async loadConfiguration(sequence,notify) {
        this.configurationError = "";
        try {
            const entry = this.credential ? await (this.credential.readVersioned?.(TRANSLATION_CONNECTIONS_KEY) ?? this.credential.readEntry(TRANSLATION_CONNECTIONS_KEY)) : {value:"",revision:null};
            const next = normalizeTranslationConfiguration(entry.value ? JSON.parse(entry.value) : {schema:1,profiles:[],primary:"google",fallbacks:[]});
            if (this.disposed || sequence !== this.loadSequence) return;
            this.configuration = next;
            this._serializedChain = null;
            this.configurationRevision = entry.revision;
            this.urlPolicy?.setLocalOriginOwner("translation",next.profiles.filter((/** @type {any} */ profile) => profile.enabled).map((/** @type {any} */ profile) => new URL(profile.endpoint).origin));
            if (notify) this.configurationChanged();
        } catch (error) {
            if (this.disposed || sequence !== this.loadSequence) return;
            this.configurationFailure = error;
            this.configurationError = "翻译连接无法读取或版本不受支持，已暂停外发请求";
            this.urlPolicy?.setLocalOriginOwner("translation",[]);
            if (notify) this.configurationChanged();
            throw new JhsError("UNSUPPORTED",this.configurationError);
        }
    }
    configurationChanged() { this.cancelAll(); this.dispatchEvent(new Event("translation.changed")); }
    /** @param {boolean} enabled */
    setEnabled(enabled) { if (this.enabled === enabled) return; this.enabled = enabled; if (!enabled) this.cancelAll(); this.dispatchEvent(new Event("translation.changed")); }
    cancelAll() { this.requestGeneration++; for (const scope of this.workScopes) scope.dispose(); for (const entry of this.inflight.values()) entry.scope.dispose(); this.inflight.clear(); }
    async getConfiguration() { await this.initializeConfiguration().catch(error => { throw this.configurationFailure || error; }); if (this.configurationError) throw this.configurationFailure || new JhsError("UNSUPPORTED",this.configurationError); return {configuration:structuredClone(this.configuration),revision:this.configurationRevision}; }
    /** @param {any} value @param {string|null} revision */
    async saveConfiguration(value,revision) {
        const next = normalizeTranslationConfiguration(value);
        if (!this.credential) throw new JhsError("UNSUPPORTED","当前环境无法保存加密翻译连接");
        const entry = await (this.credential.readVersioned?.(TRANSLATION_CONNECTIONS_KEY) ?? this.credential.readEntry(TRANSLATION_CONNECTIONS_KEY));
        if (entry.revision !== revision) throw new Error("翻译配置已被其他标签页修改，请重新打开配置");
        if (entry.value) normalizeTranslationConfiguration(JSON.parse(entry.value));
        if (this.credential.setVersioned) await this.credential.setVersioned(TRANSLATION_CONNECTIONS_KEY, JSON.stringify(next), revision);
        else await this.credential.set(TRANSLATION_CONNECTIONS_KEY,JSON.stringify(next));
        await this.reloadConfiguration();
    }
    /** @param {any} value @param {string[]} revisions */
    async resolveConfiguration(value, revisions) {
        const next = normalizeTranslationConfiguration(value);
        await this.credential.setVersioned(TRANSLATION_CONNECTIONS_KEY, JSON.stringify(next), revisions);
        await this.reloadConfiguration();
    }
    prompt() { return normalizeTranslationPrompt(this.settings?.snapshot().translationPrompt ?? DEFAULT_TRANSLATION_PROMPT); }
    /** @param {() => Promise<any>} run @param {LifecycleScope} scope */
    schedule(run,scope) {
        scope.assertActive();
        this.workScopes.add(scope);
        return new Promise((resolve,reject) => {
            const job = {run,scope,resolve,reject,detach:() => {}};
            const cancel = () => { const index = this.queue.indexOf(job); if (index >= 0) { this.queue.splice(index,1); reject(new JhsError("ABORTED","翻译已取消")); } };
            scope.signal.addEventListener("abort",cancel,{once:true});
            job.detach = () => scope.signal.removeEventListener("abort",cancel);
            this.queue.push(job);
            this.drain();
        }).finally(() => this.workScopes.delete(scope));
    }
    drain() {
        const concurrency = Math.max(1,Math.min(10,Math.trunc(Number(this.settings?.snapshot().translationConcurrency) || 2)));
        while (this.active < concurrency && this.queue.length) {
            const job = this.queue.shift();
            job.detach();
            if (job.scope.disposed) { job.reject(new JhsError("ABORTED","翻译已取消")); continue; }
            this.active++;
            Promise.resolve().then(() => { job.scope.assertActive(); return job.run(); }).then(job.resolve,job.reject).finally(() => { this.active--; this.drain(); });
        }
    }
    /** @param {any} profile @param {string} text @param {any} options @param {LifecycleScope} scope */
    async perform(profile,text,options,scope) {
        scope.assertActive();
        const assertDispatch = () => { scope.assertActive(); if (options.canDispatch && !options.canDispatch()) throw new JhsError("ABORTED","标题已离开可见区域或被遮罩"); };
        const requestOptions = {sourceLanguage:options.sourceLanguage,targetLanguage:options.targetLanguage,scope,
            ...(options.canDispatch ? {beforeSend:async () => {
                assertDispatch();
                assertDispatch();
                return () => {
                    assertDispatch();
                };
            }} : {})};
        let result;
        if (profile.id === "google") {
            const manifest = this.integrations.list("text.translate").find(item => item.id === "google-translate");
            const adapter = manifest && this.integrations.getAdapter(manifest.id);
            if (typeof adapter?.translate !== "function") throw new JhsError("UNSUPPORTED","Google 翻译适配器不可用");
            result = {text:await adapter.translate(text,requestOptions),usage:{}};
        } else result = await this.integrations.getAdapter("translation-providers").translateDetailed(text,{...requestOptions,profile,prompt:options.prompt});
        scope.assertActive();
        if (typeof result.text !== "string" || !result.text.trim()) throw new JhsError("EMPTY_RESULT","翻译服务返回空结果");
        return {...result,source:{id:profile.id,name:profile.name,protocol:profile.type,model:profile.model},cacheHit:false};
    }
    /** Connection tests temporarily pin only the submitted endpoint origin. @param {any} value @param {LifecycleScope} scope */
    async testConnection(value,scope) {
        const profile = normalizeTranslationProfile(value), owner = `translation-test:${crypto.randomUUID()}`;
        const requestScope = new LifecycleScope(owner), release = scope.addCleanup(() => { requestScope.dispose(); this.urlPolicy?.setLocalOriginOwner(owner,[]); });
        this.urlPolicy?.setLocalOriginOwner(owner,[new URL(profile.endpoint).origin]);
        try { return await this.schedule(() => this.perform(profile,"接続テスト ABC-123",{sourceLanguage:"ja",targetLanguage:"zh-CN",prompt:this.prompt()},requestScope),requestScope); }
        finally { requestScope.dispose(); release(); this.urlPolicy?.setLocalOriginOwner(owner,[]); }
    }
    /** @param {string} text @param {string} source @param {string} target */
    cacheKey(text, source, target) { return `${V1_PREFIX}${source}:${target}:${text}`; }
    readLegacyCache() {
        if (null !== this.legacyCache) return this.legacyCache;
        try { const value = JSON.parse(this.storage?.getLocal?.("jhs_translate") || "{}"); this.legacyCache = value && "object" === typeof value && !Array.isArray(value) ? value : {}; }
        catch { this.legacyCache = {}; }
        return this.legacyCache;
    }
    hydrate() {
        if (this.hydrationPromise) return this.hydrationPromise;
        const generation = this.cacheGeneration;
        return this.hydrationPromise = (async () => {
            if (!this.storage) return;
            const storage = this.storage, migrated = /** @type {string[]} */ ([]);
            let changed = !1;
            try {
                const cache = /** @type {{entries?: Record<string, any>} | null} */ (await storage.get(CACHE_KEY));
                for (const [key, entry] of Object.entries(cache?.entries || {})) {
                    if (generation === this.cacheGeneration && "string" === typeof entry?.value && Number(entry.expiresAt) > Date.now()) this.memoryCache.set(key, { value: entry.value, expiresAt: Number(entry.expiresAt), lastUsed: Number(entry.lastUsed) || Date.now(), details:entry.details });
                    else changed = !0;
                }
                const keys = /** @type {string[]} */ (await storage.keys());
                for (const key of keys.filter((value => value.startsWith(V1_PREFIX)))) {
                    const entry = /** @type {any} */ (await storage.get(key));
                    generation === this.cacheGeneration && "string" === typeof entry?.value && Number(entry.expiresAt) > Date.now() && this.memoryCache.set(key, { value: entry.value, expiresAt: Number(entry.expiresAt), lastUsed: Number(entry.lastUsed) || Date.now() });
                    migrated.push(key), changed = !0;
                }
                if (generation === this.cacheGeneration && (this.prune() || changed)) void this.persistNow(generation).then((() => Promise.all(migrated.map((key => storage.remove(key)))))).catch((() => {}));
            } catch {}
        })();
    }
    prune() {
        const now = Date.now(); let changed = !1;
        for (const [key, entry] of this.memoryCache) entry.expiresAt <= now && (this.memoryCache.delete(key), changed = !0);
        const overflow = this.memoryCache.size - CACHE_LIMIT;
        if (overflow > 0) for (const [key] of [...this.memoryCache].sort(((a, b) => a[1].lastUsed - b[1].lastUsed)).slice(0, overflow)) this.memoryCache.delete(key), changed = !0;
        return changed;
    }
    schedulePersist() {
        if (!this.storage || null !== this.persistTimer) return;
        const generation = this.cacheGeneration;
        this.persistTimer = setTimeout((() => { this.persistTimer = null, void this.persistNow(generation).catch((() => {})); }), 300);
    }
    /** @param {number} [generation] */
    async persistNow(generation = this.cacheGeneration) {
        if (!this.storage || generation !== this.cacheGeneration) return;
        this.prune(), await this.storage.set(CACHE_KEY, { version: 2, entries: Object.fromEntries(this.memoryCache) });
    }
    /** @param {string} key @param {string} value @param {number} [generation] */
    remember(key, value, generation = this.cacheGeneration) {
        if (generation === this.cacheGeneration) { const now = Date.now(); this.memoryCache.set(key, { value, expiresAt: now + CACHE_TTL, lastUsed: now }), this.prune(), this.schedulePersist(); }
        return value;
    }
    async clearCache() {
        this.cancelAll();
        this.cacheGeneration += 1, null !== this.persistTimer && clearTimeout(this.persistTimer), this.persistTimer = null,
        this.memoryCache.clear(), this.legacyCache = {}, this.storage?.removeLocal?.("jhs_translate");
        if (this.storage) { const storage = this.storage; try { const keys = /** @type {string[]} */ (await storage.keys()); await storage.remove(CACHE_KEY), await Promise.all(keys.filter((key => key.startsWith(V1_PREFIX))).map((key => storage.remove(key)))); } catch {} }
        this.hydrationPromise = Promise.resolve();
    }
    async inspectCache() { return await this.hydrate(), this.prune(), { version: 2, size: this.memoryCache.size, entries: Object.fromEntries(this.memoryCache) }; }
    /** @param {string} text @param {{sourceLanguage?: string, targetLanguage?: string, cacheAlias?: string, scope?: LifecycleScope, automatic?:boolean, canDispatch?:()=>boolean}} [options] */
    async translate(text, options = {}) { return (await this.translateDetailed(text,options)).text; }
    /** @param {string} text @param {{sourceLanguage?: string, targetLanguage?: string, cacheAlias?: string, scope?: LifecycleScope, automatic?:boolean, canDispatch?:()=>boolean}} [options] */
    async translateDetailed(text, options = {}) {
        options.scope?.assertActive();
        if (!this.enabled || this.disposed) throw new JhsError("ABORTED","翻译功能已停用");
        if (!String(text || "").trim()) throw new TypeError("翻译原文不能为空");
        await this.initializeConfiguration();
        options.scope?.assertActive();
        if (this.configurationError) throw new JhsError("UNSUPPORTED",this.configurationError);
        const sourceLanguage = options.sourceLanguage ?? "ja", targetLanguage = options.targetLanguage ?? "zh-CN", prompt = this.prompt();
        const configuration = this.configuration;
        const profiles = [GOOGLE_TRANSLATION_PROFILE,...this.configuration.profiles];
        const chain = [configuration.primary,...configuration.fallbacks].map(id => profiles.find(profile => profile.id === id));
        const google = configuration.primary === "google" && prompt === DEFAULT_TRANSLATION_PROMPT;
        const oldKey = this.cacheKey(text,sourceLanguage,targetLanguage), generation = this.cacheGeneration, requestGeneration = this.requestGeneration;
        const legacy = google && options.cacheAlias && sourceLanguage === "ja" && targetLanguage === "zh-CN" ? this.readLegacyCache()[options.cacheAlias] : null;
        if (typeof legacy === "string" && legacy) return this.cachedResult(this.remember(oldKey,legacy,generation));
        const serializedChain = this._serializedChain ??= JSON.stringify(chain);
        const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`[${serializedChain},${JSON.stringify(prompt)},${JSON.stringify(sourceLanguage)},${JSON.stringify(targetLanguage)},${JSON.stringify(text)}]`));
        options.scope?.assertActive();
        if (!this.enabled || requestGeneration !== this.requestGeneration) throw new JhsError("ABORTED","翻译配置已变化");
        const key = `translation:v3:${Array.from(new Uint8Array(digest),byte => byte.toString(16).padStart(2,"0")).join("")}`;
        const readCached = () => {
            const entry = this.memoryCache.get(key) || (google ? this.memoryCache.get(oldKey) : null);
            if (!entry || entry.expiresAt <= Date.now()) return null;
            entry.lastUsed = Date.now();
            return this.cachedResult(entry.value,entry.details);
        };
        let cached = readCached();
        if (cached) return cached;
        await this.hydrate();
        options.scope?.assertActive();
        if (!this.enabled || requestGeneration !== this.requestGeneration) throw new JhsError("ABORTED","翻译配置已变化");
        cached = readCached();
        if (cached) return cached;
        let entry = this.inflight.get(key);
        if (entry?.scope.disposed) { this.inflight.delete(key); entry = null; }
        if (!entry) {
            const scope = new LifecycleScope(`translation:${crypto.randomUUID()}`);
            entry = {scope,consumers:0,settled:false,guards:new Set(),promise:Promise.resolve()};
            entry.promise = this.schedule(async () => {
                const attempts = [];
                let lastError;
                for (const profile of chain) {
                    scope.assertActive();
                    try {
                        const result = {...await this.perform(profile,text,{sourceLanguage,targetLanguage,prompt,canDispatch:() => [...entry.guards].some(guard => guard())},scope),attempts};
                        this.remember(key,result.text,generation);
                        const cached = this.memoryCache.get(key);
                        if (cached) cached.details = {source:result.source,usage:result.usage,attempts:result.attempts};
                        return result;
                    } catch (error) {
                        scope.assertActive();
                        if (error instanceof JhsError && ["ABORTED","UNSUPPORTED"].includes(error.code)) {
                            throw error;
                        }
                        lastError = error instanceof JhsError ? error : new JhsError("NETWORK_ERROR","翻译服务请求失败");
                        attempts.push({source:profile.id,code:error instanceof JhsError ? error.code : "NETWORK_ERROR"});
                    }
                }
                throw lastError;
            },scope).finally(() => { entry.settled = true; if (this.inflight.get(key) === entry) this.inflight.delete(key); scope.dispose(); });
            this.inflight.set(key,entry);
        }
        return this.consume(entry,options.scope,options.canDispatch);
    }
    /** @param {string} text @param {any} [details] */
    cachedResult(text,details) { return {text,source:details?.source || {id:"google",name:"Google",protocol:"google",model:""},usage:details?.usage || {},attempts:details?.attempts || [],cacheHit:true}; }
    /** Each caller owns a consumer. Closing one surface preserves other callers. @param {any} entry @param {LifecycleScope} [scope] @param {()=>boolean} [canDispatch] */
    consume(entry,scope,canDispatch) {
        scope?.assertActive();
        entry.consumers++;
        const guard = () => !scope?.disposed && (!canDispatch || canDispatch());
        entry.guards.add(guard);
        let released = false;
        const release = () => { if (released) return; released = true; entry.guards.delete(guard); if (--entry.consumers === 0) entry.scope.dispose(); };
        return new Promise((resolve,reject) => {
            const abort = () => { release(); reject(new JhsError("ABORTED","翻译请求已取消")); };
            const requestAbort = () => { if (!entry.settled) abort(); };
            scope?.signal.addEventListener("abort",abort,{once:true});
            entry.scope.signal.addEventListener("abort",requestAbort,{once:true});
            entry.promise.then(resolve,reject).finally(() => { scope?.signal.removeEventListener("abort",abort); entry.scope.signal.removeEventListener("abort",requestAbort); release(); });
            if (scope?.disposed) abort();
            else if (entry.scope.disposed && !entry.settled) requestAbort();
        });
    }
    dispose() {
        this.disposed = true; this.cancelAll();
        if (this.listener != null) this.storage?.unlistenValue?.(this.listener);
        this.credential?.removeEventListener("credentials.changed",this.onCredential);
        this.settings?.removeEventListener("settings.changed",this.onSettings);
        this.urlPolicy?.setLocalOriginOwner("translation",[]);
        if (this.persistTimer !== null) clearTimeout(this.persistTimer);
    }
}
