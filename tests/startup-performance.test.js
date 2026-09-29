import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { CompatibilityBeanRegistry } from "../src/core/compatibility-bean-registry.js";

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
  const legacyStorage = overrides.storageManager || { getSetting: vi.fn(async () => ({})) };
  const runtimeStorage = { getLocal: vi.fn(() => null), setLocal: vi.fn(), removeLocal: vi.fn() };
  const movie = { externalSiteOrigin: vi.fn(() => "https://javdb.example") };
  const context = vm.createContext({
    console,
    URL,
    gmHttp,
    i: (target, key, value) => (target[key] = value),
    T: "javdb",
    I: "javbus",
    D: "censored",
    A: "uncensored",
    _: "yes",
    l: false,
    escapeHtml: value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] || character)),
    normalizeCarNum: value => String(value || "").toUpperCase(),
    readListItem: () => ({}),
    StorageQueue: class { constructor() { this.queue = Promise.resolve(); } },
    clog: { log: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
    show: { info: vi.fn(), error: vi.fn() },
    utils: { ...defaultUtils, ...overrides.utils },
    storageManager: legacyStorage,
    selectLatestPublishTime: values => values.filter(Boolean).sort().at(-1) || "",
    $: () => ({ text: vi.fn() })
  });
  const parsers = ["src/core/site-context.js", "src/core/feature-helpers.js", "src/integrations/javdb/parser.js", "src/integrations/host-list/parser.js"].map((file) => readTestFile(join(repoRoot, file), "utf8")).join("\n");
  const taskSource = readFileSync(join(repoRoot, "src/features/discovery/task-execution-service.js"), "utf8")
    .replace(/^\s*import\s+[^;]+;\s*$/gm, "")
    .replace(/^export\s+(?=class\s)/gm, "");
  const source = `${parsers}\n${taskSource}\nglobalThis.TestTaskPlugin = TaskExecutionService;`;
  vm.runInContext(source, context);
  const task = new context.TestTaskPlugin({
    runtimeServices: {
      storage: runtimeStorage, http: { request: vi.fn() }, actressInfo: {}, movie, state: {}, events: {}, scope: async () => null,
      hostAdapters: {
        javdb: { getListSelectors: () => ({ boxSelector: ".movie-list", itemSelector: ".movie-list .item", requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next" }) },
        javbus: { getListSelectors: () => ({ boxSelector: ".masonry", itemSelector: ".masonry .item", requestDomItemSelector: "#waterfall .item", nextPageSelector: "#next" }) },
      },
      hostListParser: { parseDetailPage: context.parseDetailPage },
    },
    legacyStorage,
    utilities: { ...defaultUtils, ...overrides.utils },
    logger: context.clog,
    jquery: context.$,
    window: { location: new URL("https://javdb.com/"), navigator: {}, isListPage: true },
    notifications: context.show,
  });
  task.getRuntimeService = name => name === "actressInfo" ? {
    collection: async (_integrationId, input) => gmHttp.get(input.pageUrl)
  } : name === "scope" ? async () => null
    : name === "movie" ? { externalSiteOrigin: () => "https://javdb.example" }
      : name === "hostAdapters" ? {
        javdb: { getListSelectors: () => ({ boxSelector: ".movie-list", itemSelector: ".movie-list .item", requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next" }) },
        javbus: { getListSelectors: () => ({ boxSelector: ".masonry", itemSelector: ".masonry .item", requestDomItemSelector: "#waterfall .item", nextPageSelector: "#next" }) },
      }
        : name === "hostListParser" ? { parseDetailPage: context.parseDetailPage } : null;
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

describe("compatibility registry zero-runtime contract", () => {
  it("preserves legacy bean lookup and settings descriptors without plugin execution", () => {
    const registry = new CompatibilityBeanRegistry(), bean = { handle: vi.fn(), initCss: vi.fn() };
    registry.registerCompatibilityBean("ListPagePlugin", bean);
    registry.setCatalogDescriptors([{ name: "ListPagePlugin", disableable: true }]);

    expect(registry.getBean("ListPagePlugin")).toBe(bean);
    expect(registry.getPluginDescriptors()).toEqual([{ name: "ListPagePlugin", disableable: true }]);
    expect(registry.getPluginNames()).toEqual([]);
    expect(registry.getTimings()).toEqual([]);
    expect(registry.getCssTimings()).toEqual([]);
    expect(registry.getStartupReport()).toEqual({ registeredPlugins: 0, registrationMs: 0, cssMs: 0, immediateMs: 0, readyMs: 0, idlePending: 0, idleCompleted: 0 });
    expect(registry.processPlugins).toBeUndefined();
    expect(registry.prepareCss).toBeUndefined();
    expect(bean.handle).not.toHaveBeenCalled();
    expect(bean.initCss).not.toHaveBeenCalled();
  });

  it("rejects duplicate aliases and only releases the exact registered bean", () => {
    const registry = new CompatibilityBeanRegistry(), bean = {};
    registry.registerCompatibilityBean("StableAlias", bean);
    expect(() => registry.registerCompatibilityBean("StableAlias", {})).toThrow("兼容 Bean 重复或无效: StableAlias");
    expect(registry.unregisterCompatibilityBean("StableAlias", {})).toBe(false);
    expect(registry.unregisterCompatibilityBean("StableAlias", bean)).toBe(true);
    expect(registry.getBean("StableAlias")).toBeUndefined();
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

  it("does not count a dismissed decision as fresh on a later actor scan", async () => {
    const updateFavoriteActress = vi.fn(async () => true), task = loadTaskPlugin({ get: vi.fn() }, {
      storageManager: { getCarMap: vi.fn(async () => new Map()), updateFavoriteActress }
    });
    task.getRuntimeService = name => name === "state" ? {
      getNewVideoDecisions: vi.fn(async () => ({ "A-1": { action: "dismissed" } }))
    } : name === "scope" ? async () => null : name === "movie" ? { externalSiteOrigin: () => "https://javdb.example" } : null;

    await expect(task.parseActorMovies([
      { carNum: "A-1", title: "A", publishTime: "2026-08-01" }
    ], "actor", "Actor", [], new Set())).resolves.toBe(0);
    expect(updateFavoriteActress).toHaveBeenCalledWith(expect.objectContaining({
      newVideoList: [expect.objectContaining({ carNum: "A-1" })]
    }));
  });

  it("does not count an empty actor scan when the saved actor disappeared", async () => {
    const updateFavoriteActress = vi.fn(async () => false);
    const task = loadTaskPlugin({ get: vi.fn() }, { storageManager: { updateFavoriteActress } });

    await expect(task.parseActorMovies([], "removed", "Actor", [], new Set())).rejects.toThrow("演员记录已不存在");
    expect(updateFavoriteActress).toHaveBeenCalledOnce();
  });

  it("keeps a saved fallback scan when its optional notice and warning both fail", async () => {
    const updateFavoriteActress = vi.fn(async () => true);
    const task = loadTaskPlugin({ get: vi.fn() }, {
      storageManager: { getCarMap: vi.fn(async () => new Map()), updateFavoriteActress },
    });
    task.getRuntimeService = name => name === "state" ? { getNewVideoDecisions: async () => ({}) } : null;
    task.logger.html = () => { throw new Error("notice unavailable"); };
    task.logger.warn = () => { throw new Error("warning unavailable"); };

    await expect(task.parseActorMovies([{ carNum: "A-1" }], "actor", "Actor", [], new Set())).resolves.toBe(1);
    expect(updateFavoriteActress).toHaveBeenCalledOnce();
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
