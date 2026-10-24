// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import jquery from "jquery";
import { JavDbHostAdapter } from "../src/platform/hosts/javdb-host-adapter.js";
import { initializeRuntimeConstants } from "../src/core/constants.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListPageCompatibilityService } from "../src/features/list/list-compatibility-service.js";

const html = readFileSync(join(import.meta.dirname, "fixtures/javdb-detail-actors.html"), "utf8");
afterEach(() => { initializeRuntimeConstants(new URL("https://example.test/")); vi.unstubAllGlobals(); });

describe("JavDB movie actors", () => {
    it("reads modern and legacy explicit roles, deduplicates identities and preserves unknown roles", () => {
        document.body.innerHTML = html;
        const host = new JavDbHostAdapter(document, new URL("https://javdb.com/v/movie"));
        const { actors, panel } = host.readMovieActors();
        expect(actors.map(({ name, starId, role, url }) => ({ name, starId, role, url }))).toEqual([
            { name: "演员甲", starId: "alpha", role: "actress", url: "https://javdb.com/actors/alpha" },
            { name: "演员乙", starId: "beta", role: "actor", url: "https://javdb.com/actors/beta" },
            { name: "未知演员", starId: "unknown", role: "unknown", url: "https://javdb.com/actors/unknown" },
            { name: "旧演员", starId: "legacy", role: "actress", url: "https://javdb.com/actors/legacy" },
            { name: "旧男演员", starId: null, role: "actor", url: null },
            { name: "旧演员纯文本", starId: null, role: "actress", url: null },
        ]);
        expect(panel).toBe(document.querySelector("#cast"));
        expect(actors[0].link).toBe(document.querySelector(".actor-female"));
        expect(actors[4].link).toBeNull();
    });

    it("returns only serializable explicit actor strings in movie information", () => {
        document.body.innerHTML = html;
        const info = new JavDbHostAdapter(document, new URL("https://javdb.com/v/movie")).readMovieInfo();
        expect(info).toMatchObject({ actress: "演员甲 旧演员 旧演员纯文本", actors: "演员乙 旧男演员" });
        expect(JSON.parse(JSON.stringify(info))).toEqual(info);
    });

    it("reads a detached detail using its supplied base without leaking live-page actors", () => {
        document.body.innerHTML = '<a class="actor-female" href="/actors/live">Live</a>';
        const detached = new DOMParser().parseFromString('<div class="panel-block"><strong>演员:</strong><a class="actor-female" href="/actors/remote">Remote</a></div>', "text/html");
        const parsed = new JavDbHostAdapter(document, new URL("https://javdb.com/v/live")).readMovieActors(detached, "https://javdb.example/v/remote");
        expect(parsed.actors.map(({ name, url }) => ({ name, url }))).toEqual([{ name: "Remote", url: "https://javdb.example/actors/remote" }]);
    });

    it("supplements fetched detail names from the same modern and legacy actor contract", async () => {
        initializeRuntimeConstants(new URL("https://javdb.com/"));
        const scope = new LifecycleScope("actor-detail"), host = new JavDbHostAdapter(document, new URL("https://javdb.com/"));
        const list = new ListPageCompatibilityService({ runtimeServices: {
            legacyStorage: { getSetting: async () => "yes" }, host,
            http: { request: async () => ({ data: html }) }, logger: { debug() {} },
        } });
        try { expect(await list.parseActressName("https://javdb.com/v/remote", scope)).toBe("演员甲 旧演员 旧演员纯文本"); }
        finally { scope.dispose(); }
    });

    it("keeps the JavBus fetched-detail name behavior", async () => {
        initializeRuntimeConstants(new URL("https://www.javbus.com/"));
        const scope = new LifecycleScope("javbus-actor-detail");
        const list = new ListPageCompatibilityService({ runtimeServices: {
            legacyStorage: { getSetting: async () => "yes" },
            http: { request: async () => ({ data: '<span onmouseover="star_1"><a>演员丙</a></span><span onmouseover="star_2"><a>演员丁</a></span>' }) }, logger: { debug() {} },
        } });
        vi.stubGlobal("utils", { htmlTo$dom: (source) => jquery(new DOMParser().parseFromString(source, "text/html")) });
        vi.stubGlobal("$", jquery);
        try { expect(await list.parseActressName("https://www.javbus.com/ABC-123", scope)).toBe("演员丙 演员丁"); }
        finally { scope.dispose(); }
    });
});
