// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import jquery from "jquery";
import { JavBusHostAdapter } from "../src/platform/hosts/javbus-host-adapter.js";
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

    it("reads clean decoded actor profiles on JavDB and JavBus while filtering non-name metadata", () => {
        document.body.innerHTML = `
            <div class="actor-section">
                <h2 class="actor-section-name">三上悠亜 (無碼), 鬼頭桃菜<span class="jhs-actress-state-container"><span class="jhs-badge">已收藏</span></span></h2>
                <div class="section-meta">35部影片</div>
                <div class="section-meta">女優</div>
                <div class="section-meta">無碼</div>
                <div class="section-meta">1993-08-16 (33歲)</div>
                <div class="section-meta">159cm</div>
                <div class="section-meta">B83 / W59 / H88</div>
                <div class="section-meta">E罩杯</div>
                <div class="section-meta">鬼頭桃菜, 桜もこ (有码)<span class="jhs-badge">高分</span></div>
            </div>
        `;
        const javdb = new JavDbHostAdapter(document, new URL("https://javdb.com/actors/%E4%B8%89%E4%B8%8A%E6%82%A0%E4%BA%9C?t=d"));
        const dbProfile = javdb.readActorProfile();
        expect(dbProfile).toEqual({
            starId: "三上悠亜",
            name: "三上悠亜",
            names: ["三上悠亜", "鬼頭桃菜", "桜もこ"],
            actressType: "uncensored",
            anchorParent: document.querySelector(".actor-section"),
        });
        expect(Object.isFrozen(dbProfile)).toBe(true);
        expect(Object.isFrozen(dbProfile?.names)).toBe(true);

        document.body.innerHTML = `<div class="actor-section"><h2 class="actor-section-name">桃乃木かな</h2><div class="section-meta">有碼</div></div>`;
        expect(new JavDbHostAdapter(document, new URL("https://javdb.com/actors/db-censored")).readActorProfile()).toEqual({
            starId: "db-censored",
            name: "桃乃木かな",
            names: ["桃乃木かな"],
            actressType: "censored",
            anchorParent: document.querySelector(".actor-section"),
        });

        document.body.innerHTML = `
            <div class="avatar-box"><div class="photo-info">
                <span class="pb10">三上悠亜 (無碼)<span class="jhs-actress-state-container"><span class="jhs-badge">已收藏</span></span></span>
            </div></div>
        `;
        const javbus = new JavBusHostAdapter(document, new URL("https://www.javbus.com/uncensored/star/bus%2D1/2"));
        const busProfile = javbus.readActorProfile();
        expect(busProfile).toEqual({
            starId: "bus-1",
            name: "三上悠亜",
            names: ["三上悠亜"],
            actressType: "uncensored",
            anchorParent: document.querySelector(".photo-info"),
        });
        expect(Object.isFrozen(busProfile)).toBe(true);

        document.body.innerHTML = `<div class="avatar-box"><div class="photo-info"><span class="pb10">桃乃木かな</span></div></div>`;
        expect(new JavBusHostAdapter(document, new URL("https://www.javbus.com/star/bus-censored")).readActorProfile()).toEqual({
            starId: "bus-censored",
            name: "桃乃木かな",
            names: ["桃乃木かな"],
            actressType: "censored",
            anchorParent: document.querySelector(".photo-info"),
        });
    });
});
