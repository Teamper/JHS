// @ts-check

export const SHARED_WEBDAV_KEY = "jhs_webdav_shared_profile_v1";
export const WEBDAV_CANDIDATE_PREFIX = "jhs_webdav_profile_candidate_v1:";
export const WEBDAV_PAUSE_KEY = "jhs_webdav_sync_paused_v1";
/** @param {any} profile */
function normalize(profile) {
    let url = String(profile.url || "").trim();
    if (url) { const parsed = new URL(url); if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("WebDAV 地址无效"); url = parsed.href.replace(/\/+$/, ""); }
    return { url, username: String(profile.username || ""), password: String(profile.password || "") };
}
/** One encrypted GM authority; automatic migration never writes the explicit authority key. */
export class WebDavSharedProfile extends EventTarget {
    /** @param {any} dependencies */
    constructor(dependencies) { super(); this.deps = dependencies; this.origin = dependencies.origin; this.candidateKey = WEBDAV_CANDIDATE_PREFIX + encodeURIComponent(this.origin); }
    /** @param {any} entry */
    decode(entry) {
        if (!entry.value) return { profile: normalize({}), revision: "cleared" };
        const record = JSON.parse(entry.value);
        if (record.schema !== 1 || typeof record.revision !== "string") throw new Error("共享 WebDAV 连接版本无效，请重新保存");
        return { profile: normalize(record.profile), revision: record.revision };
    }
    async migrate() {
        const explicit = await this.deps.credential.readEntry(SHARED_WEBDAV_KEY);
        if (explicit.exists) return;
        if ((await this.deps.credential.readEntry(this.candidateKey)).exists) return;
        const legacy = normalize(await this.deps.readLegacy());
        if (!legacy.url || !legacy.username || !legacy.password) return;
        await this.deps.credential.set(this.candidateKey, JSON.stringify({ schema: 1, revision: crypto.randomUUID(), profile: legacy }));
    }
    async snapshot() {
        const explicit = await this.deps.credential.readEntry(SHARED_WEBDAV_KEY);
        if (explicit.exists) return this.decode(explicit);
        const keys = [...new Set([...(await this.deps.storage.listValues()), this.candidateKey])].filter(key => key.startsWith(WEBDAV_CANDIDATE_PREFIX)).sort();
        /** @type {Array<{profile: {url: string, username: string, password: string}, revision: string}>} */ const candidates = [];
        for (const key of keys) { const candidate = await this.deps.credential.readEntry(key); if (candidate.exists && candidate.value) candidates.push(this.decode(candidate)); }
        // A user save during decryption/enumeration always supersedes migration.
        const latest = await this.deps.credential.readEntry(SHARED_WEBDAV_KEY);
        if (latest.exists) return this.decode(latest);
        const groups = new Set(candidates.map(candidate => JSON.stringify(candidate.profile)));
        if (groups.size > 1) throw Object.assign(new Error("不同网站保存了不同 WebDAV 连接，请在设置中选择并保存一次共享连接"), { code: "SYNC_PROFILE_CONFLICT" });
        return candidates[0] ?? { profile: normalize({}), revision: "" };
    }
    /** @param {Record<string, any>} patch */
    async save(patch) {
        let current = {};
        if (!["url", "username", "password"].every(key => Object.hasOwn(patch, key))) {
            try { const snapshot = await this.snapshot(); current = snapshot.revision ? snapshot.profile : await this.deps.readLegacy(); } catch (error) {
                if (/** @type {any} */ (error).code !== "SYNC_PROFILE_CONFLICT") throw error;
                current = await this.deps.readLegacy();
            }
        }
        const profile = normalize({ ...current, ...patch });
        const record = { schema: 1, revision: crypto.randomUUID(), profile };
        if (!profile.url && !profile.username && !profile.password) await this.deps.credential.remove(SHARED_WEBDAV_KEY);
        else await this.deps.credential.set(SHARED_WEBDAV_KEY, JSON.stringify(record));
        // Whole-record last writer wins. Never roll another origin's save back.
        const saved = await this.snapshot(); this.dispatchEvent(new Event("changed")); return saved;
    }
    async paused() { return !!(await this.deps.storage.getValue(WEBDAV_PAUSE_KEY, false)); }
    /** @param {boolean} paused */
    async setPaused(paused) { await this.deps.storage.setValue(WEBDAV_PAUSE_KEY, paused); this.dispatchEvent(new Event("changed")); }
    /** @param {any} scope */
    watch(scope) {
        const keys = [SHARED_WEBDAV_KEY, WEBDAV_PAUSE_KEY];
        for (const key of keys) {
            const listener = this.deps.storage.listenValue?.(key, () => this.dispatchEvent(new Event("changed")));
            if (listener != null) scope.addCleanup(() => this.deps.storage.unlistenValue?.(listener));
        }
    }
}
