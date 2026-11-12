// @ts-check
import { decryptData, encryptData } from "../core/credential-crypto.js";
export const CREDENTIAL_KEYS = Object.freeze({
    installationSecret: "jhs_credential_install_secret",
    webDavPassword: "jhs_webdav_password",
    javdbToken: "jhs_appAuthorization",
});

/** Same-realm fallback when Web Locks is unavailable. */
const connectionQueues = new Map();

export class CredentialService extends EventTarget {
    /** @param {{getValue: (key: string, fallback?: unknown) => unknown, setValue: (key: string, value: unknown) => unknown, removeValue: (key: string) => unknown, listValues?: () => any, listenValue?: (key: string, callback: () => void) => any, unlistenValue?: (listener: any) => void}} storage @param {Storage} [legacyStorage] */
    constructor(storage, legacyStorage = globalThis.localStorage) {
        super();
        this.storage = storage;
        this.legacyStorage = legacyStorage;
        this.listener = storage.listenValue?.(CREDENTIAL_KEYS.javdbToken, () => { void this.notifyChanged(CREDENTIAL_KEYS.javdbToken); });
        /** @type {Map<string, string>} */ this.cleanupValues = new Map();
        /** @type {Map<string, string>} */ this.cleanupTargets = new Map();
    }
    /** Read the legacy key without replacing shared key material. */
    async installationSecret() {
        return String(await this.storage.getValue(CREDENTIAL_KEYS.installationSecret, "") || this.legacyStorage?.getItem?.(CREDENTIAL_KEYS.installationSecret) || "x7k9p3");
    }
    generateSecret() { return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))); }

    /** 历史密文认证失败不能降格为明文。 @param {string} value @param {string} [secret] */
    async decodeLegacy(value, secret) {
        const payload = value.replace(/^AES:/, "");
        let candidate = value.startsWith("AES:");
        try { candidate ||= /^[A-Za-z0-9+/]+={0,2}$/.test(payload) && atob(payload).length >= 28; } catch {}
        if (!candidate) return value;
        return decryptData(payload, secret || await this.installationSecret());
    }

    /** @param {any} record @returns {Promise<string>} */
    async decode(record) {
        if (record && typeof record === "object") {
            if (record.schema === 2 && typeof record.id === "string" && record.deleted === true && !Object.hasOwn(record, "secret") && !Object.hasOwn(record, "ciphertext")) return "";
            if (record.schema !== 2 || typeof record.id !== "string" || typeof record.secret !== "string" || typeof record.ciphertext !== "string") throw new Error("凭证格式无效");
            return decryptData(record.ciphertext, record.secret, false);
        }
        const value = String(record || "");
        if (!value) return "";
        return this.decodeLegacy(value);
    }
    /** @param {string} key @returns {Promise<string>} */
    async get(key) {
        try { return await this.decode(await this.storage.getValue(key, "")); }
        catch { return ""; }
    }
    /** Read the value and its non-secret revision from the same GM record. @param {string} key @returns {Promise<{exists: boolean, value: string, revision: string | null}>} */
    async readEntry(key) {
        const record = await this.storage.getValue(key, undefined);
        if (record !== undefined && typeof record !== "string" && (!record || typeof record !== "object")) throw new Error("凭证格式无效");
        const revision = record && typeof record === "object" && /** @type {any} */ (record).schema === 2 ? String(/** @type {any} */ (record).id || "") || null : null;
        return record === undefined ? { exists: false, value: "", revision: null } : { exists: true, value: await this.decode(record), revision };
    }
    /** Read immutable encrypted connection revisions, retaining concurrent branches. @param {string} key */
    async readVersioned(key) {
        const prefix = `${key}:revision:`;
        const nodes = [];
        for (const name of await this.storage.listValues?.() || []) {
            if (!name.startsWith(prefix)) continue;
            const entry = await this.readEntry(name);
            const node = JSON.parse(entry.value);
            const revision = name.slice(prefix.length);
            if (node.schema !== 1 || !Array.isArray(node.parents) || !node.parents.every((/** @type {any} */ parent) => parent === null || typeof parent === "string") || node.parents.includes(revision) || typeof node.value !== "string") {
                throw new Error("连接修订版本不受支持");
            }
            nodes.push({ ...node, revision });
        }
        if (!nodes.length) return this.readEntry(key);
        const parents = new Set(nodes.flatMap(node => node.parents));
        const heads = nodes.filter(node => !parents.has(node.revision));
        if (!heads.length) throw new Error("连接修订关系无效，原记录已保留");
        if (heads.length > 1) throw Object.assign(new Error("连接配置存在并发冲突，请选择保留的版本"), { code: "CONFIG_CONFLICT", candidates: heads });
        return { exists: true, value: heads[0].value, revision: heads[0].revision };
    }
    /** Compare inside the origin lock; immutable siblings preserve cross-origin races. @param {string} key @param {string} value @param {string | null | string[]} expected */
    async setVersioned(key, value, expected) {
        const save = async () => {
            let revisions;
            try {
                const entry = await this.readVersioned(key);
                revisions = [entry.revision];
            } catch (error) {
                if (!Array.isArray(expected) || /** @type {any} */ (error)?.code !== "CONFIG_CONFLICT") throw error;
                revisions = /** @type {any} */ (error).candidates.map((/** @type {any} */ node) => node.revision);
            }
            const parents = Array.isArray(expected) ? expected : [expected];
            if (JSON.stringify([...revisions].sort()) !== JSON.stringify([...parents].sort())) {
                throw Object.assign(new Error("连接已被其他页面修改，当前草稿已保留"), { code: "CONFIG_CONFLICT" });
            }
            const revision = crypto.randomUUID();
            await this.set(`${key}:revision:${revision}`, JSON.stringify({ schema: 1, parents, value }));
            // The immutable revision is authoritative if the compatibility mirror fails.
            try { await this.set(key, value); }
            catch { await this.notifyChanged(key); }
            const current = await this.readVersioned(key);
            if (current.revision !== revision) throw Object.assign(new Error("连接配置已变化，请重新读取"), { code: "CONFIG_CONFLICT" });
            return current;
        };
        const locks = /** @type {any} */ (globalThis.navigator?.locks);
        if (locks?.request) return locks.request(`jhs_connection:${key}`, save);
        const pending = (connectionQueues.get(key) || Promise.resolve()).catch(() => {}).then(save);
        connectionQueues.set(key, pending);
        try { return await pending; }
        finally { if (connectionQueues.get(key) === pending) connectionQueues.delete(key); }
    }
    /** Notifications never contain the credential value. @param {string} key */
    async notifyChanged(key) {
        try {
            const record = /** @type {any} */ (await this.storage.getValue(key, undefined));
            this.dispatchEvent(new CustomEvent("credentials.changed", { detail: { key, revision: record?.schema === 2 ? record.id : null } }));
        } catch { /* A successful credential write must keep its result. */ }
    }
    dispose() { if (this.listener != null) this.storage.unlistenValue?.(this.listener); }
    /** Replace explicitly supplied credentials, restoring the protected original record if the related operation fails. Caller serializes access to this key. @template T @param {string} key @param {string} value @param {() => Promise<T>} operation @returns {Promise<T>} */
    async replaceWithRollback(key, value, operation) {
        const previous = await this.storage.getValue(key, undefined);
        try {
            await this.set(key, value);
            return await operation();
        } catch (error) {
            try {
                if (previous === undefined) await this.storage.removeValue(key);
                else await this.storage.setValue(key, previous);
                if (JSON.stringify(await this.storage.getValue(key, undefined)) !== JSON.stringify(previous)) throw new Error("凭证恢复回读校验失败");
            } catch (rollbackError) {
                throw new AggregateError([error, rollbackError], "凭证保存失败，原记录恢复失败，请重新保存连接信息");
            }
            throw error;
        }
    }
    /** @param {string} key @param {string} value */
    async set(key, value, options = /** @type {{assertActive?: () => void}} */ ({})) {
        options.assertActive?.();
        const plaintext = String(value || "");
        if (!plaintext) { await this.remove(key); return ""; }
        const secret = this.generateSecret();
        const record = { schema: 2, id: crypto.randomUUID(), secret, ciphertext: await encryptData(plaintext, secret) };
        options.assertActive?.();
        await this.storage.setValue(key, record);
        const actual = await this.storage.getValue(key, "");
        if (JSON.stringify(actual) !== JSON.stringify(record) || await this.decode(actual) !== plaintext) throw new Error("凭证存储回读校验失败");
        await this.notifyChanged(key);
        return plaintext;
    }
    /** @param {string} key */
    async remove(key) {
        const record = { schema: 2, id: crypto.randomUUID(), deleted: true };
        await this.storage.setValue(key, record);
        const actual = await this.storage.getValue(key, "");
        if (JSON.stringify(actual) !== JSON.stringify(record) || await this.decode(actual) !== "") throw new Error("凭证删除回读校验失败");
        await this.notifyChanged(key);
    }

    /** @param {any} settings @param {{deferCleanup?: boolean}} [options] */
    async migrateLegacy(settings, options = {}) {
        const legacySecret = this.legacyStorage?.getItem?.(CREDENTIAL_KEYS.installationSecret) || "";
        const decodeLegacy = (/** @type {string} */ value) => this.decodeLegacy(value, legacySecret);
        const issues = [];
        /** @type {Record<string, string>} */ const settingValues = {};
        /** @type {string[]} */ const pageKeys = [];
        const snapshot = settings?.snapshot?.() || {};
        const token = this.legacyStorage?.getItem?.(CREDENTIAL_KEYS.javdbToken) || "";
        const password = String(snapshot.webDavPassword || "");
        for (const [key, source] of [[CREDENTIAL_KEYS.javdbToken, token], [CREDENTIAL_KEYS.webDavPassword, password]]) {
            let stored;
            try { stored = await this.storage.getValue(key, ""); }
            catch { issues.push({key, code:"CREDENTIAL_MIGRATION_READ_FAILED"}); continue; }
            if (!stored && !source) continue;
            if (stored && typeof stored === "object" && (key === CREDENTIAL_KEYS.javdbToken || !source || /** @type {any} */ (stored).deleted === true)) continue;
            let value, sourceValue;
            try {
                value = stored ? await this.decode(stored) : await decodeLegacy(source);
                if (stored && typeof stored === "string" && key === CREDENTIAL_KEYS.javdbToken) value = await decodeLegacy(value);
                sourceValue = source ? await decodeLegacy(source) : "";
            } catch {
                issues.push({ key, code: "LEGACY_CREDENTIAL_UNREADABLE" });
                continue;
            }
            try { if (!stored || typeof stored === "string") await this.set(key, value); }
            catch { issues.push({key, code:"CREDENTIAL_MIGRATION_WRITE_FAILED"}); continue; }
            // Different origins may have different legacy values; preserve conflicts.
            if (source && value === sourceValue && await this.get(key) === value) {
                this.cleanupTargets.set(key, value);
                if (key === CREDENTIAL_KEYS.webDavPassword) settingValues.webDavPassword = source;
            }
        }
        const cleanup = await this.validateLegacyCleanup({ settingKeys: Object.keys(settingValues), settingValues, pageKeys });
        if (!options.deferCleanup) {
            if (cleanup.settingKeys.length && settings?.update) await settings.update((/** @type {Record<string, unknown>} */ draft) => {
                for (const key of cleanup.settingKeys) if (draft[key] === settingValues[key]) delete draft[key];
            });
            await this.cleanupLegacyPageStorage(cleanup.pageKeys, settings);
        }
        return { migrated: Boolean(token || password || legacySecret), cleanup, issues };
    }
    /** Revalidate destinations immediately before the deferred settings cleanup. @param {any} cleanup */
    async validateLegacyCleanup(cleanup) {
        /** @type {string[]} */
        const settingKeys = [];
        if (!globalThis.navigator?.locks?.request) return { ...cleanup, settingKeys };
        for (const key of cleanup.settingKeys || []) {
            if (key === "webDavPassword" && this.cleanupTargets.has(CREDENTIAL_KEYS.webDavPassword) && await this.get(CREDENTIAL_KEYS.webDavPassword) === this.cleanupTargets.get(CREDENTIAL_KEYS.webDavPassword)) settingKeys.push(key);
        }
        return { ...cleanup, settingKeys };
    }
    /** 保留不可原子比较删除的页面旧源及其密钥，仅释放本次迁移的内存凭证。 */
    async cleanupLegacyPageStorage(/** @type {string[]} */ keys = [], /** @type {any} */ settings = null) {
        this.cleanupValues.clear();
        this.cleanupTargets.clear();
    }
}
