import { describe, expect, it, vi } from "vitest";
import { CredentialService, CREDENTIAL_KEYS } from "../src/services/credential-service.js";
import { encryptCredential, encryptData } from "../src/core/credential-crypto.js";

function createStorage(values = {}) {
    const data = new Map(Object.entries(values));
    return {
        data,
        getValue: vi.fn((key, fallback) => data.has(key) ? data.get(key) : fallback),
        setValue: vi.fn((key, value) => data.set(key, value)),
        removeValue: vi.fn((key) => data.delete(key)),
    };
}

describe("CredentialService", () => {
    it("stores credentials in GM storage and removes them through the GM delete boundary", async () => {
        const storage = createStorage(), service = new CredentialService(storage, { getItem: () => null, removeItem: vi.fn() });
        await service.set(CREDENTIAL_KEYS.webDavPassword, "secret");
        await expect(service.get(CREDENTIAL_KEYS.webDavPassword)).resolves.toBe("secret");
        expect(storage.data.get(CREDENTIAL_KEYS.webDavPassword)).toMatch(/^AES:/);
        await service.remove(CREDENTIAL_KEYS.webDavPassword);
        expect(storage.data.has(CREDENTIAL_KEYS.webDavPassword)).toBe(false);
    });

    it("migrates legacy values only after destination reads succeed", async () => {
        const legacy = new Map([[CREDENTIAL_KEYS.installationSecret, "legacy-secret"], [CREDENTIAL_KEYS.javdbToken, "legacy-token"]]);
        const storage = createStorage(), legacyStorage = { getItem: (key) => legacy.get(key) || null, removeItem: (key) => legacy.delete(key) };
        const settings = { snapshot: () => ({ webDavPassword: "legacy-password" }), unset: vi.fn(async () => {}) };
        const service = new CredentialService(storage, legacyStorage);
        await service.migrateLegacy(settings);
        expect(storage.data.get(CREDENTIAL_KEYS.installationSecret)).toBe("legacy-secret");
        expect(await service.get(CREDENTIAL_KEYS.javdbToken)).toBe("legacy-token");
        expect(legacy.has(CREDENTIAL_KEYS.javdbToken)).toBe(false);
        expect(settings.unset).toHaveBeenCalledWith("webDavPassword");
    });

    it("supports deferred cleanup for the bootstrap single-settings transaction", async () => {
        const legacy = new Map([[CREDENTIAL_KEYS.installationSecret, "legacy-secret"], [CREDENTIAL_KEYS.javdbToken, "legacy-token"]]);
        const storage = createStorage(), legacyStorage = { getItem: (key) => legacy.get(key) || null, removeItem: vi.fn((key) => legacy.delete(key)) };
        const settings = { snapshot: () => ({ webDavPassword: "legacy-password" }), unset: vi.fn(async () => {}) };
        const service = new CredentialService(storage, legacyStorage), result = await service.migrateLegacy(settings, { deferCleanup: true });
        expect(settings.unset).not.toHaveBeenCalled();
        expect(legacy.has(CREDENTIAL_KEYS.javdbToken)).toBe(true);
        service.cleanupLegacyPageStorage(result.cleanup.pageKeys);
        expect(legacy.has(CREDENTIAL_KEYS.javdbToken)).toBe(false);
        expect(legacyStorage.removeItem).toHaveBeenCalledWith(CREDENTIAL_KEYS.javdbToken);
    });

    it("decrypts the unprefixed 6.4.1 AES-GCM token before re-encrypting it", async () => {
        const legacyCiphertext = await encryptData("header.payload.signature", "x7k9p3");
        const legacy = new Map([[CREDENTIAL_KEYS.javdbToken, legacyCiphertext]]);
        const storage = createStorage(), legacyStorage = { getItem: key => legacy.get(key) || null, removeItem: key => legacy.delete(key) };
        const service = new CredentialService(storage, legacyStorage);
        await service.migrateLegacy({ snapshot: () => ({}) });
        await expect(service.get(CREDENTIAL_KEYS.javdbToken)).resolves.toBe("header.payload.signature");
        expect(storage.data.get(CREDENTIAL_KEYS.javdbToken)).toMatch(/^AES:/);
    });

    it("repairs a previously migrated token that still contains a 6.4.1 ciphertext", async () => {
        const legacyCiphertext = await encryptData("header.payload.signature", "x7k9p3");
        const storage = createStorage({ [CREDENTIAL_KEYS.installationSecret]: "current-secret" });
        storage.data.set(CREDENTIAL_KEYS.javdbToken, await encryptCredential(legacyCiphertext, "current-secret"));
        const service = new CredentialService(storage, { getItem: () => null, removeItem: vi.fn() });
        await service.migrateLegacy({ snapshot: () => ({}) });
        await expect(service.get(CREDENTIAL_KEYS.javdbToken)).resolves.toBe("header.payload.signature");
    });

    it("keeps malformed legacy values as plaintext compatibility credentials", async () => {
        const legacy = new Map([[CREDENTIAL_KEYS.javdbToken, "legacy-token"]]);
        const service = new CredentialService(createStorage(), { getItem: key => legacy.get(key) || null, removeItem: key => legacy.delete(key) });
        await service.migrateLegacy({ snapshot: () => ({}) });
        await expect(service.get(CREDENTIAL_KEYS.javdbToken)).resolves.toBe("legacy-token");
    });

    it("keeps malformed AES-marked legacy values readable as plaintext", async () => {
        const value = "AES:not-a-valid-ciphertext", legacy = new Map([[CREDENTIAL_KEYS.javdbToken, value]]), storage = createStorage();
        const service = new CredentialService(storage, { getItem: key => legacy.get(key) || null, removeItem: key => legacy.delete(key) });
        await service.migrateLegacy({ snapshot: () => ({}) });
        await expect(service.get(CREDENTIAL_KEYS.javdbToken)).resolves.toBe(value);
        expect(storage.data.get(CREDENTIAL_KEYS.javdbToken)).toMatch(/^AES:/);
    });
});
