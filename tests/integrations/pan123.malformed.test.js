import { describe, expect, it } from "vitest";
import { createPan123Adapter } from "../../src/integrations/pan123/manifest.js";

const runtime = { now: () => new Date("2026-08-24T12:34:00.000Z"), nonce: () => 1 };

describe("pan123 malformed responses", () => {
    it("rejects invalid JSON and incomplete resolved resources", async () => {
        const invalidJson = createPan123Adapter({ request: async () => ({ status: 200, data: "not-json" }) }, runtime);
        await expect(invalidJson.resolve("magnet:test", { token: "secret" })).rejects.toMatchObject({ code: "PARSE_ERROR" });
        const missingFiles = createPan123Adapter({ request: async () => ({ status: 200, data: { code: 0, data: { list: [{ id: 1 }] } } }) }, runtime);
        await expect(missingFiles.resolve("magnet:test", { token: "secret" })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    });

    it("normalizes expired authorization and unavailable providers", async () => {
        const expired = createPan123Adapter({ request: async () => ({ status: 200, data: { code: 401, message: "token is expired" } }) }, runtime);
        await expect(expired.resolve("magnet:test", { token: "secret" })).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
        const unavailable = createPan123Adapter({ request: async () => { throw new Error("provider unavailable"); } }, runtime);
        await expect(unavailable.resolve("magnet:test", { token: "secret" })).rejects.toThrow("provider unavailable");
    });
});
