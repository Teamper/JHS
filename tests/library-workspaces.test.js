// @vitest-environment jsdom
import jquery from "jquery";
import { afterEach, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { MovieSelectionService } from "../src/services/movie-selection-service.js";
import { MovieSelectionController } from "../src/features/library/movie-selection-controller.js";
import { MovieListsController } from "../src/features/library/movie-lists-controller.js";
import { createPersonalRatingControl } from "../src/ui/library/personal-rating.js";
import { PersonalRatingController } from "../src/features/library/personal-rating-controller.js";
import { HistoryRepository } from "../src/features/library/history-repository.js";

const scopes = [];
const own = () => { const scope = new LifecycleScope("test:library"); scopes.push(scope); return scope; };
afterEach(() => { for (const scope of scopes.splice(0)) scope.dispose(); document.body.replaceChildren(); vi.unstubAllGlobals(); });
const movie = {carNum:"ABC-123",url:"https://javdb.com/v/a",title:"标题"};
const click = (text, root = document) => [...root.querySelectorAll("button")].find(button => button.textContent === text).click();

it("retains normalized cross-page selections without storing URL query credentials", () => {
    let saved = null;
    const persistence = {origin:"https://javdb.com",read:() => saved,write:value => { saved = value; }};
    const service = new MovieSelectionService(persistence), changes = vi.fn();
    service.addEventListener("selection.changed",changes);
    service.setMany([{...movie,url:movie.url+"?token=secret"},{carNum:"FC2-0012345",url:"/v/b"}],true);
    expect(changes).toHaveBeenCalledOnce();
    expect(saved).not.toContain("secret");
    expect(new MovieSelectionService(persistence).values().map(item => item.carNum)).toEqual(["ABC-123","FC2-0012345"]);
    service.set(movie,false);
    expect(service.values().map(item => item.carNum)).toEqual(["FC2-0012345"]);
    service.clear();
    expect(new MovieSelectionService(persistence).values()).toEqual([]);
});

it("preserves future selection records and reports failed cross-page persistence", () => {
    const future = new MovieSelectionService({origin:"https://javdb.com",read:() => '{"schema":9}',write:vi.fn()});
    expect(() => future.set(movie,true)).toThrow("无法安全读取");
    const service = new MovieSelectionService({origin:"https://javdb.com",read:() => null,write:() => { throw Error("quota"); }});
    service.set(movie,true);
    expect(service.values()).toHaveLength(1);
    expect(service.warning).toContain("跨页保存失败");
});

it("mounts native card selection once, dispatches the concrete selected range and cleans up", async () => {
    document.body.innerHTML = '<main><div class="movie-list"><div class="item"><a href="https://javdb.com/v/a"><span class="video-title"><strong>ABC-123</strong> 标题</span></a></div></div></main>';
    const scope = own(), service = new MovieSelectionService({origin:"https://javdb.com",read:()=>null,write:()=>{}}), execute = vi.fn();
    const host = {document,locateListRoot:()=>document.querySelector(".movie-list"),locateListItems:()=>[...document.querySelectorAll(".item")]};
    const controller = new MovieSelectionController({host,service,scope,ui:{jquery},execute});
    controller.start();
    expect(document.querySelector(".jhs-movie-choice")).toBeNull();
    controller.toggle();
    const checkbox = document.querySelector(".jhs-movie-choice input");
    checkbox.click();
    click("批量评分");
    await vi.waitFor(() => expect(execute).toHaveBeenCalledWith("library.rating.open",[expect.objectContaining({carNum:"ABC-123"})]));
    expect(checkbox.closest("a")).toBeNull();
    expect(document.querySelectorAll(".jhs-movie-choice")).toHaveLength(1);
    scope.dispose();
    expect(document.querySelector(".jhs-movie-selection")).toBeNull();
    expect(document.querySelector(".jhs-movie-choice")).toBeNull();
    expect(service.values()).toHaveLength(1);
});

it("saves ratings with roving keyboard focus, clear and failed-write feedback", async () => {
    const scope = own(), onChange = vi.fn(async () => {}), view = createPersonalRatingControl({document,scope,rating:2,onChange});
    document.body.append(view.root);
    const stars = [...view.root.querySelectorAll('[role="radio"]')];
    stars[1].focus();
    stars[1].dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));
    await vi.waitFor(() => expect(stars[2].getAttribute("aria-checked")).toBe("true"));
    expect(document.activeElement).toBe(stars[2]);
    expect(onChange).toHaveBeenCalledWith(3);
    click("清除评分");
    await vi.waitFor(() => expect(view.root.textContent).toContain("未评分"));
    onChange.mockRejectedValueOnce(Error("disk"));
    stars[4].click();
    await vi.waitFor(() => expect(view.root.textContent).toContain("评分保存失败"));
    expect(stars[4].getAttribute("aria-checked")).toBe("false");
});

it("renders rating badges on recommendations and details, refreshes and drops late responses", async () => {
    document.body.innerHTML = '<main><div class="summary"></div><a class="tile-item" href="/v/a"><span class="video-number">ABC-123</span><span class="video-title">标题</span></a></main>';
    const scope = own();
    let refresh;
    const state = {getPersonalRatings:vi.fn(async()=>({"ABC-123":{rating:4}})),setPersonalRating:vi.fn(async()=>{})};
    const host = {document,getCardEnhancementSelectors:()=>({itemSelector:".item"}),readMovieRef:()=>({...movie,stateEligibility:{eligible:true}}),detectRoute:()=>"detail",locateDetailSlots:()=>({summary:document.querySelector(".summary")})};
    await new PersonalRatingController({host,state,scope,events:{on:(_type,fn)=>{refresh=fn;return ()=>{};}},ui:{jquery},dialog:{}}).start();
    expect(document.querySelector(".jhs-rating-badge").textContent).toBe("个人 4 星");
    expect(document.querySelector(".jhs-personal-rating-entry").textContent).toContain("4 星");
    state.getPersonalRatings.mockResolvedValueOnce({"ABC-123":{rating:1}});
    await refresh();
    expect(document.querySelector(".jhs-rating-badge").textContent).toBe("个人 1 星");
    const replacement = document.createElement("section");
    host.locateDetailSlots = () => ({summary:replacement});
    document.body.append(replacement);
    await vi.waitFor(()=>expect(replacement.querySelector(".jhs-personal-rating-entry")).not.toBeNull());
    expect(document.querySelectorAll(".jhs-personal-rating-entry")).toHaveLength(1);
    let resolve;
    state.getPersonalRatings.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
    const pending = refresh();
    scope.dispose(); resolve({"ABC-123":{rating:5}}); await pending;
    expect(document.querySelector(".jhs-personal-rating-entry,.jhs-rating-badge")).toBeNull();
});

it("joins independent ratings into history without writing state flags", async () => {
    const original = [{carNum:"abc-123",stateFlags:{favorite:true}}];
    const repository = new HistoryRepository({storage:{getCarList:async()=>original},state:{getPersonalRatings:async()=>({"ABC-123":{rating:4},"FC2-0012345":{rating:2,updatedAt:"2026-11-07"}})}});
    const rows = await repository.list();
    expect(rows[0]).toMatchObject({personalRating:4,stateFlags:{favorite:true}});
    expect(rows[1]).toMatchObject({carNum:"FC2-0012345",personalRating:2,stateFlags:{}});
    expect(original[0]).not.toHaveProperty("personalRating");
});

function listsWorkspace({writable = true, deferred = null} = {}) {
    const scope = own(), dialog = {open:vi.fn(()=>7),close:vi.fn()};
    const service = Object.assign(new EventTarget(),{
        runs:new Map(), access:vi.fn(async()=>({origin:"https://javdb.com",account:{fingerprint:"account",label:"网页账号"},writable,reason:writable?"":"当前环境不支持跨标签互斥，清单保持只读"})),
        normalizeMovies:vi.fn(movies=>movies.map(item=>({...item,videoId:"a"}))),
        directory:vi.fn(deferred || (async()=>[{id:"1",name:"现有清单 <img>",checked:true,disabled:false},{id:"2",name:"另一清单",checked:false,disabled:false}])),
        listTasks:vi.fn(async()=>[]),createTask:vi.fn(async()=>({id:"task"})),resume:vi.fn(async()=>{}),stop:vi.fn(async()=>{}),inspect:vi.fn(),
    });
    const controller = new MovieListsController({host:{document},service,scope,dialog,ui:{jquery}});
    return {controller,service,scope,dialog};
}

it("moves the single native list entry when the detail owner installs its final action slot", async () => {
    document.body.innerHTML = '<section class="original"></section>';
    const scope = own();
    let target = document.querySelector(".original");
    const controller = new MovieListsController({host:{document,readMovieRef:()=>({...movie,stateEligibility:{eligible:true}}),detectRoute:()=>"detail",locateDetailSlots:()=>({summary:target})},service:{},scope,dialog:{},ui:{jquery}});
    controller.start();
    expect([...document.querySelectorAll("button")].filter(node=>node.textContent==="JavDB 清单")).toHaveLength(1);
    target = document.createElement("section");
    document.body.append(target);
    await vi.waitFor(()=>expect(target.querySelector("button")).not.toBeNull());
    expect([...document.querySelectorAll("button")].filter(node=>node.textContent==="JavDB 清单")).toHaveLength(1);
    scope.dispose();
    expect(document.querySelector("button")).toBeNull();
});

it("opens FC2 lists from the shared owned movie context", () => {
    document.body.innerHTML = '<article data-jhs-movie-code="FC2-0012345"><div class="jhs-fc2-toolbar"></div></article>';
    const root = document.querySelector("article");
    root.__jhsMovieContext = {carNum:"FC2-0012345",detailUrl:"https://javdb.com/v/fc2-movie"};
    const controller = new MovieListsController({host:{document,readMovieRef:()=>null,detectRoute:()=>"owned-detail"},service:{},scope:own(),dialog:{},ui:{jquery}});
    controller.open = vi.fn(async()=>{});
    controller.start();
    click("JavDB 清单");
    expect(controller.open).toHaveBeenCalledWith([{carNum:"FC2-0012345",url:"https://javdb.com/v/fc2-movie"}]);
});

it("reviews exact list and movie ranges, binds confirmation to the verified account and supports search", async () => {
    const {controller,service} = listsWorkspace();
    await controller.open([movie]);
    expect(document.querySelector('.jhs-movie-lists [role="status"]').textContent).toContain("已选 1 部影片");
    expect(document.querySelector(".jhs-list-directory").textContent).toContain("已加入当前影片");
    expect(document.querySelector("img")).toBeNull();
    const search = document.querySelector('input[type="search"]');
    search.value = "现有"; search.dispatchEvent(new Event("input"));
    expect(document.querySelectorAll(".jhs-list-directory label[hidden]")).toHaveLength(1);
    document.querySelector('.jhs-list-directory input').click();
    click("预览操作范围");
    await vi.waitFor(()=>expect(document.querySelector(".jhs-list-range")?.textContent).toContain("ABC-123"));
    expect(service.createTask).not.toHaveBeenCalled();
    click("确认并开始");
    await vi.waitFor(()=>expect(service.resume).toHaveBeenCalledWith("task"));
    expect(service.createTask.mock.calls[0][0]).toMatchObject({expectedAccount:"account",checked:true,movies:[expect.objectContaining({carNum:"ABC-123"})],lists:[expect.objectContaining({id:"1"})]});
});

it("keeps list reads available without cross-tab locks and guards late directory completion", async () => {
    const {controller,service} = listsWorkspace({writable:false});
    await controller.open([movie]);
    expect(document.querySelector('.jhs-list-directory input').disabled).toBe(true);
    click("预览操作范围");
    await vi.waitFor(()=>expect(document.querySelector('[role="status"]').textContent).toContain("请核对账号"));
    expect(service.createTask).not.toHaveBeenCalled();
    let resolve;
    const next = listsWorkspace({deferred:()=>new Promise(done=>{resolve=done;})});
    const pending = next.controller.open([movie]);
    await vi.waitFor(()=>expect(resolve).toBeTypeOf("function"));
    next.dialog.open.mock.calls[0][0].end();
    resolve([{id:"late",name:"迟到",checked:false,disabled:false}]);
    await pending;
    expect([...document.querySelectorAll(".jhs-list-directory")].some(node=>node.textContent.includes("迟到"))).toBe(false);
});
