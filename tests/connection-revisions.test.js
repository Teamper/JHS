import { afterEach, expect, it, vi } from "vitest";
import { CredentialService } from "../src/services/credential-service.js";

afterEach(() => vi.unstubAllGlobals());
function fixture() {
    const values = new Map();
    const storage = { getValue: async (key, fallback) => values.get(key) ?? fallback, setValue: async (key, value) => { values.set(key, value); }, removeValue: async key => values.delete(key), listValues: async () => [...values.keys()] };
    return { values, first: new CredentialService(storage), second: new CredentialService(storage) };
}
it("reads legacy records, serializes local saves and rejects stale revisions", async () => {
    vi.stubGlobal("navigator", {});
    const f = fixture();
    await f.first.set("connections", "legacy");
    const baseline = await f.first.readVersioned("connections");
    await f.first.setVersioned("connections", "next", baseline.revision);
    await expect(f.first.setVersioned("connections", "stale", baseline.revision)).rejects.toMatchObject({ code: "CONFIG_CONFLICT" });
    expect((await f.first.readVersioned("connections")).value).toBe("next");
});
it("retains cross-origin branches and resolves only the explicitly selected revision set", async () => {
    vi.stubGlobal("navigator", { locks: { request: (_key, run) => run() } });
    const f = fixture();
    await Promise.allSettled([f.first.setVersioned("connections", "first", null), f.second.setVersioned("connections", "second", null)]);
    let conflict;
    try { await f.first.readVersioned("connections"); } catch (error) { conflict = error; }
    expect(conflict.code).toBe("CONFIG_CONFLICT");
    expect(conflict.candidates.map(node => node.value).sort()).toEqual(["first", "second"]);
    const revisions = conflict.candidates.map(node => node.revision);
    await f.first.setVersioned("connections", "first", revisions);
    expect((await f.second.readVersioned("connections")).value).toBe("first");
    expect([...f.values.keys()].filter(key => key.includes(":revision:"))).toHaveLength(3);
});
it("preserves unsupported connection revisions without overwriting them", async () => {
    const f = fixture();
    await f.first.set("connections:revision:future", JSON.stringify({ schema: 99 }));
    const before = structuredClone([...f.values]);
    await expect(f.first.setVersioned("connections", "replacement", null)).rejects.toThrow("不受支持");
    expect([...f.values]).toEqual(before);
});

it("serializes separate same-origin clients without Web Locks", async () => {
    vi.stubGlobal("navigator", {});
    const f = fixture();
    const results = await Promise.allSettled([f.first.setVersioned("connections", "first", null), f.second.setVersioned("connections", "second", null)]);
    expect(results.map(item => item.status)).toEqual(["fulfilled", "rejected"]);
    expect((await f.first.readVersioned("connections")).value).toBe("first");
});
