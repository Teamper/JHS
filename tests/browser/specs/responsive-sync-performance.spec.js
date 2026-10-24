import { test, expect } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

// Tracing snapshots traverse the full DOM on each input and would contaminate latency.
test.use({ trace: "off", screenshot: "off" });
const baseline = process.env.JHS_PERF_BASELINE === "1";
const captureCpu = process.env.JHS_PERF_CPU === "1";
const captureDiagnostics = process.env.JHS_PERF_DIAGNOSTICS === "1";
for (const [cards, records] of [[40, 1000], [200, 1000], [1000, 10000]]) {
  test("hover and state persistence during mixed sync " + cards + " cards / " + records + " records", async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop-wide", "one fixed mouse environment");
    test.setTimeout(180000);
    await fulfillHostFixtures(context); await page.goto("https://javdb.com/");
    await page.evaluate(count => {
      const root = document.querySelector(".movie-list"), original = root.firstElementChild;
      const image = original.querySelector("img"), cover = document.createElement("div");
      cover.className = "cover"; image.before(cover); cover.append(image);
      image.src = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="#778899"/></svg>');
      for (let i = 1; i < count; i++) { const copy = original.cloneNode(true); copy.querySelector("strong").textContent = "CARD-" + i; root.append(copy); }
      document.querySelector(".pagination-next")?.remove();
    }, cards);
    await injectUserscriptRuntime(page, { settingOverrides: { hoverBigImg: "yes", autoPage: "no", enableTranslation: "no", defaultQuickFilterTab: "all" } });
    await page.evaluate(async count => {
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
      await storage.setItem("car_list", Array.from({ length: count }, (_, i) => ({ carNum: "LIB-" + i, names: "Synthetic title " + i, stateFlags: { favorite: true } })));
      await storage.setItem("favorite_actresses", Array.from({ length: count / 100 }, (_, i) => ({ starId: "actor-" + i, name: "Synthetic Actor", newVideoList: Array.from({ length: 100 }, (_, j) => ({ carNum: "NEW-" + (i * 100 + j), names: "New work" })) })));
      await storage.setItem("activity_log", { entries: Array.from({ length: 320 }, (_, i) => ({ id: "log-" + i, type: "mark", commitState: "committed", createdAt: "2026-10-20T00:00:00.000Z", changes: [] })) });
      // Exercise a real held-lock snapshot boundary; record traversal now runs
      // outside that lock and must not be used as evidence of lock ownership.
      const boundary = typeof service.deps.store.captureReconciliation === "function" ? "captureReconciliation" : "reconcileWithoutLock";
      const reconcile = service.deps.store[boundary].bind(service.deps.store);
      service.deps.store[boundary] = async (...args) => {
        if (window.armMixedState) {
          window.armMixedState = false;
          const locks = await navigator.locks.query();
          window.mixedStateRequestedWhileLocked = locks.held.some(lock => lock.name === "jhs_storage_mutation_v1");
          window.requestMixedState({ watched: true });
        }
        return reconcile(...args);
      };
      const state = window.stateService, withLock = state._withLock.bind(state);
      state._withLock = operation => {
        const requestedAt = performance.now();
        return withLock(async () => { window.mixedStateRequestWait = performance.now() - requestedAt; return operation(); });
      };
      window.requestMixedState = patch => {
        const stateStart = performance.now();
        window.mixedStatePromise = state.patch("ABC-123", patch).then(() => { window.mixedStateDuration = performance.now() - stateStart; });
      };
      window.mixedSync = service;
      window.hoverSamples = []; window.mixedLongTasks = [];
      window.mixedObserver = new PerformanceObserver(list => { window.mixedLongTasks.push(...list.getEntries().map(e => e.duration)); });
      window.mixedObserver.observe({ type: "longtask" });
      document.addEventListener("mousemove", event => {
        if (!event.isTrusted || !event.target.closest?.(".cover img")) return;
        requestAnimationFrame(() => setTimeout(() => window.hoverSamples.push(performance.now() - event.timeStamp), 0));
      }, true);
    }, records);
    const image = page.locator(".movie-list .cover img").first();
    const box = await image.boundingBox(); expect(box).not.toBeNull();
    const cpu = captureCpu ? await context.newCDPSession(page) : null;
    if (cpu) { await cpu.send("Profiler.enable"); await cpu.send("Profiler.setSamplingInterval", { interval: 1000 }); }
    const rounds = Number.parseInt(process.env.JHS_PERF_ROUNDS || "0", 10) || (records === 10000 ? 3 : 2);
    for (let round = 0; round < rounds; round++) {
      if (cpu) await cpu.send("Profiler.start");
      await page.evaluate(({ round, captureDiagnostics }) => {
        window.hoverSamples = []; window.mixedLongTasks = [];
        const diagnostics = window.unsafeWindow.pluginManager.diagnostics;
        if (captureDiagnostics) diagnostics.startPerformanceCapture?.();
        window.mixedStateDuration = null; window.mixedStateRequestWait = null;
        window.mixedStateRequestedWhileLocked = false;
        window.mixedStatePromise = Promise.resolve();
        window.armMixedState = round === 2;
        const start = performance.now();
        window.mixedSyncPromise = window.mixedSync.check().then(() => {
          window.mixedSyncDuration = performance.now() - start;
          if (window.mixedSync.message) throw new Error(window.mixedSync.message);
        });
        if (round === 1) window.requestMixedState({ favorite: true });
      }, { round, captureDiagnostics });
      for (let i = 0; i < 8; i++) {
        await page.mouse.move(4, 4);
        await page.mouse.move(box.x + box.width / 2 + i, box.y + box.height / 2);
        expect(await page.evaluate(() => document.querySelector(".image-hover-preview")?.classList.contains("active"))).toBe(true);
      }
      const result = await page.evaluate(async () => {
        await window.mixedSyncPromise; await window.mixedStatePromise;
        await new Promise(resolve => setTimeout(resolve, 50));
        const diagnostics = window.unsafeWindow.pluginManager.diagnostics;
        const result = { hoverPaintMs: window.hoverSamples, longTasks: window.mixedLongTasks, syncMs: window.mixedSyncDuration, stateCommitMs: window.mixedStateDuration, stateRequestWaitMs: window.mixedStateRequestWait, requestedWhileSyncLocked: window.mixedStateRequestedWhileLocked, diagnostics: diagnostics.performanceSnapshot?.() };
        diagnostics.stopPerformanceCapture?.(); return result;
      });
      if (cpu) {
        const { profile } = await cpu.send("Profiler.stop");
        const nodes = new Map(profile.nodes.map(node => [node.id, node.callFrame])), weights = new Map();
        profile.samples.forEach((id, i) => weights.set(id, (weights.get(id) || 0) + profile.timeDeltas[i]));
        const top = [...weights].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([id, micros]) => ({ ...nodes.get(id), selfMs: micros / 1000 }));
        console.log(JSON.stringify({ cpuRound: round, top }));
        await info.attach("cpu-profile-" + round, { body: JSON.stringify(profile), contentType: "application/json" });
      }
      console.log(JSON.stringify({ baseline, cards, records, round, ...result }));
      await info.attach("mixed-sync-" + round, { body: JSON.stringify(result, null, 2), contentType: "application/json" });
      expect(result.hoverPaintMs.length).toBeGreaterThan(0);
      if (round === 2) expect(result.requestedWhileSyncLocked).toBe(true);
    }
    await page.mouse.move(4, 4);
    await expect.poll(() => page.evaluate(() => document.querySelector(".image-hover-preview")?.classList.contains("active"))).toBe(false);
    await page.evaluate(() => window.mixedObserver.disconnect());
  });
}
