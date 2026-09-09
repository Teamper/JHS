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
    it("keeps legacy ciphertext and its key when the destination becomes unreadable before cleanup", async () => {
        const source = await encryptData("old-password", "old-key"), legacy = new Map([[CREDENTIAL_KEYS.installationSecret, "old-key"]]);
        const settings = { snapshot: () => ({ webDavPassword: source }) }, storage = createStorage();
        const service = new CredentialService(storage, { getItem: key => legacy.get(key) || null, removeItem: key => legacy.delete(key) });
        const migration = await service.migrateLegacy(settings, { deferCleanup: true });
        storage.data.get(CREDENTIAL_KEYS.webDavPassword).secret = "wrong-key";
        expect((await service.validateLegacyCleanup(migration.cleanup)).settingKeys).toEqual([]);
        await service.cleanupLegacyPageStorage(migration.cleanup.pageKeys, settings);
        expect(legacy.get(CREDENTIAL_KEYS.installationSecret)).toBe("old-key");
    });
    it("retains a legacy settings password if GM writes do not persist", async () => {
        const storage = createStorage(), settings = { snapshot: () => ({ webDavPassword: "old-password" }), unset: vi.fn() };
        storage.setValue.mockImplementation(() => {});
        const service = new CredentialService(storage, { getItem: () => null });
        expect((await service.migrateLegacy(settings)).issues).toContainEqual({key:CREDENTIAL_KEYS.webDavPassword,code:"CREDENTIAL_MIGRATION_WRITE_FAILED"});
        expect(settings.unset).not.toHaveBeenCalled();
    });
    it("does not remove a legacy token changed after migration", async () => {
        const legacy = new Map([[CREDENTIAL_KEYS.javdbToken, "old-token"]]);
        const service = new CredentialService(createStorage(), { getItem: key => legacy.get(key) || null, removeItem: key => legacy.delete(key) });
        const result = await service.migrateLegacy({ snapshot: () => ({}) }, { deferCleanup: true });
        legacy.set(CREDENTIAL_KEYS.javdbToken, "new-token");
        await service.cleanupLegacyPageStorage(result.cleanup.pageKeys);
        expect(legacy.get(CREDENTIAL_KEYS.javdbToken)).toBe("new-token");
    });
    it("round trips AES-prefixed plaintext without sharing an installation key", async () => {
        const storage = createStorage(), service = new CredentialService(storage, { getItem: () => null });
        await service.set(CREDENTIAL_KEYS.webDavPassword, "AES:literal-password");
        storage.data.set(CREDENTIAL_KEYS.installationSecret, "another-tab-key");
        expect(await service.get(CREDENTIAL_KEYS.webDavPassword)).toBe("AES:literal-password");
    });

    it("keeps concurrently migrated credentials decryptable across instances", async () => {
        const storage = createStorage();
        const services = [0, 1].map(() => new CredentialService(storage, { getItem: () => null }));
        await Promise.allSettled(services.map(service => service.migrateLegacy({ snapshot: () => ({ webDavPassword: "shared-password" }) }, { deferCleanup: true })));
        expect(await services[0].get(CREDENTIAL_KEYS.webDavPassword)).toBe("shared-password");
        expect(await services[1].get(CREDENTIAL_KEYS.webDavPassword)).toBe("shared-password");
    });

    it("detects a failed credential deletion", async () => {
        const storage = createStorage(), service = new CredentialService(storage, { getItem: () => null });
        await service.set(CREDENTIAL_KEYS.webDavPassword, "password");
        storage.setValue.mockImplementation(() => {});
        await expect(service.set(CREDENTIAL_KEYS.webDavPassword, "")).rejects.toThrow();
    });
    it("removes secret material atomically and leaves a verified tombstone", async () => {
        const storage = createStorage(), service = new CredentialService(storage, { getItem: () => null, removeItem: vi.fn() });
        await service.set(CREDENTIAL_KEYS.webDavPassword, "secret");
        await expect(service.get(CREDENTIAL_KEYS.webDavPassword)).resolves.toBe("secret");
        expect(storage.data.get(CREDENTIAL_KEYS.webDavPassword)).toMatchObject({ schema: 2, ciphertext: expect.any(String), secret: expect.any(String) });
        await service.remove(CREDENTIAL_KEYS.webDavPassword);
        expect(storage.data.get(CREDENTIAL_KEYS.webDavPassword)).toEqual({ schema: 2, id: expect.any(String), deleted: true });
        expect(await service.get(CREDENTIAL_KEYS.webDavPassword)).toBe("");
    });

    it("migrates legacy values only after destination reads succeed", async () => {
        const legacy = new Map([[CREDENTIAL_KEYS.installationSecret, "legacy-secret"], [CREDENTIAL_KEYS.javdbToken, "legacy-token"]]);
        const storage = createStorage(), legacyStorage = { getItem: (key) => legacy.get(key) || null, removeItem: (key) => legacy.delete(key) };
        const settings = { snapshot: () => ({ webDavPassword: "legacy-password" }), unset: vi.fn(async () => {}) };
        const service = new CredentialService(storage, legacyStorage);
        await service.migrateLegacy(settings);
        expect(storage.data.has(CREDENTIAL_KEYS.installationSecret)).toBe(false);
        expect(await service.get(CREDENTIAL_KEYS.javdbToken)).toBe("legacy-token");
        expect(legacy.get(CREDENTIAL_KEYS.javdbToken)).toBe("legacy-token");
        expect(settings.unset).not.toHaveBeenCalled();
    });

    it("supports deferred cleanup for the bootstrap single-settings transaction", async () => {
        const legacy = new Map([[CREDENTIAL_KEYS.installationSecret, "legacy-secret"], [CREDENTIAL_KEYS.javdbToken, "legacy-token"]]);
        const storage = createStorage(), legacyStorage = { getItem: (key) => legacy.get(key) || null, removeItem: vi.fn((key) => legacy.delete(key)) };
        const settings = { snapshot: () => ({ webDavPassword: "legacy-password" }), unset: vi.fn(async () => {}) };
        const service = new CredentialService(storage, legacyStorage), result = await service.migrateLegacy(settings, { deferCleanup: true });
        expect(settings.unset).not.toHaveBeenCalled();
        expect(legacy.has(CREDENTIAL_KEYS.javdbToken)).toBe(true);
        await service.cleanupLegacyPageStorage(result.cleanup.pageKeys);
        expect(legacy.has(CREDENTIAL_KEYS.javdbToken)).toBe(true);
        expect(legacyStorage.removeItem).not.toHaveBeenCalled();
    });

    it("decrypts the unprefixed 6.4.1 AES-GCM token before re-encrypting it", async () => {
        const legacyCiphertext = await encryptData("header.payload.signature", "x7k9p3");
        const legacy = new Map([[CREDENTIAL_KEYS.javdbToken, legacyCiphertext]]);
        const storage = createStorage(), legacyStorage = { getItem: key => legacy.get(key) || null, removeItem: key => legacy.delete(key) };
        const service = new CredentialService(storage, legacyStorage);
        await service.migrateLegacy({ snapshot: () => ({}) });
        await expect(service.get(CREDENTIAL_KEYS.javdbToken)).resolves.toBe("header.payload.signature");
        expect(storage.data.get(CREDENTIAL_KEYS.javdbToken)).toMatchObject({ schema: 2 });
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

    it("retains ambiguous AES-marked legacy values without storing ciphertext as a password", async () => {
        const value = "AES:not-a-valid-ciphertext", legacy = new Map([[CREDENTIAL_KEYS.javdbToken, value]]), storage = createStorage();
        const service = new CredentialService(storage, { getItem: key => legacy.get(key) || null, removeItem: key => legacy.delete(key) });
        const result = await service.migrateLegacy({ snapshot: () => ({}) });
        expect(result.issues).toHaveLength(1);
        expect(legacy.get(CREDENTIAL_KEYS.javdbToken)).toBe(value);
        expect(storage.data.has(CREDENTIAL_KEYS.javdbToken)).toBe(false);
    });
    it("preserves a real ciphertext and key when legacy authentication fails", async () => {
        const cipher = await encryptData("real-password", "correct-key"), storage = createStorage();
        const source = { webDavPassword: cipher }, settings = { snapshot: () => source, update: vi.fn() };
        const service = new CredentialService(storage, { getItem: () => "wrong-key", removeItem: vi.fn() });
        expect((await service.migrateLegacy(settings)).issues.length).toBeGreaterThan(0);
        expect(source.webDavPassword).toBe(cipher);
        expect(storage.data.has(CREDENTIAL_KEYS.webDavPassword)).toBe(false);
        expect(settings.update).not.toHaveBeenCalled();
    });
    it("never resurrects cleared credentials from retained sources after a fresh instance starts", async () => {
        const storage = createStorage(), legacy = { getItem: key => key === CREDENTIAL_KEYS.javdbToken ? "old-token" : null };
        const settings = { snapshot: () => ({ webDavPassword: "old-password" }) };
        const first = new CredentialService(storage, legacy);
        await first.migrateLegacy(settings);
        await first.remove(CREDENTIAL_KEYS.javdbToken); await first.set(CREDENTIAL_KEYS.webDavPassword, "");
        const second = new CredentialService(storage, legacy);
        await second.migrateLegacy(settings);
        expect(await second.get(CREDENTIAL_KEYS.javdbToken)).toBe("");
        expect(await second.get(CREDENTIAL_KEYS.webDavPassword)).toBe("");
        await second.set(CREDENTIAL_KEYS.webDavPassword, "AES:new-password");
        await second.migrateLegacy(settings);
        expect(await second.get(CREDENTIAL_KEYS.webDavPassword)).toBe("AES:new-password");
    });
    it("cleans a settings source only through a fresh transactional comparison", async () => {
        vi.stubGlobal("navigator", {locks:{request: async (_name, fn) => fn()}});
        const source = { webDavPassword: "old-password" }, storage = createStorage();
        const settings = { snapshot: () => ({ ...source }), update: async mutator => { source.webDavPassword = "new-password"; mutator(source); } };
        const service = new CredentialService(storage, { getItem: () => null });
        await service.migrateLegacy(settings);
        expect(source.webDavPassword).toBe("new-password");
        expect(await service.get(CREDENTIAL_KEYS.webDavPassword)).toBe("old-password");
        vi.unstubAllGlobals();
    });
    it("does not re-decode retained token sources on subsequent startup", async () => {
        const storage = createStorage(), legacy = { getItem: key => key === CREDENTIAL_KEYS.javdbToken ? "old-token" : null };
        const first = new CredentialService(storage, legacy);
        await first.migrateLegacy({ snapshot: () => ({}) });
        const second = new CredentialService(storage, legacy), decode = vi.spyOn(second, "decodeLegacy");
        await second.migrateLegacy({ snapshot: () => ({}) });
        expect(decode).not.toHaveBeenCalled();
    });
    it("preserves both sources when independent migrations race with different values", async () => {
        const storage = createStorage(), sources=[new Map([[CREDENTIAL_KEYS.javdbToken,"first-token"]]),new Map([[CREDENTIAL_KEYS.javdbToken,"second-token"]])];
        const instances=sources.map(source=>new CredentialService(storage,{getItem:key=>source.get(key)||null,removeItem:key=>source.delete(key)}));
        await Promise.all(instances.map(service=>service.migrateLegacy({snapshot:()=>({})})));
        expect(["first-token","second-token"]).toContain(await instances[0].get(CREDENTIAL_KEYS.javdbToken));
        expect(sources.map(source=>source.get(CREDENTIAL_KEYS.javdbToken))).toEqual(["first-token","second-token"]);
    });
    it("keeps the source and continues when destination reads fail", async () => {
        const storage=createStorage(), source={webDavPassword:"old-password"};
        storage.getValue.mockImplementation(()=>{throw new Error("read failure");});
        const service=new CredentialService(storage,{getItem:()=>null});
        const result=await service.migrateLegacy({snapshot:()=>source});
        expect(result.issues).toContainEqual({key:CREDENTIAL_KEYS.webDavPassword,code:"CREDENTIAL_MIGRATION_READ_FAILED"});
        expect(source.webDavPassword).toBe("old-password"); expect(storage.setValue).not.toHaveBeenCalled();
    });
});
