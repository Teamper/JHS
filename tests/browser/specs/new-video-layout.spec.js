import {test,expect} from "@playwright/test";
import {fulfillHostFixtures,injectUserscriptRuntime} from "../harness/runtime.js";

for (const scenario of [
    { name: "returning to the first page", count: 9, removed: ["ABC-002"], target: 2, back: true, page: 1, expected: ["ABC-001", "ABC-003", "ABC-004"] },
    { name: "using an outdated last-page button", count: 7, removed: ["ABC-002"], target: 3, page: 2, expected: ["ABC-005", "ABC-006", "ABC-007"] },
    { name: "removing every record", count: 4, removed: ["ABC-001", "ABC-002", "ABC-003", "ABC-004"], target: 2, page: 1, expected: [] },
]) test(`pagination during a real removal stays current when ${scenario.name}`, async ({ page, context }, info) => {
    test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "desktop and mobile pagination acceptance");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page, { disabledPlugins: ["TaskPlugin"], settingOverrides: { enableLoadReview: "no" } });
    await page.waitForFunction(() => window.unsafeWindow.pluginManager.getBean("NewVideoPlugin")?.featureNewVideoWorkspaceController);
    await page.evaluate(async count => {
        const storage = window.storageManager;
        await storage.forage.setItem(storage.favorite_actresses_key, [{ starId: "fixture", name: "Fixture", actressType: "censored",
            newVideoList: Array.from({ length: count }, (_, index) => ({
                carNum: `ABC-${String(index + 1).padStart(3, "0")}`, publishTime: "2026-09-09", title: "Fixture",
                coverUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
            })),
        }]);
        storage._invalidateCache(storage.favorite_actresses_key);
        window.unsafeWindow.pluginManager.getBean("NewVideoPlugin").getRuntimeService("storage").setLocal("jhs_newVideoViewMode", "list");
        const plugin = window.unsafeWindow.pluginManager.getBean("NewVideoPlugin");
        plugin.nvPageSize = 3;
        await plugin.openDialog();
    }, scenario.count);
    await expect(page.locator("#nv-grid .nv-card")).toHaveCount(3);
    const result = await page.evaluate(async ({ removed, target, back }) => {
        const plugin = window.unsafeWindow.pluginManager.getBean("NewVideoPlugin");
        const animate = window.jQuery.fn.animate;
        let signalRemovalStarted;
        const removalStarted = new Promise(resolve => { signalRemovalStarted = resolve; });
        window.jQuery.fn.animate = function(properties, ...args) {
            const result = animate.call(this, properties, ...args);
            if (properties.opacity === 0 && this.is("#nv-grid .nv-card")) signalRemovalStarted();
            return result;
        };
        try {
            await plugin.getRuntimeService("state").removeFromNewVideoList(removed, "manual");
            // Committed writes defer local notifications; observe the real fade before joining its reload.
            await removalStarted;
            const pending = plugin.flushWorkspaceReload();
            const animationWasActive = plugin.nvRemovingCards.size > 0;
            window.jQuery(`.nv-card[data-car="${removed[0]}"] .nv-select`).prop("checked", true).trigger("change");
            window.jQuery('.nv-card[data-car="ABC-003"] .nv-select').prop("checked", true).trigger("change");
            document.querySelector(`#nv-pagination-bar [data-nvpage="${target}"]`).click();
            await pending;
            if (back) document.querySelector('#nv-pagination-bar [data-nvpage="1"]').click();
            const actresses = await window.storageManager.getFavoriteActressList();
            return { animationWasActive, page: plugin.nvCurrentPage, selected: [...plugin.nvSelected],
                visible: [...document.querySelectorAll("#nv-grid .nv-card")].map(card => card.dataset.car),
                cached: plugin.nvFlatListCache.map(item => item.carNum),
                stored: actresses.flatMap(actress => actress.newVideoList.map(item => typeof item === "string" ? item : item.carNum)),
            };
        } finally {
            window.jQuery.fn.animate = animate;
        }
    }, scenario);
    expect(result.animationWasActive).toBe(true);
    expect(result.visible).toEqual(scenario.expected);
    expect(result.page).toBe(scenario.page);
    expect(result.selected).toEqual(scenario.removed.includes("ABC-003") ? [] : ["ABC-003"]);
    expect(result.cached).toHaveLength(scenario.count - scenario.removed.length);
    for (const carNum of scenario.removed) expect(result.stored).not.toContain(carNum);
    if (!scenario.expected.length) {
        await expect(page.locator("#new-video-list-container")).toContainText("暂无新作品记录");
        await expect(page.locator("#nv-pagination-bar")).toHaveCount(0);
    }
});

test("browsing new video fades only that card and fills the page without losing position",async({page,context},info)=>{
    test.skip(!["desktop-wide","mobile"].includes(info.project.name),"desktop and mobile scrolling owners");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page,{
        disabledPlugins:["TaskPlugin"],
        settingOverrides:{enableLoadReview:"no",autoRemoveNewVideoMarkAfterBrowse:"yes"}
    });
    await page.waitForFunction(()=>window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
    await page.waitForFunction(()=>window.unsafeWindow.pluginManager.getBean("NewVideoPlugin")?.featureNewVideoWorkspaceController);
    await page.evaluate(async()=>{
        const storage=window.storageManager;
        await storage.forage.setItem(storage.favorite_actresses_key,[{
            starId:"fixture",name:"Fixture",actressType:"censored",
            newVideoList:Array.from({length:150},(_,index)=>({
                carNum:`ABC-${String(index+1).padStart(3,"0")}`,publishTime:"2026-09-09",title:"Fixture title",
                url:`https://javdb.com/v/nv-${index+1}`,
                coverUrl:"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
            }))
        }]);
        storage._invalidateCache(storage.favorite_actresses_key);
        window.unsafeWindow.pluginManager.getBean("NewVideoPlugin").getRuntimeService("storage").setLocal("jhs_newVideoViewMode","list");
        await window.unsafeWindow.pluginManager.getBean("NewVideoPlugin").openDialog();
    });
    await expect(page.locator("#nv-grid .nv-card")).toHaveCount(60);
    await page.locator("#nv-pagination-bar").getByRole("button",{name:"下一页",exact:true}).click();
    await expect(page.locator('#nv-grid .nv-card').first()).toHaveAttribute("data-car","ABC-061");
    const target=page.locator('.nv-card[data-car="ABC-090"] .nv-card__link');
    await page.locator('.nv-card[data-car="ABC-091"] .nv-select').check();
    await target.scrollIntoViewIfNeeded();
    const before=await page.evaluate(()=>{
        const container=document.querySelector("#new-video-list-container"),workspace=document.querySelector(".newVideoToolBox");
        const card=document.querySelector('.nv-card[data-car="ABC-091"]');
        window.nvRetainedNodes={grid:document.querySelector("#nv-grid"),card,image:card.querySelector("img")};
        const animate=window.jQuery.fn.animate;
        window.nvBrowseFades=0;
        window.jQuery.fn.animate=function(properties,...args){
            if(this.is('.nv-card[data-car="ABC-090"]') && properties.opacity===0) window.nvBrowseFades++;
            return animate.call(this,properties,...args);
        };
        return {list:container.scrollTop,workspace:workspace.scrollTop};
    });
    expect(Math.max(before.list,before.workspace)).toBeGreaterThan(0);
    const popupPromise=page.waitForEvent("popup");
    await target.click();
    const popup=await popupPromise;
    await popup.close();
    await expect(page.locator('.nv-card[data-car="ABC-090"]')).toHaveCount(0);
    await expect(page.locator("#nv-grid .nv-card")).toHaveCount(60);
    await expect(page.locator("#nv-grid .nv-card").last()).toHaveAttribute("data-car","ABC-121");
    await expect(page.locator('.nv-card[data-car="ABC-091"] .nv-select')).toBeChecked();
    await expect(page.locator("#nv-pagination-bar")).toContainText("第 2/3 页，共 149 条");
    await expect.poll(()=>page.evaluate(()=>{
        const container=document.querySelector("#new-video-list-container"),workspace=document.querySelector(".newVideoToolBox");
        return {list:container.scrollTop,workspace:workspace.scrollTop};
    })).toEqual(before);
    expect(await page.evaluate(()=>({
        grid:window.nvRetainedNodes.grid===document.querySelector("#nv-grid"),
        card:window.nvRetainedNodes.card===document.querySelector('.nv-card[data-car="ABC-091"]'),
        image:window.nvRetainedNodes.image===document.querySelector('.nv-card[data-car="ABC-091"] img'),
        page:window.unsafeWindow.pluginManager.getBean("NewVideoPlugin").nvCurrentPage,
        fades:window.nvBrowseFades
    }))).toEqual({grid:true,card:true,image:true,page:2,fades:1});
});

test("new video pagination remains reachable without scrolling through sixty cards",async({page,context},info)=>{
    test.skip(info.project.name!=="desktop-wide","explicit viewport matrix owner");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page,{settingOverrides:{enableLoadReview:"no"}});
    await page.waitForFunction(()=>window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
    await page.evaluate(()=>{
        const plugin=window.unsafeWindow.pluginManager.getBean("NewVideoPlugin");
        plugin.getNewVideoFlatList=async()=>Array.from({length:75},(_,i)=>({carNum:`ABC-${i+100}`,actressName:"Fixture",publishTime:"2026-09-09",title:"Fixture title"}));
        plugin.hydrateVisibleCovers=async()=>{};
    });
    await page.locator("#newVideoBtn").click();
    await page.locator("#nvViewList").click();
    await expect(page.locator("#nv-grid .nv-card")).toHaveCount(60);
    for(const width of [1248,390,360]) {
        await page.setViewportSize({width,height:844});
        await expect(page.locator("#nv-pagination-bar")).toBeInViewport({ratio:1});
        await expect.poll(async()=>(await page.locator("#new-video-list-container").boundingBox()).height).toBeGreaterThanOrEqual(150);
    }
    await page.locator('#nv-pagination-bar').getByRole("button",{name:"下一页",exact:true}).click();
    await expect(page.locator("#nv-grid .nv-card")).toHaveCount(15);
    await page.setViewportSize({width:360,height:640});
    await expect.poll(async()=>(await page.locator("#new-video-list-container").boundingBox()).height).toBeGreaterThanOrEqual(150);
    await page.locator("#nv-pagination-bar").scrollIntoViewIfNeeded();
    await expect(page.locator("#nv-pagination-bar")).toBeInViewport({ratio:1});
    await page.locator("#nvViewActress").click();
    await expect(page.locator("#nv-pagination-bar")).not.toBeVisible();
    await page.locator("#nvViewList").click();
    await expect(page.locator("#nv-pagination-bar")).toHaveCount(1);
    await page.evaluate(()=>{
        const plugin=window.unsafeWindow.pluginManager.getBean("NewVideoPlugin");
        plugin.featureNewVideoWorkspaceController.state.getNewVideoDecisions=()=>new Promise(resolve=>window.finishNvReload=()=>resolve({}));
    });
    if (!await page.locator("#reLoad").isVisible()) await page.locator("#nvWorkspaceMore").click();
    await page.locator("#reLoad").click();
    await expect(page.locator("#nv-pagination-bar")).toHaveCount(0);
    await page.waitForFunction(()=>typeof window.finishNvReload==="function");
    await page.evaluate(()=>window.finishNvReload());
    await expect(page.locator("#nv-pagination-bar")).toHaveCount(1);
});

test("new video feature owns its style and keeps the legacy disable ID",async({page,context,browser},info)=>{
    test.skip(info.project.name!=="desktop-wide","explicit viewport matrix owner");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page,{settingOverrides:{enableCheckBlacklist:"no",enableCheckFavoriteActress:"no",enableCheckNewVideo:"no"}});
    await expect(page.locator("#feature-new-video-workspace")).toHaveCount(0);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("NewVideoPlugin"))).toBe(false);
    await page.locator("#newVideoBtn").click();
    await expect(page.locator(".newVideoToolBox")).toBeVisible();
    await expect(page.locator("#feature-new-video-workspace")).toHaveCount(1);
    await page.evaluate(()=>window.layer.closeAll());
    await expect(page.locator(".newVideoToolBox")).toHaveCount(0);

    const disabledContext=await browser.newContext({viewport:{width:1440,height:900}});
    try {
        await fulfillHostFixtures(disabledContext);
        const disabledPage=await disabledContext.newPage();
        await disabledPage.goto("https://javdb.com/");
        await injectUserscriptRuntime(disabledPage,{disabledPlugins:["NewVideoPlugin"]});
        await expect(disabledPage.locator("#newVideoBtn")).toHaveCount(0);
        await expect(disabledPage.locator("#feature-new-video-workspace")).toHaveCount(0);
        await expect(disabledPage.locator("#jhs-quick-filter")).toBeVisible();
        expect(await disabledPage.evaluate(()=>window.unsafeWindow.pluginManager.getPluginNames().includes("NewVideoPlugin"))).toBe(false);
    } finally {
        await disabledContext.close();
    }
});

test("new-video batch UI delegates state writes to the Discovery Feature", async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop-wide", "explicit viewport matrix owner");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page, { settingOverrides: { enableCheckBlacklist: "no", enableCheckFavoriteActress: "no", enableCheckNewVideo: "no" } });
    await page.locator("#newVideoBtn").click();
    await expect(page.locator(".newVideoToolBox")).toBeVisible();
    await page.locator("#nvViewList").click();
    await page.evaluate(() => {
        const plugin = window.unsafeWindow.pluginManager.getBean("NewVideoPlugin");
        const controller = plugin.featureNewVideoBatchController;
        if (!controller) throw new Error("Discovery Feature batch controller was not injected");
        const originalRun = controller.run.bind(controller);
        window.__newVideoBatchActions = [];
        controller.run = async (action, items) => {
            window.__newVideoBatchActions.push(action);
            return originalRun(action, items);
        };
        const item = { carNum: "NV-FEATURE-001", actressName: "Fixture Actress", title: "Synthetic work", publishTime: "2026-09-01" };
        plugin.nvAllItemsMap.set(item.carNum, item);
        plugin.nvFlatListCache = [item];
        plugin.nvSelected = new Set([item.carNum]);
        plugin.renderBatchBar();
    });
    await page.locator("#batchMarkFavorite").click();
    await expect.poll(() => page.evaluate(async () => (await window.stateService.getState("NV-FEATURE-001"))?.stateFlags?.favorite)).toBe(true);
    const result = await page.evaluate(async () => {
        const activity = await window.stateService.getActivityLog();
        return {
            actions: window.__newVideoBatchActions,
            activityType: activity.entries.find((entry) => entry.type === "new-video-batch-state")?.type || null,
        };
    });
    expect(result).toEqual({ actions: ["favorite"], activityType: "new-video-batch-state" });
});

test("new-video workspace snapshot uses its injected Discovery services", async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop-wide", "explicit viewport matrix owner");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page, { settingOverrides: { enableCheckBlacklist: "no", enableCheckFavoriteActress: "no", enableCheckNewVideo: "no" } });
    await page.evaluate(async () => {
        const storage = window.unsafeWindow.storageManager;
        await storage.addFavoriteActressList([{
            starId: "feature-workspace-actor", name: "Synthetic Workspace Actor", allName: ["Synthetic Workspace Actor"], actressType: "censored",
        }]);
        await storage.updateFavoriteActress({
            starId: "feature-workspace-actor", lastCheckTime: "2026-09-27 15:00:00", lastPublishTime: "2026-09-20",
            newVideoList: [{ carNum: "NV-WORKSPACE-001", title: "Synthetic workspace work", publishTime: "2026-09-20" }],
        });
    });
    await page.locator("#newVideoBtn").click();
    await expect(page.locator(".newVideoToolBox")).toBeVisible();
    await expect.poll(() => page.evaluate(() => {
        const plugin = window.unsafeWindow.pluginManager.getBean("NewVideoPlugin");
        return Boolean(plugin.featureNewVideoWorkspaceController && plugin.nvJavDbUrl);
    })).toBe(true);
    const snapshot = await page.evaluate(async () => {
        const plugin = window.unsafeWindow.pluginManager.getBean("NewVideoPlugin");
        const [workspace, pending] = await Promise.all([
            plugin.featureNewVideoWorkspaceController.loadWorkspace(),
            plugin.featureNewVideoWorkspaceController.getPendingSummary(),
        ]);
        return {
            actresses: Array.isArray(workspace.actresses),
            carMap: workspace.carMap instanceof Map,
            decisions: typeof workspace.decisions === "object",
            item: workspace.items.find((entry) => entry.carNum === "NV-WORKSPACE-001"),
            renderedItem: plugin.nvAllItemsMap.get("NV-WORKSPACE-001"),
            javDbUrl: workspace.javDbUrl,
            pendingCount: pending.count,
        };
    });
    expect(snapshot).toMatchObject({
        actresses: true, carMap: true, decisions: true, javDbUrl: "https://javdb.com", pendingCount: 1,
        item: { carNum: "NV-WORKSPACE-001", actressName: "Synthetic Workspace Actor", decisionState: "pending" },
        renderedItem: { carNum: "NV-WORKSPACE-001", title: "Synthetic workspace work" },
    });
});

test("scheduled actor scans run and persist through the injected Discovery controller", async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop-wide", "explicit viewport matrix owner");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page, { settingOverrides: { enableCheckBlacklist: "no", enableCheckFavoriteActress: "no", enableCheckNewVideo: "no" } });
    await expect.poll(() => page.evaluate(() => Boolean(window.unsafeWindow.pluginManager.getBean("TaskPlugin")?.featureNewVideoScanController))).toBe(true);
    const result = await page.evaluate(async () => {
        const manager = window.unsafeWindow.pluginManager;
        const task = manager.getBean("TaskPlugin");
        const controller = task.featureNewVideoScanController;
        if (!controller) throw new Error("Discovery scan controller was not attached to TaskPlugin");
        const actor = { starId: "feature-scan-actor", name: "Synthetic Actor", allName: ["Synthetic Actor"], avatar: "", newVideoList: [] };
        await window.unsafeWindow.storageManager.addFavoriteActressList([actor]);
        const delegated = [];
        const parse = controller.parseActorMovies.bind(controller);
        controller.parseActorMovies = async (...args) => { delegated.push(args[1]); return parse(...args); };
        controller.actressInfo.movies = async () => [{
            carNum: "NV-SCAN-001", title: "Synthetic release", coverUrl: "https://img.example/cover.jpg",
            publishTime: "2026-09-20", score: 4.5, voteCount: 12, url: "/v/nv-scan-001",
        }];
        task.taskConfig = { checkConcurrencyCount: 1, checkRequestSleep: 0, checkNewVideo_intervalTime: 12, checkNewVideo_ruleTime: 8760 };
        task.javDbUrl = "https://javdb.com";
        task.ensureReady = async () => {};
        task.shouldStartTask = async () => true;
        task.beginTaskAttempt = () => Date.now();
        task.withActiveTask = (_name, runner) => runner();
        task.finalizeTask = async () => {};
        task.isUnnecessaryCheck = () => false;
        task.emitNewVideoChanged = async () => {};
        task.renderCheckResult = () => {};
        const result = await task.checkNewVideo(true);
        await task.checkOneNewVideo({ starId: actor.starId, name: actor.name });
        const saved = (await window.unsafeWindow.storageManager.getFavoriteActressList()).find((entry) => entry.starId === actor.starId);
        return { delegated, result, saved };
    });
    expect(result.delegated).toEqual(["feature-scan-actor", "feature-scan-actor"]);
    expect(result.result).toMatchObject({ attempted: true, completed: true, success: 1, parseFailed: 0, networkFailed: 0 });
    expect(result.saved).toMatchObject({
        starId: "feature-scan-actor", lastCheckTime: expect.any(String), lastPublishTime: "2026-09-20",
        newVideoList: [{ carNum: "NV-SCAN-001", title: "Synthetic release", publishTime: "2026-09-20", score: 4.5, voteCount: 12 }],
    });
});

test("scheduler does not report a saved scan after another tab removes its actor with NewVideo disabled", async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop-wide", "explicit viewport matrix owner");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page, {
        disabledPlugins: ["NewVideoPlugin"],
        settingOverrides: { enableCheckBlacklist: "no", enableCheckFavoriteActress: "no", enableCheckNewVideo: "no" },
    });
    await expect.poll(() => page.evaluate(() => Boolean(window.unsafeWindow.pluginManager.getBean("TaskPlugin")?.service))).toBe(true);
    const result = await page.evaluate(async () => {
        const task = window.unsafeWindow.pluginManager.getBean("TaskPlugin");
        const storage = window.unsafeWindow.storageManager;
        const actor = { starId: "removed-during-scan", name: "Synthetic Actor", allName: ["Synthetic Actor"], avatar: "", newVideoList: [] };
        await storage.addFavoriteActressList([actor]);
        task.getRuntimeService("actressInfo").movies = async () => {
            await storage.removeFavoriteActress(actor.starId);
            return [{ carNum: "NV-REMOVED-001", title: "Synthetic release", publishTime: "2026-09-20" }];
        };
        task.taskConfig = { checkConcurrencyCount: 1, checkRequestSleep: 0, checkNewVideo_intervalTime: 12, checkNewVideo_ruleTime: 8760 };
        task.javDbUrl = "https://javdb.com";
        task.ensureReady = async () => {};
        task.shouldStartTask = async () => true;
        task.beginTaskAttempt = () => Date.now();
        task.withActiveTask = (_name, runner) => runner();
        task.finalizeTask = async () => {};
        task.isUnnecessaryCheck = () => false;
        task.emitNewVideoChanged = async () => {};
        task.renderCheckResult = () => {};
        const scan = await task.checkNewVideo(true);
        return { scan, remaining: (await storage.getFavoriteActressList()).some(item => item.starId === actor.starId) };
    });
    expect(result).toMatchObject({ scan: { success: 0, parseFailed: 1 }, remaining: false });
});

test("full saved-actress sync paginates and persists through the injected Discovery controller", async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop-wide", "explicit viewport matrix owner");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page, { settingOverrides: { enableCheckBlacklist: "no", enableCheckFavoriteActress: "no", enableCheckNewVideo: "no" } });
    await expect.poll(() => page.evaluate(() => Boolean(window.unsafeWindow.pluginManager.getBean("TaskPlugin")?.featureNewVideoScanController))).toBe(true);
    const result = await page.evaluate(async () => {
        const manager = window.unsafeWindow.pluginManager;
        const task = manager.getBean("TaskPlugin");
        const controller = task.featureNewVideoScanController;
        if (!controller) throw new Error("Discovery scan controller was not attached to TaskPlugin");
        const pages = [];
        controller.actressInfo.collection = async (_provider, { pageUrl }) => {
            pages.push(pageUrl);
            if (pageUrl.includes("page=2")) return {
                state: "valid", actors: [{ starId: "sync-actor-2", name: "Synthetic Actor Two", allName: ["Synthetic Actor Two"], avatar: "", actressType: "censored" }], nextUrl: null, isEmpty: false,
            };
            return {
                state: "valid", actors: [{ starId: "sync-actor-1", name: "Synthetic Actor One", allName: ["Synthetic Actor One"], avatar: "", actressType: "censored" }], nextUrl: "/users/collection_actors?page=2", isEmpty: false,
            };
        };
        task.javDbUrl = "https://javdb.com";
        task.ensureReady = async () => {};
        task.shouldStartTask = async () => true;
        task.beginTaskAttempt = () => Date.now();
        task.withActiveTask = (_name, runner) => runner();
        task.finalizeTask = async () => {};
        task.emitNewVideoChanged = async () => { throw new Error("synthetic UI notification failure"); };
        const sync = await task.checkFavoriteActress(true);
        const saved = await window.unsafeWindow.storageManager.getFavoriteActressList();
        return { pages, sync, saved: saved.filter((entry) => entry.starId.startsWith("sync-actor-")) };
    });
    expect(result.pages).toEqual([
        "https://javdb.com/users/collection_actors",
        "https://javdb.com/users/collection_actors?page=2",
    ]);
    expect(result.sync).toMatchObject({ attempted: true, completed: true, success: 2, actorCount: 2, pages: 2 });
    expect(result.saved.map((entry) => entry.starId)).toEqual(["sync-actor-1", "sync-actor-2"]);
});

test("scheduled blacklist scans use the Library Feature controller and preserve the stored record", async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop-wide", "explicit viewport matrix owner");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page, { settingOverrides: { enableCheckBlacklist: "no", enableCheckFavoriteActress: "no", enableCheckNewVideo: "no" } });
    await expect.poll(() => page.evaluate(() => {
        const task = window.unsafeWindow.pluginManager.getBean("TaskPlugin");
        return Boolean(task?.service && task.featureBlacklistScanController);
    })).toBe(true);
    const result = await page.evaluate(async () => {
        const manager = window.unsafeWindow.pluginManager;
        const task = manager.getBean("TaskPlugin");
        const controller = task.featureBlacklistScanController;
        const starId = "feature-blacklist-scan-actor";
        await window.unsafeWindow.storageManager.addBlacklistItem({
            starId, name: "Synthetic Blacklist Actor", allName: ["Synthetic Blacklist Actor"], role: "actor", movieType: "",
            url: `https://javdb.com/actors/${starId}?t=d`,
        });
        controller.http.request = async () => ({ data: "synthetic actor page" });
        controller.parsePage = async () => ({ records: [{
            carNum: "NV-BLACKLIST-001", url: "https://javdb.com/v/nv-blacklist-001", names: "Synthetic Blacklist Actor",
            actionType: "filter", starId, publishTime: "2026-09-20",
        }], lastPublishTime: "2026-09-20", recordCount: 1 });
        const delegated = [];
        const scan = controller.scan.bind(controller);
        controller.scan = async (options) => { delegated.push(options.currentHostname); return scan(options); };
        task.taskConfig = { checkConcurrencyCount: 1, checkRequestSleep: 0, checkBlacklist_intervalTime: 12, checkBlacklist_ruleTime: 8760 };
        task.ensureReady = async () => {};
        task.shouldStartTask = async () => true;
        task.beginTaskAttempt = () => Date.now();
        task.withActiveTask = (_name, runner) => runner();
        task.finalizeTask = async () => {};
        task.renderBlacklistResult = () => {};
        const result = await task.checkBlacklist(true);
        const actors = await window.unsafeWindow.storageManager.getBlacklist();
        const cars = await window.unsafeWindow.storageManager.getBlacklistCarList();
        return { delegated, result, actor: actors.find((entry) => entry.starId === starId), cars: cars.filter((entry) => entry.carNum === "NV-BLACKLIST-001") };
    });
    expect(result.delegated).toEqual(["javdb.com"]);
    expect(result.result).toMatchObject({ attempted: true, completed: true, success: 1, networkFailed: 0, parseFailed: 0 });
    expect(result.actor).toMatchObject({ starId: "feature-blacklist-scan-actor", checkTime: expect.any(String), lastPublishTime: "2026-09-20" });
    expect(result.cars).toHaveLength(1);
});
