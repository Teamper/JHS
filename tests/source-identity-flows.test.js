// @vitest-environment jsdom
import jquery from "jquery";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeRuntimeConstants } from "../src/core/constants.js";
import { readListItem } from "../src/core/list-item-reader.js";
import { JavDbHostAdapter } from "../src/platform/hosts/javdb-host-adapter.js";
import { JavBusHostAdapter } from "../src/platform/hosts/javbus-host-adapter.js";
import { createListEvaluationContext, evaluateListItem } from "../src/features/list/list-evaluator.js";
import { NewVideoScanController } from "../src/features/discovery/new-video-scan-controller.js";
import { DetailBrowseLifecycleController } from "../src/features/detail/detail-browse-lifecycle-controller.js";
import { DetailStateController } from "../src/core/detail-state-controller.js";
import { WantWatchImportController } from "../src/features/library/want-watch-import-controller.js";
import { aggregateNewVideoRecords } from "../src/features/discovery/new-video-workspace-controller.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListCardStatePresenter } from "../src/features/list/list-card-state-presenter.js";
import { ListNavigationController } from "../src/features/list/list-navigation-controller.js";

beforeEach(() => {
    vi.stubGlobal("$", jquery);
    initializeRuntimeConstants(new URL("https://javdb.com/"));
});
afterEach(() => { document.body.innerHTML = ""; vi.unstubAllGlobals(); });

function card(code, date = "2026-10-01") {
    return jquery(`<div class="item"><a href="/v/test"><div class="video-title"><strong>${code}</strong> title</div><div class="meta">${date}</div></a></div>`);
}

describe("source movie identity safety", () => {
    it("keeps a numberless card navigable and continues presenting later cards", async () => {
        const missing = card(""), valid = card("ABC-123");
        document.body.append(missing[0], valid[0]);
        const context = createListEvaluationContext({carMap:new Map([["ABC-123",{stateFlags:{favorite:true}}]])});
        const presenter = new ListCardStatePresenter({hostAdapter:{site:"javdb"},document,readCardIdentity:readListItem});
        await expect(presenter.processItems([missing[0],valid[0]],{context,filter:"all",isCurrent:()=>true})).resolves.toHaveLength(2);
        expect(JSON.parse(valid.attr("data-jhs-flags")).favorite).toBe(true);
        const openPage = vi.fn();
        const navigation = new ListNavigationController({hostAdapter:{location:new URL("https://javdb.com/")},list:{findCarNumAndHref:readListItem},ui:{jquery,openPage}});
        navigation.openMovieDetail(missing[0]);
        expect(openPage).toHaveBeenCalledWith("https://javdb.com/v/test","",true,expect.anything());
        expect(readListItem(missing).stateEligibility).toEqual({eligible:false,reason:"missing"});
    });
    it("keeps studio labels navigable but never makes their dates into a state key", () => {
        const a = readListItem(card("Studio Name")), b = readListItem(card("Studio Name", "2026-10-02"));
        expect(a.carNum).toBe("STUDIO-NAME"); expect(b.carNum).toBe(a.carNum);
        expect(a.stateEligibility).toEqual({ eligible: false, reason: "label-only" });
        expect(b.stateEligibility).toEqual(a.stateEligibility);
        expect(a.url).toBe("/v/test");
    });

    it.each(["HEYZO1234", "FC2-PPV-1234567", "ABC-123"])("keeps the existing full number %s eligible", value => {
        expect(readListItem(card(value)).stateEligibility).toEqual({ eligible: true, reason: null });
    });

    it("prefers native number facts and refuses a conflicting URL hint", () => {
        document.body.innerHTML = '<main class="video-detail"><a title="复制番号" data-clipboard-text="ABC-123"></a></main>';
        const host = new JavDbHostAdapter(document, { href: "https://javdb.com/v/test?jhsCarNum=XYZ-999" });
        expect(host.readMovieRef()).toMatchObject({ carNum: "ABC-123", stateEligibility: { eligible: false, reason: "conflicting" } });
    });
    it("ignores recommendation card identities when checking detail evidence", () => {
        document.body.innerHTML = '<main class="video-detail"><a title="复制番号" data-clipboard-text="ABC-123"></a><section class="movie-list"><div class="item"><div class="video-title"><strong>REC-1</strong></div></div></section></main>';
        const host = new JavDbHostAdapter(document,new URL("https://javdb.com/v/real"));
        expect(host.readMovieRef()).toMatchObject({carNum:"ABC-123",stateEligibility:{eligible:true,reason:null}});
    });
    it("marks contradictory actor-page source numbers incomplete before scanning", () => {
        const host = new JavDbHostAdapter(document,new URL("https://javdb.com/actors/real"));
        const items = host.parseActorMovies('<div class="movie-list"><div class="item"><a href="/v/a"><div class="video-title"><strong>ABC-123</strong><strong>XYZ-456</strong></div></a></div></div>',"https://javdb.com");
        expect(items[0]).toMatchObject({carNum:"ABC-123",stateEligibility:{eligible:false,reason:"conflicting"}});
    });
    it("rejects contradictory native card numbers instead of concatenating them", () => {
        const item = card("ABC-123");
        item.find(".video-title").append("<strong>XYZ-456</strong>");
        expect(readListItem(item)).toMatchObject({ carNum: "ABC-123", stateEligibility: {eligible: false, reason: "conflicting"} });
    });

    it("compares JavBus's native labeled number with its path", () => {
        document.body.innerHTML = '<div class="info"><p><span class="header">識別碼:</span> XYZ-456</p></div>';
        const host = new JavBusHostAdapter(document, new URL("https://www.javbus.com/ABC-123"));
        expect(host.readMovieRef()).toMatchObject({carNum:"XYZ-456",stateEligibility:{eligible:false,reason:"conflicting"}});
    });

    it("rechecks late detail identity without letting an enabled hint override native evidence", async () => {
        document.body.innerHTML = '<button id="favoriteBtn"><span>收藏</span></button>';
        let source = {carNum:"ABC-123",stateEligibility:{eligible:false,reason:"conflicting"}};
        const toggle = vi.fn(), readState = vi.fn(async () => ({}));
        const controller = new DetailStateController({toggle}, {jquery,readState,reportError:vi.fn(),logError:vi.fn(),closePage:vi.fn()});
        const config = controller.bind({root:document,carNum:"ABC-123",getRecord:()=>source});
        await controller.render(config);
        await controller.requestToggle(config,"favorite");
        expect(readState).not.toHaveBeenCalled(); expect(toggle).not.toHaveBeenCalled();
        source = {carNum:"XYZ-456",stateEligibility:{eligible:true,reason:null}};
        await controller.render(config);
        expect(jquery("#favoriteBtn").prop("disabled")).toBe(false);
        await controller.requestToggle(config,"favorite");
        expect(toggle).toHaveBeenCalledWith("XYZ-456","favorite",expect.anything());
    });
    it("does not fall back to a stale bound number after native evidence disappears", async () => {
        document.body.innerHTML = '<button id="favoriteBtn"><span>收藏</span></button>';
        const toggle = vi.fn(), readState = vi.fn(async () => ({}));
        const controller = new DetailStateController({toggle},{jquery,readState,reportError:vi.fn(),logError:vi.fn()});
        const config = {root:document,carNum:"ABC-123",getRecord:()=>({carNum:null}),selectors:{},layerIndex:null,activityType:"test"};
        await controller.render(config);
        await controller.requestToggle(config,"favorite");
        expect(readState).not.toHaveBeenCalled(); expect(toggle).not.toHaveBeenCalled();
        expect(jquery("#favoriteBtn").prop("disabled")).toBe(true);
    });
    it("does not apply a block confirmation to a different late native number", async () => {
        document.body.innerHTML = '<button id="filterBtn"><span>屏蔽</span></button>';
        let carNum = "ABC-123", accept;
        const toggle = vi.fn(), confirm = vi.fn((_event,_message,callback)=>{accept=callback;});
        const controller = new DetailStateController({toggle},{jquery,readState:vi.fn(async()=>({})),confirm,reportError:vi.fn(),logError:vi.fn(),closePage:vi.fn()});
        const config = {root:document,carNum,getRecord:()=>({carNum}),selectors:{},layerIndex:null,activityType:"test"};
        await controller.requestToggle(config,"blocked");
        expect(confirm.mock.calls[0][1]).toContain("ABC-123");
        carNum = "XYZ-456";
        await accept();
        expect(toggle).not.toHaveBeenCalled();
    });

    it("does not let a complete URL hint wash an absent or label-only native identity", () => {
        const location = { href: "https://javdb.com/v/test?jhsCarNum=ABC-123" }, host = new JavDbHostAdapter(document, location);
        expect(host.readMovieRef()).toMatchObject({ carNum: "ABC-123", stateEligibility: { eligible: false } });
        document.body.innerHTML = '<main class="video-detail"><a title="复制番号" data-clipboard-text="Studio Name"></a></main>';
        expect(host.readMovieRef()).toMatchObject({ carNum: "STUDIO-NAME", stateEligibility: { eligible: false } });
        document.querySelector("a").setAttribute("data-clipboard-text", "ABC-123");
        expect(host.readMovieRef().stateEligibility.eligible).toBe(true);
    });

    it("ignores old status, recent and actor-card matching for an unreliable live card", () => {
        const result = evaluateListItem({ carNum: "STUDIO-NAME", title: "Allowed title" }, createListEvaluationContext({
            carMap: new Map([["STUDIO-NAME", { stateFlags: { favorite: true, blocked: true } }]]),
            actorCarNumToNameMap: new Map([["STUDIO-NAME", "Actor"]]),
            actressCarNumToNameMap: new Map([["STUDIO-NAME", "Actress"]]), recentCarNums: new Set(["STUDIO-NAME"]),
        }), { filter: "all" });
        expect(result.flags).toEqual({ favorite: false, downloaded: false, watched: false, blocked: false });
        expect(result.recent).toBe(false); expect(result.hardHidden).toBe(false);
        expect(evaluateListItem({ carNum: "STUDIO-NAME", title: "Blocked word" }, createListEvaluationContext({ titleKeywords: ["Blocked"] })).visibilityReasons.keyword).toBe(true);
    });

    it("does not replace an actor's old scan result after skipping an unreliable identity", async () => {
        const state = { getCarMap: vi.fn(async () => new Map()), getNewVideoDecisions: vi.fn(async () => ({})), updateFavoriteActress: vi.fn(async () => true) };
        const scan = new NewVideoScanController({ state, getTimestamp: () => "new time", onNewItems: vi.fn() });
        await expect(scan.parseActorMovies([{ carNum: "ABC-123" }, { carNum: "STUDIO-NAME" }], "actor", "Actor", [], new Set())).rejects.toThrow("番号");
        expect(state.updateFavoriteActress).not.toHaveBeenCalled();
    });

    it("does not automatically dismiss new work on an unreliable detail visit", async () => {
        const scope = new LifecycleScope("identity-browse"), remove = vi.fn();
        const controller = new DetailBrowseLifecycleController({ settings: { snapshot: () => ({ autoRemoveNewVideoMarkAfterBrowse: "yes" }) }, state: { removeFromNewVideoList: remove }, scope });
        expect(await controller.start({ carNum: "STUDIO-NAME" })).toBe(false);
        expect(remove).not.toHaveBeenCalled(); scope.dispose();
    });

    it("does not query or display an old ambiguous detail state", async () => {
        document.body.innerHTML = '<div id="detail"><button id="favoriteBtn"><span>收藏</span></button></div>';
        const readState = vi.fn(async () => ({ stateFlags: { favorite: true } }));
        const controller = new DetailStateController({ toggle: vi.fn() }, { readState, jquery, reportError: vi.fn(), logError: vi.fn() });
        await controller.render({ root: document, carNum: "STUDIO-NAME" });
        expect(readState).not.toHaveBeenCalled();
        expect(jquery("#favoriteBtn").prop("disabled")).toBe(true);
        expect(jquery("#favoriteBtn").attr("aria-pressed")).toBe("false");
    });

    it("imports reliable want/watch entries and reports skipped labels separately", async () => {
        document.body.innerHTML = '<main><div class="movie-list"></div></main>';
        jquery(".movie-list").append(card("Studio Name"), card("ABC-123"));
        const scope = new LifecycleScope("identity-import"), state = { patch: vi.fn() };
        const controller = new WantWatchImportController({ document, window, href: window.location.href, hostAdapter: { getListSelectors: () => ({ itemSelector: ".movie-list .item" }) }, http: {}, state, ui: {}, notifications: { info: vi.fn() }, diagnostics: {}, scope });
        const result = await controller.readAndImport("favorite");
        expect(result).toMatchObject({ imported: 1, failed: 0, skipped: 1 });
        expect(state.patch).toHaveBeenCalledTimes(1); expect(state.patch.mock.calls[0][0]).toBe("ABC-123"); scope.dispose();
    });

    it("does not aggregate legacy label-only new works into a live state row", () => {
        const actresses = [{ starId: "a", newVideoList: [{ carNum: "STUDIO-NAME" }, { carNum: "ABC-123" }] }];
        expect(aggregateNewVideoRecords(actresses, new Map(), {}).map(item => item.carNum)).toEqual(["ABC-123"]);
        expect(actresses[0].newVideoList).toHaveLength(2);
    });
});
