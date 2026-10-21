// @ts-check

export const AUTO_BACKUP_STATE_KEY = "jhs_webdav_auto_backup_state_v1";
const BUSINESS_KEYS = new Set(["car_list", "favorite_actresses", "blacklist", "blacklist_car_list", "filter_keyword_title", "filter_keyword_review", "highlighted_tags", "new_video_decisions", "offline_history"]);

/** Compare business values without bookkeeping timestamps. @param {any} value @returns {string} */
function stableValue(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value) ?? "null";
    if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
    return `{${Object.keys(value).filter(key => !["updateDate", "checkTime", "lastCheckTime"].includes(key)).sort().map(key => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(",")}}`;
}
/** @param {string} key @param {any} value */
function records(key, value) {
    if (key === "new_video_decisions") return new Map(Object.entries(value || {}).map(([id, item]) => [id, stableValue(item)]));
    return new Map((Array.isArray(value) ? value : []).map(item => {
        const identity = typeof item === "object" && item !== null ? item.carNum ?? item.starId ?? item.id ?? stableValue(item) : item;
        return [String(identity).trim().toUpperCase(), stableValue(item)];
    }));
}
/** @param {string} key @param {any} before @param {any} after */
export function countBackupChanges(key, before, after) {
    const left = records(key, before), right = records(key, after);
    return [...new Set([...left.keys(), ...right.keys()])].filter(id => left.get(id) !== right.get(id)).length;
}

/** Collect only touched business tables inside one already serialized mutation. */
export class BackupChangeTracker extends EventTarget {
    /** @param {any} forage @param {any} coordinator */
    constructor(forage, coordinator) {
        super();
        this.forage = forage;
        this.coordinator = coordinator;
        this.enabled = false;
        this.needsBackup = false;
        this.recoveryToken = "";
        /** @type {{before: Map<string, any>, primary: Set<string> | null, failed: boolean} | null} */
        this.current = null;
    }
    begin() { this.current = this.enabled ? { before: new Map(), primary: null, failed: false } : null; }
    /** Called before a persisted write, so in-place changes to cached objects are safe. @param {string} key */
    async capture(key) {
        const current = this.current;
        if (!current || !BUSINESS_KEYS.has(key) || current.before.has(key)) return;
        try { current.before.set(key, structuredClone(await this.forage.getItem(key))); }
        catch { current.failed = true; }
    }
    /** StateService supplies the primary records; derived side effects do not count again. @param {string[]} ids */
    primary(ids) { if (this.current) this.current.primary = new Set(ids); }
    /** @param {boolean} succeeded */
    async finish(succeeded) {
        const current = this.current;
        this.current = null;
        if (!current || !current.before.size && !current.failed) return;
        try {
            let changed = 0;
            for (const [key, before] of current.before) changed += countBackupChanges(key, before, await this.forage.getItem(key));
            const count = succeeded ? current.primary?.size ?? changed : 0;
            if (!count && !current.failed && !(changed && !succeeded)) return;
            await this.updateWithoutLock(state => {
                state.totalRevision += count;
                if (current.failed || !succeeded) { state.needsBackup = true; state.recoveryToken = crypto.randomUUID(); }
            });
        } catch {
            this.needsBackup = true;
            this.recoveryToken = crypto.randomUUID();
            try { await this.updateWithoutLock(state => { state.needsBackup = true; state.recoveryToken = this.recoveryToken; }); } catch { /* Retain the in-memory recovery flag. */ }
        }
        this.dispatchEvent(new Event("changes"));
    }
    async read() {
        const stored = await this.forage.getItem(AUTO_BACKUP_STATE_KEY);
        if (stored && stored.schema !== 1) throw new Error("自动备份状态版本不受支持，请保留本地数据并更新脚本");
        return stored || { schema: 1, sourceId: crypto.randomUUID(), totalRevision: 0, backedUpRevision: 0, lastSuccessAt: 0, retryAt: 0, failures: 0, verifiedRevision: "", error: "", cleanupError: "", paused: false, needsBackup: false };
    }
    /** Caller already owns the shared storage mutation lock. @param {(state: any) => void} mutate */
    async updateWithoutLock(mutate) {
        const state = await this.read();
        mutate(state);
        await this.forage.setItem(AUTO_BACKUP_STATE_KEY, state);
        return state;
    }
    /** @param {(state: any) => void} mutate */
    update(mutate) { return this.coordinator.runExclusive(() => this.updateWithoutLock(mutate)); }
}
