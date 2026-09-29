import {test,expect} from "@playwright/test";
import {fulfillHostFixtures,injectUserscriptRuntime} from "../harness/runtime.js";

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
    await expect.poll(() => page.evaluate(() => Boolean(window.unsafeWindow.pluginManager.getBean("TaskPlugin")))).toBe(true);
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
