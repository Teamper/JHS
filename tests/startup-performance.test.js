import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { CommandRegistry } from "../src/app/command-registry.js";
import { DependencyContainer } from "../src/app/dependency-container.js";
import { FeatureRuntime } from "../src/app/feature-runtime.js";
import { defineFeature } from "../src/contracts/manifests.js";
import { SERVICE } from "../src/contracts/tokens.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";

const repoRoot = join(import.meta.dirname, "..");

function loadStorageManager(forage) {
  const context = vm.createContext({
    console,
    localforage: {
      INDEXEDDB: "indexeddb",
      createInstance: () => forage
    },
    i: (target, key, value) => (target[key] = value)
  });
  const source = `${readTestFile(join(repoRoot, "src/core/storage.js"), "utf8")}\nglobalThis.TestStorageManager = StorageManager;`;
  vm.runInContext(source, context);
  return new context.TestStorageManager();
}

function loadTaskPlugin(gmHttp, overrides = {}) {
  const defaultUtils = { sleep: vi.fn(async () => {}), getNowStr: vi.fn(() => "2026-08-11 20:00:00") };
    const storageManager = { getSetting: vi.fn(async () => ({})), ...(overrides.storageManager || {}) };
    const window = { location: new URL("https://javdb.example/"), isListPage: true, navigator: { locks: { request: vi.fn(async (_key, _options, callback) => callback({})) } } };
    const document = { hidden: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const scope = { assertActive: vi.fn(), listen: vi.fn(), addCleanup: vi.fn(), disposed: false };
    const context = vm.createContext({
    console,
    URL,
    gmHttp,
    i: (target, key, value) => (target[key] = value),
    BasePlugin: class {},
    T: "javdb",
    I: "javbus",
    D: "censored",
    A: "uncensored",
    StorageQueue: class { constructor() { this.queue = Promise.resolve(); } },
    clog: { log: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
    show: { info: vi.fn(), error: vi.fn() },
    utils: { ...defaultUtils, ...overrides.utils },
    storageManager,
    window,
    document,
    storage: { getLocal: vi.fn(), setLocal: vi.fn() },
    scope,
    readListItem: () => ({ carNum: "TEST-1", url: "", title: "", publishTime: "" }),
    parseNumberSetting: (value, fallback, { min = -Infinity, max = Infinity } = {}) => { const number = Number(value); return Number.isFinite(number) && number >= min && number <= max ? number : fallback; },
    parseTaskTimestamp: value => { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : null; },
    selectLatestPublishTime: values => values.filter(Boolean).sort().pop() || null,
    shouldSkipStopped: () => false,
    normalizeCarNum: value => String(value || "").toUpperCase(),
    escapeHtml: value => String(value ?? ""),
    $: () => ({ text: vi.fn() })
  });
  const parsers = ["src/integrations/javdb/parser.js", "src/core/host-list-parser.js"].map((file) => readTestFile(join(repoRoot, file), "utf8")).join("\n");
  const taskSource = readTestFile(join(repoRoot, "src/features/discovery/task-controller.js"), "utf8")
    .replace(/^import .*;\r?\n/gm, "")
    .replace("export class TaskController", "class TaskController");
  const source = `${parsers}\n${taskSource}\nglobalThis.TestTaskController = TaskController;`;
  vm.runInContext(source, context);
  const task = new context.TestTaskController({
    document,
    window,
    storage: context.storage,
    legacyStorage: storageManager,
    http: {},
    actressInfo: { collection: async (_integrationId, input) => gmHttp.get(input.pageUrl) },
    movie: { externalSiteOrigin: () => "https://javdb.example" },
    features: {},
    settings: { snapshot: () => ({}) },
    eventBus: {},
    ui: { getJQuery: () => context.$, getUtils: () => context.utils, getClog: () => context.clog, show: context.show },
    scope,
  });
  return task;
}

function loadStorageQueue() {
  const context = vm.createContext({ clog: { error: vi.fn() } });
  const queueSource = readTestFile(join(repoRoot, "src/core/storage-queue.js"), "utf8");
  vm.runInContext(`${queueSource}\nglobalThis.TestStorageQueue = StorageQueue;`, context);
  return { Queue: context.TestStorageQueue, error: context.clog.error };
}

function loadHttpManager(requestHandler) {
  class TestUtils {
    async retry(action, attempts = 3) {
      let lastError;
      for (let attempt = 0; attempt < attempts; attempt++) {
        try { return await action(); } catch (error) {
          if (error?._cfBlocked || error?._circuitBroken) throw error;
          lastError = error;
        }
      }
      throw lastError;
    }
  }
  class TestStorage {
    async getSetting(_key, fallback) { return fallback; }
  }
  const context = {
    console,
    URL,
    URLSearchParams,
    clog: { log: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
    GM_xmlhttpRequest: requestHandler
  };
  context.window = context;
  context.unsafeWindow = context;
  vm.runInContext(`${readTestFile(join(repoRoot, "src/core/http.js"), "utf8")};globalThis.TestGmHttp=GmHttp`, vm.createContext(context));
  return new context.TestGmHttp({ utils: new TestUtils(), storageManager: new TestStorage() });
}

describe("startup scheduling", () => {
  it("settles all eager features before returning and records degraded failures", async () => {
    const events = [], diagnostics = new DiagnosticsService(), runtime = new FeatureRuntime({
      container: new DependencyContainer(), commands: new CommandRegistry(), diagnostics, site: "javdb", route: "list",
    });
    runtime.register(defineFeature({
      id: "slow", kind: "feature", disableable: true, sites: ["javdb"], routes: ["list"], startup: "eager", requires: [], contributes: [], providesCommands: [],
      activate: async () => { await new Promise((resolve) => setTimeout(resolve, 10)); events.push("slow"); return {}; },
    }));
    runtime.register(defineFeature({
      id: "broken", kind: "feature", disableable: true, sites: ["javdb"], routes: ["list"], startup: "eager", requires: [], contributes: [], providesCommands: [],
      activate: async () => { await new Promise((resolve) => setTimeout(resolve, 1)); throw new Error("broken"); },
    }));

    await runtime.start();

    expect(events).toEqual(["slow"]);
    expect(diagnostics.exportSnapshot().featureStates.broken).toMatchObject({ state: "degraded", message: "broken" });
  });

  it("defers idle features until the browser idle callback", async () => {
    const callbacks = [], events = [], previous = globalThis.requestIdleCallback;
    globalThis.requestIdleCallback = (callback) => callbacks.push(callback);
    const runtime = new FeatureRuntime({
      container: new DependencyContainer(), commands: new CommandRegistry(), diagnostics: new DiagnosticsService(), site: "javdb", route: "list",
    });
    runtime.register(defineFeature({
      id: "idle", kind: "feature", disableable: true, sites: ["javdb"], routes: ["list"], startup: "idle", requires: [], contributes: [], providesCommands: [],
      activate: () => { events.push("idle"); return {}; },
    }));
    try {
      await runtime.start();
      expect(events).toEqual([]);
      await callbacks[0]();
      expect(events).toEqual(["idle"]);
    } finally {
      if (previous) globalThis.requestIdleCallback = previous;
      else delete globalThis.requestIdleCallback;
    }
  });

  it("does not include removed legacy service integrations", () => {
    const mainSource = readTestFile(join(repoRoot, "src/main.js"), "utf8");
    const utilsSource = readTestFile(join(repoRoot, "src/core/utils.js"), "utf8");

    expect(mainSource).not.toContain("parallel_GM_xmlhttpRequest.js");
    expect(mainSource).not.toContain("@connect      127.0.0.1");
    expect(utilsSource).not.toContain("pingLocalService");
    expect(() => readTestFile(join(repoRoot, "src/plugins/registry.js"), "utf8")).toThrow();
  });

  it("does not include audited dead methods", () => {
    const sourceFiles = [
      "src/core/http.js",
      "src/core/storage.js",
      "src/core/utils.js",
      "src/features/library/blacklist-controller.js",
      "src/features/list/list-fc2-lookup-controller.js",
      "src/features/detail/detail-screenshot-controller.js",
      "src/features/list/list-auto-page-controller.js"
    ];
    const source = sourceFiles.map((file) => readTestFile(join(repoRoot, file), "utf8")).join("\n");
    const removedMethods = [
      "getUsedDomains", "postForm", "postFileFormData", "downloadFileInChunks",
      "getActressMap", "getThirdPartyCacheStats", "resetCacheHitStats",
      "simpleId", "reBuildSignature", "addCookie", "getCurrentStarUrl",
      "parseUrlId", "getMovie", "getJavBestScreenShot", "getJavFreeScreenShot",
      "updatePageUrl_old"
    ];

    for (const method of removedMethods) expect(source).not.toContain(`${method}(`);
  });
});

describe("storage read coalescing", () => {
  it("uses one IndexedDB read for concurrent cache misses", async () => {
    const getItem = vi.fn(async (key) => key === "setting" ? { theme: "dark" } : []);
    const storage = loadStorageManager({ getItem, setItem: vi.fn() });

    const [first, second] = await Promise.all([storage.getSetting(), storage.getSetting()]);

    expect(getItem).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ theme: "dark" });
    expect(second).toEqual({ theme: "dark" });
  });

  it("does not let an invalidated pending read repopulate the cache", async () => {
    let resolveFirst;
    const firstRead = new Promise((resolve) => { resolveFirst = resolve; });
    const getItem = vi.fn()
      .mockReturnValueOnce(firstRead)
      .mockResolvedValueOnce({ generation: "new" });
    const storage = loadStorageManager({ getItem, setItem: vi.fn() });

    const pending = storage.getSetting();
    storage._invalidateCache(storage.setting_key);
    resolveFirst({ generation: "old" });
    await expect(pending).resolves.toEqual({ generation: "old" });
    expect(storage.cacheSettingObj).toBeNull();
    await expect(storage.getSetting()).resolves.toEqual({ generation: "new" });
    expect(getItem).toHaveBeenCalledTimes(2);
  });
});

describe("blocked network task termination", () => {
  it("initializes direct task entrypoints without relying on idle startup", async () => {
    const task = loadTaskPlugin({ get: vi.fn() });
    task.loadConfig = vi.fn(async () => { task.taskConfig = { checkConcurrencyCount: 2 }; });

    await task.ensureReady();

    expect(task.loadConfig).toHaveBeenCalledOnce();
    expect(task.javDbUrl).toBe("https://javdb.example");
  });

  it("propagates queue failures while allowing later tasks to run", async () => {
    const { Queue, error } = loadStorageQueue();
    const queue = new Queue(), events = [];
    const failed = queue.addTask(async () => { events.push("failed"); throw new Error("write failed"); });
    const succeeded = queue.addTask(async () => { events.push("succeeded"); return 42; });

    await expect(failed).rejects.toThrow("write failed");
    await expect(succeeded).resolves.toBe(42);
    await expect(queue.waitAllFinished()).resolves.toBe(42);
    expect(events).toEqual([ "failed", "succeeded" ]);
    expect(error).toHaveBeenCalledOnce();
  });

  it("treats an empty valid movie container as a successful empty result", async () => {
    const updateFavoriteActress = vi.fn(async () => true), task = loadTaskPlugin({ get: vi.fn() }, { storageManager: { updateFavoriteActress } });
    task.getSelector = () => ({ boxSelector: ".movie-list", requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next" });
    const dom = { find: (selector) => ({
      length: selector === ".movie-list" ? 1 : 0,
      first() { return this; },
      text: () => "",
      attr: () => undefined
    }) };

    await expect(task.parsePage(dom, "javdb", "actor-1", "演员", [], new Set())).resolves.toBe(0);
    expect(updateFavoriteActress).toHaveBeenCalledWith({ starId: "actor-1", lastCheckTime: "2026-08-11 20:00:00", newVideoList: [] });
  });

  it("rejects a structurally invalid empty page without advancing actress state", async () => {
    const updateFavoriteActress = vi.fn(), task = loadTaskPlugin({ get: vi.fn() }, { storageManager: { updateFavoriteActress } });
    task.getSelector = () => ({ boxSelector: ".movie-list", requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next" });
    const dom = { find: () => ({ length: 0, first() { return this; }, text: () => "", attr: () => undefined }) };

    await expect(task.parsePage(dom, "javdb", "actor-1", "演员", [], new Set())).rejects.toThrow("新作品检测-解析列表失败");
    expect(updateFavoriteActress).not.toHaveBeenCalled();
  });

  it("stops pagination after the first blocked page", async () => {
    const blocked = Object.assign(new Error("Cloudflare blocked"), { _cfBlocked: true });
    const get = vi.fn().mockRejectedValue(blocked);
    const task = loadTaskPlugin({ get });
    task.javDbUrl = "https://javdb.example";

    await expect(task.scrapeActorInfo("https://javdb.example/users/collection_actors", [])).rejects.toBe(blocked);

    expect(get).toHaveBeenCalledTimes(1);
  });

  it("stops scheduling the batch when the domain is blocked", async () => {
    const blocked = Object.assign(new Error("circuit open"), { _circuitBroken: true });
    const task = loadTaskPlugin({ get: vi.fn() });
    const handler = vi.fn(async () => { throw blocked; });

    await expect(task.limitConcurrency(Array.from({ length: 100 }, (_, index) => index), 2, 100, handler)).rejects.toBe(blocked);

    expect(handler).toHaveBeenCalledTimes(2);
  });
});

describe("HTTP Cloudflare handling", () => {
  it("rejects a 200 Cloudflare challenge as a blocked response", async () => {
    const request = vi.fn((options) => options.onload({
      status: 200,
      finalUrl: options.url,
      responseText: "<title>Just a moment...</title><div class=\"cf-chl-test\"></div>"
    }));
    const http = loadHttpManager(request);

    let error;
    try { await http.get("https://javdb.example/actors/1"); } catch (caught) { error = caught; }

    expect(error?._cfBlocked).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(http.getCircuitBreakerStatus()["javdb.example"].failCount).toBe(1);
  });

  it("allows one half-open probe and closes the breaker on success", async () => {
    const request = vi.fn((options) => options.onload({ status: 200, finalUrl: options.url, responseText: "{}" }));
    const http = loadHttpManager(request);
    http._circuitBreakers.set("javdb.example", {
      state: "half-open", failCount: 0, openTime: 0, cooldownMs: 60000, threshold: 3, probing: false
    });

    await expect(http.get("https://javdb.example/actors/1")).resolves.toEqual({});

    expect(request).toHaveBeenCalledTimes(1);
    expect(http.getCircuitBreakerStatus()["javdb.example"]).toMatchObject({ state: "closed", probing: false, failCount: 0 });
  });

  it("preserves the POST method while checking the circuit breaker before retries", async () => {
    const request = vi.fn((options) => options.onload({
      status: 200,
      finalUrl: options.url,
      responseText: '{"code":0}'
    }));
    const http = loadHttpManager(request);

    await expect(http.post(
      "https://yun.123pan.com/resolve",
      { urls: "magnet:test" },
      { Authorization: "Bearer token" }
    )).resolves.toEqual({ code: 0 });

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toMatchObject({
      method: "POST",
      url: "https://yun.123pan.com/resolve",
      data: '{"urls":"magnet:test"}',
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" }
    });
  });
});
