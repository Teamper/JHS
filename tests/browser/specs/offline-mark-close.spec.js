import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop-wide", "deterministic iframe persistence flow"));

for (const [cards, library, filter, suppressBroadcast] of [[40, 1000, "waitCheck", true], [200, 1000, "all", false], [1000, 10000, "undownloaded", false], [40, 1000, "hasDown", false]]) {
    test(`offline mark really saves, closes and refreshes ${cards} cards ${library} records ${filter}`, async ({ page, context }, info) => {
        test.setTimeout(180000);
        await fulfillHostFixtures(context);
        const html = await readFile(new URL("../fixtures/javdb-detail-interactions.html", import.meta.url), "utf8");
        await context.route("https://javdb.com/v/**", route => route.fulfill({ contentType: "text/html", body: html }));
        await page.goto("https://javdb.com/");
        const settings = { autoPage: "no", enableTranslation: "no", enableLoadReview: "no", enableLoadPreviewVideo: "no", needClosePage: "yes", defaultQuickFilterTab: "waitCheck" };
        await injectUserscriptRuntime(page, { settingOverrides: settings, beforeUserscriptInjection: async host => {
            await host.evaluate(async ({ cards, library }) => {
                const root = document.querySelector(".movie-list"), template = root.firstElementChild;
                for (let i = 1; i < cards; i++) {
                    const card = template.cloneNode(true);
                    card.querySelector("strong").textContent = i === 1 ? "ABC-123" : `CARD-${i}`;
                    root.append(card);
                }
                const f = window.localforage.createInstance({ name: "JAV-JHS", storeName: "appData" });
                await f.setItem("car_list", Array.from({ length: library }, (_, i) => ({ carNum: `LIB-${i}`, stateFlags: { favorite: false } })));
                await f.setItem("favorite_actresses", Array.from({ length: 100 }, (_, i) => ({ starId: `actor-${i}`, name: "Fixture", newVideoList: Array.from({ length: 60 }, (_, j) => ({ carNum: `NEW-${i * 60 + j}`, title: "Fixture" })) })));
                await f.setItem("activity_log", { entries: Array.from({ length: 1000 }, (_, i) => ({ id: `old-${i}`, createdAt: new Date().toISOString(), commitState: "committed", changes: [] })) });
            }, { cards, library });
        } });
        await page.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
        await page.evaluate(() => {
            const root = document.querySelector(".movie-list"); root.replaceChildren(...[...root.children].reverse());
            window.__offlineSubmitCount = 0; window.__markTiming = {};
        });
        await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getBean("ListPagePlugin").getIndexedItems(["ABC-123"]).length)).toBe(2);
        const navigation = page.waitForEvent("framenavigated", { predicate: frame => frame !== page.mainFrame() && frame.url().includes("/v/") });
        await page.locator(".movie-list .item").filter({ hasText: "ABC-123" }).first().locator(".video-title").click();
        const frame = await navigation;
        await injectUserscriptRuntime(frame, { preserveStorage: true });
        await frame.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
        await page.evaluate(filter => window.unsafeWindow.pluginManager.getBean("ListPagePlugin").setQuickFilter(filter), filter);
        await page.evaluate(async () => {
            const list = window.unsafeWindow.pluginManager.getBean("ListPagePlugin");
            await list.filterContextProvider.get();
            window.__markReads = { rules: 0, historyUi: 0 };
            const keywords = list.getRuntimeService("titleKeywords"), readRules = keywords.getAll.bind(keywords);
            keywords.getAll = (...args) => { window.__markReads.rules++; return readRules(...args); };
            const state = window.stateService, readHistory = state.getActivityLog.bind(state);
            state.getActivityLog = (...args) => { window.__markReads.historyUi++; return readHistory(...args); };
        });
        await frame.evaluate(async suppressBroadcast => {
            const controller = window.unsafeWindow.pluginManager.getBean("UnifiedOfflinePlugin");
            controller.registry = { getCandidates: async () => [{ provider: { id: "123", name: "123", isEnabled: async () => true, submit: async () => { window.parent.__offlineSubmitCount++; } }, availability: { authState: "ready" } }], updateAvailability() {} };
            const store = window.storageManager.syncState;
            await store.merge([], "fixture-joined", async () => {});
            store.deps.backgroundWork = { waitForTurn: () => new Promise(() => {}) };
            store.reconcileWithoutLock = () => new Promise(() => {});
            if (suppressBroadcast) window.jhsEventBus.channel.postMessage = () => {};
            const state = window.stateService, commit = state._commit.bind(state);
            state._commit = async (...args) => { const value = await commit(...args); window.parent.__markTiming.durableAt = window.parent.performance.now(); return value; };
            window.jhsEventBus.on("car-state-changed", () => { window.parent.__localMarkListenerEntered = true; return new Promise(() => {}); });
        }, suppressBroadcast);
        await frame.locator(".jhs-offline-native").first().click();
        await expect(frame.getByRole("button", { name: "标记已下载", exact: true })).toBeVisible();
        await page.evaluate(() => {
            window.__markTiming.clickedAt = performance.now();
            const observer = new MutationObserver(() => {
                if (!document.querySelector("iframe")) { window.__markTiming.closedAt = performance.now(); observer.disconnect(); }
            }); observer.observe(document.body, { childList: true, subtree: true });
        });
        await frame.getByRole("button", { name: "标记已下载", exact: true }).click();
        await expect(page.locator("iframe")).toHaveCount(0, { timeout: 10000 });
        const targetCards = page.locator(".movie-list .item").filter({ hasText: "ABC-123" });
        for (let i = 0; i < 2; i++) {
            if (["all", "hasDown"].includes(filter)) await expect(targetCards.nth(i)).toBeVisible();
            else await expect(targetCards.nth(i)).toBeHidden();
        }
        const result = await page.evaluate(async () => ({
            timing: window.__markTiming, submits: window.__offlineSubmitCount,
            downloaded: (await window.stateService.getState("ABC-123")).stateFlags.downloaded,
            history: (await window.stateService.getOfflineHistory()).filter(item => item.carNum === "ABC-123").length,
            journal: await window.storageManager.forage.getItem("mutation_journal"),
            reads: window.__markReads, listenerEntered: !!window.__localMarkListenerEntered,
        }));
        expect(result).toMatchObject({ submits: 1, downloaded: true, history: 1, journal: null, reads: { rules: 0, historyUi: 0 }, listenerEntered: true });
        expect(result.timing.closedAt).toBeGreaterThanOrEqual(result.timing.durableAt);
        console.log(JSON.stringify({ cards, library, filter, suppressBroadcast, ...result }));
        await info.attach("offline-save-close", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
    });
}
