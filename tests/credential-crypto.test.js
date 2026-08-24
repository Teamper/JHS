import { describe, expect, it } from "vitest";
import { decryptCredential, decryptData, encryptCredential, encryptData } from "../src/core/credential-crypto.js";

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
});
