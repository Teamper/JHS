import { describe, expect, it, vi } from "vitest";
import { CredentialService } from "../src/services/credential-service.js";
import { WebDavSharedProfile, SHARED_WEBDAV_KEY, WEBDAV_CANDIDATE_PREFIX } from "../src/services/webdav-shared-profile.js";
import { PersonalPreferencesService } from "../src/services/personal-preferences-service.js";
import { SettingsService } from "../src/services/settings-service.js";
import { WebDavService } from "../src/services/webdav-service.js";

function fixture() {
    const values = new Map(), storage = { getValue: (key, fallback) => values.has(key) ? structuredClone(values.get(key)) : fallback, setValue: (key, value) => values.set(key, structuredClone(value)), removeValue: key => values.delete(key), listValues: () => [...values.keys()] };
    const credential = new CredentialService(storage, { getItem: () => null });
    const profile = { url: "https://dav.test/dav", username: "synthetic", password: "synthetic-secret" };
    const make = (origin, legacy = profile) => new WebDavSharedProfile({ storage, credential, origin, readLegacy: async () => legacy });
    return { values, storage, credential, profile, make };
}
describe("encrypted shared WebDAV authority", () => {
    it("preserves the legacy partial-save API before a shared authority exists", async () => {
        const f = fixture(), a = f.make("https://javdb.com");
        await a.save({ password: "replacement" }); expect((await a.snapshot()).profile).toEqual({ ...f.profile, password: "replacement" });
    });
    it("concurrent explicit saves leave one complete winning profile without split credentials", async () => {
        const f = fixture(), a = f.make("https://javdb.com"), b = f.make("https://www.javbus.com");
        const left = { url: "https://left.test/dav", username: "left", password: "left-secret" }, right = { url: "https://right.test/dav", username: "right", password: "right-secret" };
        const results = await Promise.allSettled([a.save(left), b.save(right)]);
        expect(results.some(result => result.status === "fulfilled")).toBe(true);
        const winner = (await a.snapshot()).profile; expect([left, right]).toContainEqual(winner); expect((await b.snapshot()).profile).toEqual(winner);
    });
    it("automatically adopts a unique legacy candidate across sites, encrypted as one record", async () => {
        const f = fixture(), a = f.make("https://javdb.com"), b = f.make("https://www.javbus.com", {});
        await a.migrate(); await b.migrate();
        expect((await b.snapshot()).profile).toEqual(f.profile);
        expect(f.values.has(SHARED_WEBDAV_KEY)).toBe(false);
        expect(JSON.stringify([...f.values.values()])).not.toContain(f.profile.password);
        expect([...f.values.keys()]).toEqual([WEBDAV_CANDIDATE_PREFIX + encodeURIComponent("https://javdb.com")]);
    });
    it("pauses different legacy candidates until an explicit whole connection wins", async () => {
        const f = fixture(), a = f.make("https://javdb.com"), b = f.make("https://www.javbus.com", { ...f.profile, password: "other" });
        await a.migrate(); await b.migrate();
        await expect(a.snapshot()).rejects.toMatchObject({ code: "SYNC_PROFILE_CONFLICT" });
        await b.save(f.profile);
        expect((await a.snapshot()).profile).toEqual(f.profile);
    });
    it("clear tombstones beat late migration and partial saves cannot resurrect old passwords", async () => {
        const f = fixture(), a = f.make("https://javdb.com"), b = f.make("https://www.javbus.com");
        await a.migrate(); await a.save({ url: "", username: "", password: "" }); await b.migrate();
        expect(f.values.get(SHARED_WEBDAV_KEY)).toMatchObject({ deleted: true });
        expect((await b.snapshot()).profile).toEqual({ url: "", username: "", password: "" });
        await b.save({ url: "https://new.test/" });
        expect((await a.snapshot()).profile).toEqual({ url: "https://new.test", username: "", password: "" });
    });
    it("does not fall back to a legacy password when an explicit record cannot decrypt", async () => {
        const f = fixture(), a = f.make("https://javdb.com");
        f.values.set(SHARED_WEBDAV_KEY, { schema: 2, id: "bad", secret: "bad", ciphertext: "bad" });
        await expect(a.migrate()).rejects.toThrow(); await expect(a.snapshot()).rejects.toThrow();
        await expect(a.save({ username: "other" })).rejects.toThrow();
        await a.save(f.profile); expect((await a.snapshot()).profile).toEqual(f.profile);
    });
    it("keeps the shared address on password-only saves from a previously unconfigured site", async () => {
        const f = fixture(), shared = f.make("https://javdb.com"); await shared.save(f.profile);
        let stored = {};
        const settings = new SettingsService({ get: async () => stored, set: async (_key, value) => { stored = value; } }); await settings.load();
        const webdav = new WebDavService({}, f.credential, settings, "https://www.javbus.com"); webdav.sharedProfile = shared;
        await webdav.saveProfile({ password: "replacement" });
        expect((await shared.snapshot()).profile).toEqual({ ...f.profile, password: "replacement" });
    });
    it("never rolls back a concurrent winning shared save on a site settings failure", async () => {
        const f = fixture(), a = f.make("https://javdb.com"), b = f.make("https://www.javbus.com");
        const settings = new SettingsService({ get: async () => ({}), set: async () => { await b.save({ ...f.profile, username: "winner" }); throw new Error("quota"); } }); await settings.load();
        const webdav = new WebDavService({}, f.credential, settings); webdav.sharedProfile = a;
        await expect(webdav.saveProfile(f.profile)).rejects.toThrow("共享连接已保存");
        expect((await a.snapshot()).profile.username).toBe("winner");
    });
});
describe("personal preference migration", () => {
    it("migrates only missing preferences, preserves local layout, routes rapid writes through settings", async () => {
        let stored = { newVideoViewMode: "list", containerColumns: 2, webDavAutoBackupEnabled: "yes", webDavAutoBackupKeepCount: 1 };
        const settings = new SettingsService({ get: async () => structuredClone(stored), set: async (_key, value) => { stored = structuredClone(value); } }); await settings.load();
        const local = new Map([ ["jhs_newVideoViewMode", "grid"], ["jhs_enabled_sites", '["a","b"]'], ["jhs_tag_expand", "true"] ]);
        const localStorage = { getItem: key => local.get(key) ?? null, setItem: (key, value) => local.set(key, value) };
        const prefs = new PersonalPreferencesService(settings, localStorage);
        await prefs.migrate();
        expect(stored).toMatchObject({ newVideoViewMode: "list", enabledExternalSites: ["a", "b"], tagExpanded: true, containerColumns: 2, webDavSyncKeepCount: 3 });
        prefs.set("jhs_newVideoViewMode", "grid"); prefs.set("jhs_newVideoViewMode", "list");
        expect(prefs.get("jhs_newVideoViewMode")).toBe("list");
        await vi.waitFor(() => expect(stored.newVideoViewMode).toBe("list"));
        await settings.waitForIdle(); await settings.unset("newVideoViewMode");
        const restarted = new PersonalPreferencesService(settings, localStorage); await restarted.migrate();
        expect(restarted.get("jhs_newVideoViewMode")).toBeNull(); expect(stored).not.toHaveProperty("newVideoViewMode");
    });
});
