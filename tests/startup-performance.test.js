import { TaskExecutionService } from "../src/features/discovery/task-execution-service.js";
import { StorageQueue } from "../src/core/storage-queue.js";
import { sleep } from "../src/core/timing.js";
import { SettingsService } from "../src/services/settings-service.js";
import { HttpService } from "../src/services/http-service.js";
import { ExternalUrlPolicy } from "../src/services/external-url-policy.js";
import { UserscriptHttpAdapter } from "../src/platform/userscript/userscript-http-adapter.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRuntimeLookup } from "../src/app/runtime-lookup.js";

afterEach(() => vi.useRealTimers());

function loadTaskPlugin(gmHttp, overrides = {}) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 7, 11, 20));
  const settings = { snapshot: () => ({}), readStoredSnapshot: async () => ({}) };
  const runtimeServices = {
    storage: { getLocal: vi.fn(() => null), setLocal: vi.fn(), removeLocal: vi.fn() },
    keywordRules: { getTitleKeywords: async () => [] },
    http: { request: vi.fn() },
    actressInfo: { collection: async (_integrationId, input) => gmHttp.get(input.pageUrl) },
    movie: { externalSiteOrigin: () => "https://javdb.example" },
    state: { getNewVideoDecisions: async () => ({}), ...overrides.state },
    settings, events: {}, scope: async () => null,
    hostAdapters: {
      javdb: { getListSelectors: () => ({ boxSelector: ".movie-list", requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next" }) },
      javbus: { getListSelectors: () => ({ boxSelector: ".masonry", requestDomItemSelector: "#waterfall .item", nextPageSelector: "#next" }) },
    },
  };
  return new TaskExecutionService({
    runtimeServices, sleep: vi.fn(async () => {}),
    logger: { log: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
    jquery: () => ({ text: vi.fn() }),
    window: { location: new URL("https://javdb.com/"), navigator: {}, isListPage: true },
    notifications: { info: vi.fn(), error: vi.fn() },
  });
}

function loadHttpManager(requestHandler) {
  return new HttpService(new UserscriptHttpAdapter(requestHandler), new ExternalUrlPolicy());
}

const requestOptions = (url) => ({
  url, providerId: "fixture", urlPolicy: { trustClass: "builtin-public", hosts: [new URL(url).hostname] }, retryCount: 0,
});

it("releases lookup aliases only while they still refer to the registered instance", () => {
  const lookup = createRuntimeLookup(), bean = {}, replacement = {};
  const release = lookup.register("StableAlias", bean);
  expect(lookup.getBean("StableAlias")).toBe(bean);
  expect(() => lookup.register("StableAlias", {})).toThrow("兼容 Bean 重复或无效: StableAlias");
  release();
  expect(lookup.getBean("StableAlias")).toBeUndefined();
  lookup.register("StableAlias", replacement);
  release();
  expect(lookup.getBean("StableAlias")).toBe(replacement);
});

describe("settings snapshot reads", () => {
  it("serves concurrent consumers from one persisted settings load", async () => {
    const get = vi.fn(async () => ({ theme: "dark" }));
    const settings = new SettingsService({ get, set: vi.fn() });
    await settings.load();
    const [first, second] = await Promise.all([settings.snapshot(), settings.snapshot()]);
    expect(get).toHaveBeenCalledOnce();
    expect(first).toEqual({ theme: "dark" });
    expect(second).toEqual({ theme: "dark" });
  });

  it("retains the newer value after a pending settings read and queued write", async () => {
    let release, started;
    const reading = new Promise(resolve => { started = resolve; });
    const get = vi.fn().mockImplementationOnce(() => new Promise(resolve => { release = resolve; started(); })).mockResolvedValue({ theme: "old" });
    const set = vi.fn(async () => {});
    const settings = new SettingsService({ get, set });
    const pending = settings.load();
    await reading;
    const update = settings.set("theme", "new");
    release({ theme: "old" });
    await expect(pending).resolves.toEqual({ theme: "old" });
    await update;
    expect(set).toHaveBeenCalledExactlyOnceWith("setting", { theme: "new" });
    expect(settings.snapshot()).toEqual({ theme: "new" });
    expect(get).toHaveBeenCalledTimes(2);
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
    const error = vi.fn(), queue = new StorageQueue({ error }), events = [];
    const failed = queue.addTask(async () => { events.push("failed"); throw new Error("write failed"); });
    const succeeded = queue.addTask(async () => { events.push("succeeded"); return 42; });

    await expect(failed).rejects.toThrow("write failed");
    await expect(succeeded).resolves.toBe(42);
    await expect(queue.waitAllFinished()).resolves.toBe(42);
    expect(events).toEqual([ "failed", "succeeded" ]);
    expect(error).toHaveBeenCalledOnce();
  });

  it("treats an empty valid movie container as a successful empty result", async () => {
    const updateFavoriteActress = vi.fn(async () => true), task = loadTaskPlugin({ get: vi.fn() }, { state: { updateFavoriteActress } });
    task.getSelector = () => ({ boxSelector: ".movie-list", requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next" });
    const dom = { find: (selector) => ({
      length: selector === ".movie-list" ? 1 : 0,
      first() { return this; },
      text: () => "",
      attr: () => undefined
    }) };

    await expect(task.parsePage(dom, "javdb", "actor-1", "演员", [], new Set())).resolves.toBe(0);
    expect(updateFavoriteActress).toHaveBeenCalledWith({ starId: "actor-1", lastCheckTime: "2026-08-11 20:00:00", newVideoList: [] }, { scan: true });
  });

  it("rejects a structurally invalid empty page without advancing actress state", async () => {
    const updateFavoriteActress = vi.fn(), task = loadTaskPlugin({ get: vi.fn() }, { state: { updateFavoriteActress } });
    task.getSelector = () => ({ boxSelector: ".movie-list", requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next" });
    const dom = { find: () => ({ length: 0, first() { return this; }, text: () => "", attr: () => undefined }) };

    await expect(task.parsePage(dom, "javdb", "actor-1", "演员", [], new Set())).rejects.toThrow("新作品检测-解析列表失败");
    expect(updateFavoriteActress).not.toHaveBeenCalled();
  });

  it("does not count a dismissed decision as fresh on a later actor scan", async () => {
    const updateFavoriteActress = vi.fn(async () => true), task = loadTaskPlugin({ get: vi.fn() }, {
      state: { getCarMap: vi.fn(async () => new Map()), updateFavoriteActress }
    });
    task.getRuntimeService = name => name === "state" ? {
      ...task.runtimeServices.state, getNewVideoDecisions: vi.fn(async () => ({ "A-1": { action: "dismissed" } }))
    } : name === "scope" ? async () => null : name === "movie" ? { externalSiteOrigin: () => "https://javdb.example" } : null;

    await expect(task.parseActorMovies([
      { carNum: "A-1", title: "A", publishTime: "2026-08-01" }
    ], "actor", "Actor", [], new Set())).resolves.toBe(0);
    expect(updateFavoriteActress).toHaveBeenCalledWith(expect.objectContaining({
      newVideoList: [expect.objectContaining({ carNum: "A-1" })]
    }), { scan: true });
  });

  it("does not count an empty actor scan when the saved actor disappeared", async () => {
    const updateFavoriteActress = vi.fn(async () => false);
    const task = loadTaskPlugin({ get: vi.fn() }, { state: { updateFavoriteActress } });

    await expect(task.parseActorMovies([], "removed", "Actor", [], new Set())).rejects.toThrow("演员记录已不存在");
    expect(updateFavoriteActress).toHaveBeenCalledOnce();
  });

  it("keeps a saved fallback scan when its optional notice and warning both fail", async () => {
    const updateFavoriteActress = vi.fn(async () => true);
    const task = loadTaskPlugin({ get: vi.fn() }, {
      state: { getCarMap: vi.fn(async () => new Map()), updateFavoriteActress },
    });
    task.getRuntimeService = name => task.runtimeServices[name];
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

    await expect(http.request(requestOptions("https://javdb.example/actors/1"))).rejects.toMatchObject({ code: "CF_BLOCKED" });
    expect(request).toHaveBeenCalledTimes(1);
    expect(http.getCircuitBreakerStatus()["javdb.example"].failCount).toBe(1);
  });

  it("allows one half-open probe and closes the breaker on success", async () => {
    const request = vi.fn((options) => options.onload({ status: 200, finalUrl: options.url, responseText: "{}" }));
    const http = loadHttpManager(request);
    http.circuitBreakers.set("javdb.example", {
      state: "half-open", failCount: 0, openTime: 0, cooldownMs: 60000, threshold: 3, probing: false
    });

    await expect(http.request(requestOptions("https://javdb.example/actors/1"))).resolves.toMatchObject({ status: 200 });

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

    await expect(http.request({
      ...requestOptions("https://yun.123pan.com/resolve"), method: "POST",
      body: JSON.stringify({ urls: "magnet:test" }),
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" }
    })).resolves.toMatchObject({ data: '{"code":0}' });

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toMatchObject({
      method: "POST",
      url: "https://yun.123pan.com/resolve",
      data: '{"urls":"magnet:test"}',
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" }
    });
  });
});
