// @ts-check

/** @type {Readonly<Record<string, string[]>>} */
const PREFERENCES = Object.freeze({
    jhs_enabled_sites: ["enabledExternalSites", "array"], jhs_selectedSites: ["imageSearchSelections", "object"],
    jhs_magnetHub_selectedEngine: ["magnetHubSelectedEngine", "string"], jhs_newVideoViewMode: ["newVideoViewMode", "string"],
    jhs_tag_expand: ["tagExpanded", "boolean"], jhs_img_cdn_index: ["actressAvatarSourceIndex", "number"],
});
const MIGRATED = "jhs_personal_preferences_migrated_v1";
/** Synchronous feature compatibility; all durable preference writes use SettingsService. */
export class PersonalPreferencesService {
    /** @param {any} settings @param {Storage} local @param {(message: string) => void} [onError] */
    constructor(settings, local, onError = () => {}) { this.settings = settings; this.local = local; this.onError = onError; this.migrated = local.getItem(MIGRATED) === "yes"; /** @type {Map<string, string>} */ this.pending = new Map(); }
    /** @param {string} key */
    owns(key) { return Object.hasOwn(PREFERENCES, key); }
    /** @param {string} key @param {string} raw */
    decode(key, raw) {
        const kind = PREFERENCES[key][1], value = kind === "string" ? raw : JSON.parse(raw);
        if (kind === "array" && !Array.isArray(value) || kind === "object" && (!value || typeof value !== "object" || Array.isArray(value)) || kind === "number" && (!Number.isInteger(value) || value < 0) || kind === "boolean" && typeof value !== "boolean") throw new Error("个性化设置格式无效");
        return value;
    }
    async migrate() {
        if (this.migrated) return;
        /** @type {Record<string, any>} */ const patch = {};
        for (const [key, [name]] of Object.entries(PREFERENCES)) {
            const raw = this.local.getItem(key);
            if (raw == null || Object.hasOwn(this.settings.snapshot(), name)) continue;
            try { patch[name] = this.decode(key, raw); } catch { /* Preserve invalid legacy values for recovery. */ }
        }
        if (Object.keys(patch).length) await this.settings.update((/** @type {any} */ draft) => { for (const [name, value] of Object.entries(patch)) if (!Object.hasOwn(draft, name)) draft[name] = value; });
        const snapshot = this.settings.snapshot();
        if (!Object.hasOwn(snapshot, "webDavSyncKeepCount") && ["yes", true].includes(snapshot.webDavAutoBackupEnabled)) {
            const count = Number(snapshot.webDavAutoBackupKeepCount);
            if (Number.isSafeInteger(count) && count > 0 && count <= 1e6) await this.settings.set("webDavSyncKeepCount", Math.max(3, count));
        }
        this.local.setItem?.(MIGRATED, "yes"); this.migrated = true;
    }
    /** @param {string} key @returns {string | null} */
    get(key) {
        if (this.pending.has(key)) return this.pending.get(key) ?? null;
        const [name, kind] = PREFERENCES[key], value = this.settings.snapshot()[name];
        return value === undefined ? this.migrated ? null : this.local.getItem(key) : kind === "string" ? String(value) : JSON.stringify(value);
    }
    /** @param {string} key @param {string} raw */
    set(key, raw) {
        const [name] = PREFERENCES[key], value = this.decode(key, raw);
        this.pending.set(key, raw);
        void this.settings.set(name, value).catch(() => this.onError("个性化设置保存失败，请重试")).finally(() => { if (this.pending.get(key) === raw) this.pending.delete(key); });
    }
}
