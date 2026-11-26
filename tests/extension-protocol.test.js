import { describe, it, expect } from "vitest";
import { pack, unpack, checkMessage, CHANNEL, unwrapResponse } from "../src/contracts/extension-protocol.js";
import { JhsError } from "../src/core/jhs-error.js";
import { RemoteSettings } from "../src/services/extension-settings-service.js";
import { SettingsService } from "../src/services/settings-service.js";

describe("extension messaging", () => {
    it("preserves domain values through Chrome JSON serialization", () => {
        const input = { missing: undefined, reserved: { $jhs: "map", value: "ordinary user data" }, map: new Map([["ABC-123", { flags: new Set(["favorite"]) }]]), bytes: new Uint8Array([0, 255]).buffer };
        const result = unpack(JSON.parse(JSON.stringify(pack(input))));
        expect(result).toEqual(input);
    });
    it("checks the message boundary", () => {
        expect(() => checkMessage({ channel: CHANNEL, id: "request", method: "state.patch", args: [] })).not.toThrow();
        expect(() => checkMessage({ channel: CHANNEL, id: "request", method: "state.patch", args: {} })).toThrow();
    });
    it("preserves request error classification across the message boundary", () => {
        expect(() => unwrapResponse({ ok: false, error: { code: "HOST_PERMISSION_REQUIRED", message: "source needs permission" } })).toThrow(JhsError);
        expect(unwrapResponse({ ok: true, value: pack(new Set(["movie"])) })).toEqual(new Set(["movie"]));
    });
    it("saves only changed settings while preserving unrelated concurrent edits", async () => {
        const data = new Map([["setting", { a: 1, b: 1 }]]);
        const settings = new SettingsService({ get: async key => data.get(key), set: async (key, value) => { data.set(key, value); } });
        const client = { call: async (method, args) => {
            if (method === "settings.read") return structuredClone(await settings.load());
            return settings.update(draft => {
                for (const [key, change] of Object.entries(args[0])) {
                    expect(draft[key]).toEqual(change.before);
                    if (change.exists) draft[key] = change.value;
                    else delete draft[key];
                }
            });
        } };
        const remote = new RemoteSettings(client);
        await remote.load();
        await settings.set("b", 2);
        await remote.set("a", 3);
        expect(data.get("setting")).toEqual({ a: 3, b: 2 });
        expect(remote.snapshot()).toEqual({ a: 3, b: 2 });
    });
});
