import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptCredential, decryptData, decryptPortableBackup, encryptCredential, encryptData, encryptPortableBackup, hasStoredEncryptedCredential, removeStoredEncryptedCredential, storeEncryptedCredential } from "../src/core/credential-crypto.js";

afterEach(() => vi.unstubAllGlobals());

describe("credential crypto", () => {
    it("round-trips encrypted data without exposing plaintext", async () => {
        const encrypted = await encryptData("secret-value");
        expect(encrypted).not.toContain("secret-value");
        await expect(decryptData(encrypted)).resolves.toBe("secret-value");
    });

    it("marks credentials once and preserves unencrypted compatibility values", async () => {
        const encrypted = await encryptCredential("token");
        expect(encrypted).toMatch(/^AES:/);
        await expect(encryptCredential(encrypted)).resolves.toBe(encrypted);
        await expect(decryptCredential(encrypted)).resolves.toBe("token");
        await expect(decryptCredential("legacy-token")).resolves.toBe("legacy-token");
    });

    it("decrypts a portable backup across installation secrets", async () => {
        const values = new Map([["jhs_credential_install_secret", "install-a"]]);
        vi.stubGlobal("localStorage", { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) });
        const encrypted = await encryptPortableBackup(JSON.stringify({ car_list: [{ carNum: "ABC-1" }] }));
        values.set("jhs_credential_install_secret", "install-b");
        await expect(decryptPortableBackup(encrypted)).resolves.toContain("ABC-1");
        await expect(decryptData(await encryptData("install-secret", "install-a"), "install-a")).resolves.toBe("install-secret");
    });

    it("keeps encrypted local credential storage behind the crypto boundary", async () => {
        const values = new Map();
        vi.stubGlobal("localStorage", {
            getItem: key => values.get(key) ?? null,
            setItem: (key, value) => values.set(key, value),
            removeItem: key => values.delete(key),
        });
        expect(hasStoredEncryptedCredential("auth")).toBe(false);
        await storeEncryptedCredential("auth", "secret-token");
        expect(hasStoredEncryptedCredential("auth")).toBe(true);
        expect(values.get("auth")).not.toContain("secret-token");
        await expect(decryptData(values.get("auth"))).resolves.toBe("secret-token");
        removeStoredEncryptedCredential("auth");
        expect(hasStoredEncryptedCredential("auth")).toBe(false);
    });
});
