// @ts-check

import { decryptData, encryptCredential, encryptData } from "../core/credential-crypto.js";

export const CREDENTIAL_KEYS = Object.freeze({
    installationSecret: "jhs_credential_install_secret",
    webDavPassword: "jhs_webdav_password",
    javdbToken: "jhs_appAuthorization",
});

/**
 * Userscript-storage boundary for installation credentials. Legacy page storage
 * is only read during the idempotent migration and is never used at runtime.
 */
export class CredentialService {
    /** @param {{getValue: (key: string, fallback?: unknown) => unknown, setValue: (key: string, value: unknown) => unknown, removeValue: (key: string) => unknown}} storage @param {Storage} [legacyStorage] */
    constructor(storage, legacyStorage = globalThis.localStorage) {
        this.storage = storage;
        this.legacyStorage = legacyStorage;
    }

    /** @returns {Promise<string>} */
    async installationSecret() {
        const stored = await this.storage.getValue(CREDENTIAL_KEYS.installationSecret, "");
        if (stored) return String(stored);
        const legacy = this.legacyStorage?.getItem?.(CREDENTIAL_KEYS.installationSecret) || "";
        const secret = legacy || this.generateSecret();
        await this.storage.setValue(CREDENTIAL_KEYS.installationSecret, secret);
        const verified = await this.storage.getValue(CREDENTIAL_KEYS.installationSecret, "");
        if (String(verified || "") !== secret) throw new Error("凭证存储回读校验失败");
        return secret;
    }

    generateSecret() {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        let value = "";
        for (const byte of bytes) value += String.fromCharCode(byte);
        return btoa(value);
    }

    /** @param {string} key @returns {Promise<string>} */
    async get(key) {
        const encrypted = await this.storage.getValue(key, "");
        if (!encrypted) return "";
        const secret = await this.installationSecret();
        try { return await decryptData(String(encrypted).replace(/^AES:/, ""), secret); }
        catch { return String(encrypted).startsWith("AES:") ? "" : String(encrypted); }
    }

    /** @param {string} key @param {string} value */
    async set(key, value) {
        const secret = await this.installationSecret();
        const encrypted = await encryptCredential(String(value || ""), secret);
        if (encrypted) await this.storage.setValue(key, encrypted);
        else await this.storage.removeValue(key);
        const actual = await this.storage.getValue(key, "");
        if (encrypted && actual !== encrypted) throw new Error("凭证存储回读校验失败");
        return String(value || "");
    }

    /** @param {string} key */
    async remove(key) { await this.storage.removeValue(key); }

    /**
     * Move legacy page-storage credentials into GM storage.
     * @param {any} settings
     * @param {{deferCleanup?: boolean}} [options]
     */
    async migrateLegacy(settings, options = {}) {
        const legacySecret = this.legacyStorage?.getItem?.(CREDENTIAL_KEYS.installationSecret) || "";
        const currentSecret = await this.storage.getValue(CREDENTIAL_KEYS.installationSecret, "");
        const secret = String(currentSecret || legacySecret || this.generateSecret());
        if (!currentSecret) {
            await this.storage.setValue(CREDENTIAL_KEYS.installationSecret, secret);
            const verifiedSecret = String(await this.storage.getValue(CREDENTIAL_KEYS.installationSecret, ""));
            // A few test/host shims intentionally expose GM_setValue as a no-op;
            // a fresh install has nothing to migrate and may continue in-memory.
            if (verifiedSecret !== secret && (legacySecret || this.legacyStorage?.getItem?.(CREDENTIAL_KEYS.javdbToken) || this.legacyStorage?.getItem?.("webDavPassword"))) throw new Error("凭证迁移回读失败");
        }
        const decryptLegacyCandidate = async (/** @type {string} */ candidate) => {
            const encoded = String(candidate || "").replace(/^AES:/, "");
            if (!encoded) return null;
            try { return await decryptData(encoded, legacySecret || secret); }
            catch { return null; }
        };
        const repairNestedCredential = async (/** @type {string} */ key) => {
            const stored = await this.storage.getValue(key, "");
            if (!stored) return false;
            let outer;
            try { outer = await decryptData(String(stored).replace(/^AES:/, ""), secret); }
            catch { return false; }
            const inner = await decryptLegacyCandidate(outer);
            if (!inner || inner === outer) return false;
            await this.set(key, inner);
            return true;
        };
        const migrateValue = async (/** @type {string} */ key, /** @type {string} */ legacyValue) => {
            if (!legacyValue || await this.storage.getValue(key, "")) return;
            let value = legacyValue;
            const decrypted = await decryptLegacyCandidate(legacyValue);
            if (decrypted != null) value = decrypted;
            // Failed authentication means the legacy value is plaintext, even if it
            // happens to carry the historical AES marker; encrypt that raw value
            // under the current installation secret so runtime reads remain valid.
            const encrypted = decrypted != null || !String(value).startsWith("AES:")
                ? await encryptCredential(String(value), secret)
                : `AES:${await encryptData(String(value), secret)}`;
            await this.storage.setValue(key, encrypted);
            if (await this.storage.getValue(key, "") !== encrypted) throw new Error(`凭证迁移回读失败: ${key}`);
        };
        const legacyToken = this.legacyStorage?.getItem?.(CREDENTIAL_KEYS.javdbToken) || "";
        const repairedToken = await repairNestedCredential(CREDENTIAL_KEYS.javdbToken);
        await migrateValue(CREDENTIAL_KEYS.javdbToken, legacyToken);
        const snapshot = settings?.snapshot?.() || {};
        const legacyPassword = String(snapshot.webDavPassword || "");
        await migrateValue(CREDENTIAL_KEYS.webDavPassword, legacyPassword);
        const cleanup = Object.freeze({
            settingKeys: legacyPassword ? ["webDavPassword"] : [],
            pageKeys: [
                ...(legacyToken ? [CREDENTIAL_KEYS.javdbToken] : []),
                ...(legacySecret ? [CREDENTIAL_KEYS.installationSecret] : []),
            ],
        });
        if (!options.deferCleanup) {
            if (cleanup.settingKeys.length && settings?.unset) await settings.unset("webDavPassword");
            this.cleanupLegacyPageStorage(cleanup.pageKeys);
        }
        return { migrated: Boolean(legacyToken || legacyPassword || legacySecret || repairedToken), cleanup };
    }

    /** Remove legacy page-storage keys after the destination settings commit. */
    cleanupLegacyPageStorage(/** @type {string[]} */ keys = []) {
        for (const key of keys) this.legacyStorage?.removeItem?.(key);
    }
}
