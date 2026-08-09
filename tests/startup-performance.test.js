import { readFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const repoRoot = join(import.meta.dirname, "..");

function loadPluginClasses() {
  const idleCallbacks = [];
  const insertStyle = vi.fn();
  const context = vm.createContext({
    console,
    Date,
    performance,
    setTimeout,
    requestIdleCallback: (callback) => idleCallbacks.push(callback),
    storageManager: { getSetting: async () => "[]" },
    utils: { isMobileMode: () => false, insertStyle },
    clog: { error: vi.fn() },
    i: (target, key, value) => (target[key] = value)
  });
  const source = `${readFileSync(join(repoRoot, "src/core/plugin-manager.js"), "utf8")}\nglobalThis.TestPluginManager = Y; globalThis.TestBasePlugin = X;`;
  vm.runInContext(source, context);
  return { PluginManager: context.TestPluginManager, BasePlugin: context.TestBasePlugin, idleCallbacks, insertStyle };
}

function loadStorageManager(forage) {
  const context = vm.createContext({
    console,
    localforage: {
      INDEXEDDB: "indexeddb",
      createInstance: () => forage
    },
    i: (target, key, value) => (target[key] = value)
  });
  const source = `${readFileSync(join(repoRoot, "src/core/storage.js"), "utf8")}\nglobalThis.TestStorageManager = z;`;
  vm.runInContext(source, context);
  return new context.TestStorageManager();
}

function loadTaskPlugin(gmHttp) {
  const context = vm.createContext({
    console,
    URL,
    gmHttp,
    i: (target, key, value) => (target[key] = value),
    X: class {},
    ve: class { constructor() { this.queue = Promise.resolve(); } },
    clog: { log: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
    show: { info: vi.fn(), error: vi.fn() },
    utils: { sleep: vi.fn(async () => {}) },
    $: () => ({ text: vi.fn() })
  });
  const source = `${readFileSync(join(repoRoot, "src/plugins/new-video/task.js"), "utf8")}\nglobalThis.TestTaskPlugin = et;`;
  vm.runInContext(source, context);
  return new context.TestTaskPlugin();
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
    J: TestUtils,
    z: TestStorage,
    clog: { log: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
    GM_xmlhttpRequest: requestHandler
  };
  context.window = context;
  context.unsafeWindow = context;
  vm.runInContext(readFileSync(join(repoRoot, "src/core/http.js"), "utf8"), vm.createContext(context));
  return context.gmHttp;
}

describe("startup scheduling", () => {
  it("finishes immediate plugins before idle plugins", async () => {
    const { PluginManager, BasePlugin, idleCallbacks } = loadPluginClasses();
    const events = [];
    class ImmediatePlugin extends BasePlugin {
      getName() { return "ImmediatePlugin"; }
      async handle() { events.push("immediate"); }
    }
    class IdlePlugin extends BasePlugin {
      getName() { return "IdlePlugin"; }
      getStartupMode() { return "idle"; }
      async handle() { events.push("idle"); }
    }
    const manager = new PluginManager();
    manager.register(ImmediatePlugin);
    manager.register(IdlePlugin);

    await manager.processPlugins();

    expect(events).toEqual(["immediate"]);
    expect(manager.getTimings().find((item) => item.name === "IdlePlugin")?.status).toBe("pending-idle");
    expect(manager.getStartupReport()).toMatchObject({ idlePending: 1, idleCompleted: 0 });

    await idleCallbacks[0]();

    expect(events).toEqual(["immediate", "idle"]);
    expect(manager.getStartupReport()).toMatchObject({ idlePending: 0, idleCompleted: 1 });
  });

  it("shares immutable icon strings through the base prototype", () => {
    const { PluginManager, BasePlugin } = loadPluginClasses();
    class FirstPlugin extends BasePlugin { getName() { return "FirstPlugin"; } }
    class SecondPlugin extends BasePlugin { getName() { return "SecondPlugin"; } }
    const manager = new PluginManager();
    manager.register(FirstPlugin);
    manager.register(SecondPlugin);
    const first = manager.getBean("FirstPlugin"), second = manager.getBean("SecondPlugin");

    expect(Object.hasOwn(first, "settingSvg")).toBe(false);
    expect(Object.hasOwn(second, "settingSvg")).toBe(false);
    expect(first.settingSvg).toBe(second.settingSvg);
  });

  it("inserts all plugin styles in one DOM batch", async () => {
    const { PluginManager, BasePlugin, insertStyle } = loadPluginClasses();
    class FirstPlugin extends BasePlugin {
      getName() { return "FirstPlugin"; }
      initCss() { return ".first { color: red; }"; }
    }
    class SecondPlugin extends BasePlugin {
      getName() { return "SecondPlugin"; }
      initCss() { return "<style>.second { color: blue; }</style>"; }
    }
    const manager = new PluginManager();
    manager.register(FirstPlugin);
    manager.register(SecondPlugin);

    await manager.processCss();

    expect(insertStyle).toHaveBeenCalledTimes(1);
    expect(insertStyle).toHaveBeenCalledWith([
      ".first { color: red; }",
      "<style>.second { color: blue; }</style>"
    ]);
  });

  it("does not include removed legacy service integrations", () => {
    const mainSource = readFileSync(join(repoRoot, "src/main.js"), "utf8");
    const registrySource = readFileSync(join(repoRoot, "src/plugins/registry.js"), "utf8");
    const utilsSource = readFileSync(join(repoRoot, "src/core/utils.js"), "utf8");

    expect(mainSource).not.toContain("parallel_GM_xmlhttpRequest.js");
    expect(mainSource).not.toContain("@connect      127.0.0.1");
    expect(registrySource).not.toContain("LocalPlugin");
    expect(utilsSource).not.toContain("pingLocalService");
  });

  it("does not include audited dead methods", () => {
    const sourceFiles = [
      "src/core/http.js",
      "src/core/storage.js",
      "src/core/utils.js",
      "src/plugins/blacklist/blacklist.js",
      "src/plugins/external-search/fc2-by-123av.js",
      "src/plugins/image-viewer/screenshot.js",
      "src/plugins/status/auto-page.js"
    ];
    const source = sourceFiles.map((file) => readFileSync(join(repoRoot, file), "utf8")).join("\n");
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
