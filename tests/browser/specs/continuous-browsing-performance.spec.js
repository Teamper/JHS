import { test, expect } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

// Tracing snapshots traverse the full DOM on each input and would contaminate latency.
test.use({ trace: "off", screenshot: "off" });

const baseline = process.env.JHS_PERF_BASELINE === "1";
const sizes = [[40, 1000], [200, 1000], [1000, 10000]];

for (const [cards, records] of sizes) test(`JavDB continuous browsing ${cards} cards / ${records} records`, async ({ context, page }, info) => {
    test.skip(info.project.name !== "desktop-wide", "fixed performance environment");
    test.setTimeout(180000);
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
    await page.evaluate(count => {
        const list = document.querySelector(".movie-list"), original = list.firstElementChild;
        for (let index = 1; index < count; index++) {
            const card = original.cloneNode(true); card.querySelector("strong").textContent = `PERF-${index}`; list.append(card);
        }
        document.querySelector(".pagination-next")?.remove();
    }, cards);
    const raw = await context.newCDPSession(page); await raw.send("Performance.enable");
    const nativeScroll = await page.evaluate(async () => {
        const samples = []; let previous = performance.now();
        for (let index = 0; index < 20; index++) {
            window.scrollTo(0, index % 2 ? 0 : document.body.scrollHeight);
            await new Promise(resolve => requestAnimationFrame(resolve));
            const now = performance.now(); samples.push(now - previous); previous = now;
        }
        window.scrollTo(0, 0); return samples;
    });
    await injectUserscriptRuntime(page, { settingOverrides: { autoPage: "no", enableTranslation: "no" }, beforeUserscriptInjection: async page => {
        await page.evaluate(async count => {
            const store = window.localforage.createInstance({ name: "JAV-JHS", storeName: "appData" });
            await store.setItem("car_list", Array.from({ length: count }, (_, index) => ({ carNum: `LIB-${index}`, stateFlags: { favorite: true } })));
        }, records);
    } });
    await expect.poll(() => page.locator('.item[data-jhs-processed="true"]').count()).toBe(cards);
    const before = await raw.send("Performance.getMetrics");
    const measurements = await page.evaluate(async sampleCount => {
        const manager = window.unsafeWindow.pluginManager, diagnostics = manager.diagnostics;
        diagnostics.startPerformanceCapture?.();
        const times = [], processed = [];
        for (let index = 0; index < sampleCount; index++) {
            window.__jhsBrowserDiagnostics.listPhases = [];
            const started = performance.now();
            await window.jhsEventBus.emit("car-state-changed", { carNums: ["ABC-123"] }, { broadcast: false });
            await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
            times.push(performance.now() - started);
            processed.push(window.__jhsBrowserDiagnostics.listPhases.filter(phase => phase.phase === "doFilter-start").reduce((sum, phase) => sum + phase.itemCount, 0));
            window.scrollTo(0, document.body.scrollHeight); window.scrollTo(0, 0);
        }
        const result = { times, processed, performance: diagnostics.performanceSnapshot?.() };
        diagnostics.stopPerformanceCapture?.(); return result;
    }, process.env.JHS_SERIAL_PERFORMANCE === "1" ? 30 : 5);
    const after = await raw.send("Performance.getMetrics");
    const metric = name => after.metrics.find(item => item.name === name).value - before.metrics.find(item => item.name === name).value;
    const report = { cards, records, baseline, nativeScroll, ...measurements, layoutSeconds: metric("LayoutDuration"), scriptSeconds: metric("ScriptDuration"), heapBytes: after.metrics.find(item => item.name === "JSHeapUsedSize").value };
    console.log(JSON.stringify(report)); await info.attach("continuous-browsing", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
    await info.attach("performance-gate", { body: JSON.stringify({ stateRefreshMs: measurements.times }), contentType: "application/json" });
    if (!baseline) expect(measurements.processed).toEqual(Array(measurements.times.length).fill(1));
});

test("JavDB no-change sync spans two foreground poll intervals", async ({ context, page }, info) => {
    test.skip(info.project.name !== "desktop-wide", "fixed performance environment");
    test.setTimeout(180000);
    await fulfillHostFixtures(context); await page.goto("https://javdb.com/"); await injectUserscriptRuntime(page);
    await page.evaluate(async () => {
        const service = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("webdavSync");
        service.cancel(); service.schedule = () => {}; service.reschedule = async () => {};
        service.deps.shared.migrate = async () => {};
        service.deps.shared.snapshot = async () => ({ revision: "performance-fixture", profile: { url: "https://fixture.invalid/dav", username: "synthetic", password: "synthetic" } });
        service.deps.shared.paused = async () => false;
        const files = new Map();
        service.deps.webdav.createClient = () => ({
            ensureFolder: async () => {}, listSyncFiles: async () => [...files.values()].map(value => value.meta),
            readSyncFile: async name => files.get(name)?.content ?? null,
            writeSyncFile: async (name, content) => { const state = await service.deps.store.read(); files.set(name, { content, meta: { ...state.pending, schema: 1, replicaId: state.replicaId } }); },
            deleteSyncFile: async name => files.delete(name),
        });
        const storage = service.deps.store.forage;
        await storage.setItem("car_list", Array.from({ length: 10000 }, (_, index) => ({ carNum: `SYNC-${index}`, stateFlags: { favorite: true } })));
        await service.check();
        if (service.message) throw new Error(service.message);
        window.perfSync = service; window.perfSyncSamples = [];
        window.perfSyncLongTasks = [];
        window.perfSyncObserver = new PerformanceObserver(list => {
            for (const entry of list.getEntries()) window.perfSyncLongTasks.push(entry.duration);
        });
        window.perfSyncObserver.observe({ type: "longtask" });
    });
    for (let index = 0; index < 2; index++) {
        await page.waitForTimeout(30500);
        const result = await page.evaluate(async () => {
            const started = performance.now(); window.__jhsBrowserDiagnostics.listPhases = [];
            await window.perfSync.check({ scheduled: true });
            if (window.perfSync.message) throw new Error(window.perfSync.message);
            const milliseconds = performance.now() - started;
            await new Promise(resolve => setTimeout(resolve, 50));
            const longTasks = window.perfSyncLongTasks.splice(0);
            return { milliseconds, longTasks, refreshes: window.__jhsBrowserDiagnostics.listPhases.filter(phase => phase.phase === "refresh-start").length };
        });
        console.log(JSON.stringify({ baseline, idleSync: result }));
        expect(result.refreshes).toBe(0);
        await info.attach(`idle-sync-${index}`, { body: JSON.stringify(result), contentType: "application/json" });
    }
    await page.evaluate(() => window.perfSyncObserver.disconnect());
});

test("JavDB trusted filter clicks report paint latency on a long list", async ({ context, page }, info) => {
    test.skip(info.project.name !== "desktop-wide", "fixed interaction environment");
    test.setTimeout(60000);
    await fulfillHostFixtures(context); await page.goto("https://javdb.com/");
    await page.evaluate(() => {
        const root = document.querySelector(".movie-list"), card = root.firstElementChild;
        for (let index = 1; index < 1000; index++) {
            const copy = card.cloneNode(true); copy.querySelector("strong").textContent = `CLICK-${index}`; root.append(copy);
        }
        document.querySelector(".pagination-next")?.remove();
    });
    await injectUserscriptRuntime(page, { settingOverrides: { autoPage: "no" } });
    await expect.poll(() => page.locator('.item[data-jhs-processed="true"]').count()).toBe(1000);
    await page.evaluate(() => {
        window.clickPaintSamples = [];
        document.querySelector("#jhs-quick-filter").addEventListener("click", event => {
            if (!event.isTrusted) return;
            requestAnimationFrame(() => setTimeout(() => window.clickPaintSamples.push(performance.now() - event.timeStamp), 0));
        }, true);
    });
    const filters = process.env.JHS_SERIAL_PERFORMANCE === "1" ? Array.from({length: 30}, (_, index) => index % 2 ? "all" : "favorite") : ["favorite", "all", "favorite", "all", "waitCheck"];
    for (const filter of filters) {
        await page.locator(`#jhs-quick-filter .jhs-segmented__item[data-jhs-filter="${filter}"]`).click();
    }
    await expect.poll(() => page.evaluate(() => window.clickPaintSamples.length)).toBe(filters.length);
    const durations = await page.evaluate(() => window.clickPaintSamples);
    await info.attach("performance-gate", { body: JSON.stringify({ trustedClickPaintMs: durations }), contentType: "application/json" });
    console.log(JSON.stringify({ trustedFilterPaintMilliseconds: durations }));
    await info.attach("trusted-filter-paint", { body: JSON.stringify(durations), contentType: "application/json" });
});
