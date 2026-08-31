import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const browserRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(browserRoot, "..", "..");

export async function fulfillHostFixtures(context) {
  const javdb = await readFile(join(browserRoot, "fixtures", "javdb-detail.html"), "utf8");
  const javbus = await readFile(join(browserRoot, "fixtures", "javbus-detail.html"), "utf8");
  const javdbList = await readFile(join(browserRoot, "fixtures", "javdb-list.html"), "utf8");
  const javdbFc2List = await readFile(join(browserRoot, "fixtures", "javdb-fc2-list.html"), "utf8");
  const javdbHitShow = await readFile(join(browserRoot, "fixtures", "javdb-hit-show.html"), "utf8");
  const javbusList = await readFile(join(browserRoot, "fixtures", "javbus-list.html"), "utf8");
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.isNavigationRequest()) {
      if (url.hostname === "javdb.com") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: url.pathname.startsWith("/v/") ? javdb : url.pathname === "/advanced_search" && url.searchParams.has("handlePlayback") ? javdbHitShow : url.pathname === "/advanced_search" ? javdbFc2List : javdbList });
      if (url.hostname === "www.javbus.com") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: url.pathname === "/" ? javbusList : javbus });
    }
    if (url.hostname === "c0.jdbstatic.com" && url.pathname === "/thumbs/top-fixture.jpg") return route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"><rect width="2" height="3" fill="#777"/></svg>' });
    return route.abort("blockedbyclient");
  });
}

export async function injectUserscriptRuntime(page, options = {}) {
  const startupErrors = [];
  const hostPage = typeof page.context === "function" ? page : page.page();
  const browserVersion = hostPage.context().browser()?.version() || "unknown";
  const phaseStartedAt = performance.now(), bootstrapPhases = {};
  const markPhase = (name) => { bootstrapPhases[name] = performance.now() - phaseStartedAt; };
  hostPage.on("pageerror", (error) => startupErrors.push(error.stack || error.message));
  hostPage.on("console", (message) => {
    // The fixture router intentionally aborts every non-whitelisted external
    // resource; Chromium reports that expected abort as a console resource error.
    if (message.type() === "error" && !/^Failed to load resource: net::ERR_BLOCKED_BY_CLIENT(?:\.[A-Za-z]+)?$/.test(message.text())) startupErrors.push(message.text());
  });
  await page.addScriptTag({ path: join(browserRoot, "node_modules", "jquery", "dist", "jquery.min.js") });
  markPhase("jquery");
  await page.addScriptTag({ path: join(browserRoot, "node_modules", "localforage", "dist", "localforage.min.js") });
  markPhase("localforage");
  await page.addScriptTag({ path: join(browserRoot, "node_modules", "tabulator-tables", "dist", "js", "tabulator.min.js") });
  markPhase("tabulator");
  await page.addStyleTag({ path: join(browserRoot, "node_modules", "tabulator-tables", "dist", "css", "tabulator.min.css") });
  markPhase("vendor-style");
  await page.evaluate(async ({ disabledPlugins, settingOverrides }) => {
    const forage = window.localforage.createInstance({ driver: window.localforage.INDEXEDDB, name: "JAV-JHS", version: 1, storeName: "appData" });
    await forage.setItem("setting", {
      translateTitle: "no",
      httpRetryCount: 1,
      circuitBreakerThreshold: 1,
      ...(disabledPlugins?.length ? { disabledPlugins: JSON.stringify(disabledPlugins) } : {}),
      ...settingOverrides,
    });
  }, { disabledPlugins: options.disabledPlugins || [], settingOverrides: options.settingOverrides || {} });
  await page.evaluate(({ version, nativeTranslation, rankingMovies, topMovies }) => {
    window.__jhsBrowserTestMetadata = { fixture: true, version };
    window.__jhsBrowserDiagnostics = { requests: [], nativeTranslationRequests: 0, startedAt: performance.now() };
    window.unsafeWindow = window;
    window.GM_getValue = (_key, fallback) => fallback;
    window.GM_setValue = () => undefined;
    window.GM_openInTab = () => ({ close() {} });
    window.GM_xmlhttpRequest = (options) => {
      window.__jhsBrowserDiagnostics.requests.push({ method: options.method || "GET", url: String(options.url || "") });
      let aborted = false;
      queueMicrotask(() => {
        if (aborted) return;
        if (topMovies && String(options.url || "").includes("/api/v1/movies/top")) {
          const payload = { success: 1, data: { movies: topMovies } };
          options.onload?.({ status: 200, response: payload, responseText: JSON.stringify(payload), responseHeaders: "content-type: application/json" });
        } else if (rankingMovies && String(options.url || "").includes("/api/v1/rankings/playback")) {
          // rankingMovies 可为数组（所有周期同数据）或按 period 键控的对象（验证周期切换管线）
          const periodMatch = /[?&]period=(\w+)/.exec(String(options.url || ""));
          const movies = Array.isArray(rankingMovies) ? rankingMovies : rankingMovies[periodMatch?.[1] || "daily"] ?? rankingMovies.daily ?? [];
          const payload = { success: 1, data: { movies } };
          options.onload?.({ status: 200, response: payload, responseText: JSON.stringify(payload), responseHeaders: "content-type: application/json" });
        } else options.onerror?.({ error: "Browser fixture blocked external request" });
      });
      return { abort() { aborted = true; options.onabort?.(); } };
    };
    if (nativeTranslation) {
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        if (String(input).startsWith("https://translate-pa.googleapis.com/v1/translate")) {
          window.__jhsBrowserDiagnostics.nativeTranslationRequests += 1;
          return Promise.resolve(new Response(JSON.stringify({ translation: nativeTranslation }), {
            status: 200, headers: { "content-type": "application/json" },
          }));
        }
        return originalFetch(input, init);
      };
    }
    window.md5 = (value) => `fixture-${String(value).length}`;
    window.Toastify = () => ({ showToast() {} });
    window.Viewer = class { show() {} hide() {} destroy() {} update() {} };
    window.requestIdleCallback ||= (callback) => setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 0);
    let layerId = 0;
    const mountedLayers = new Map();
    window.layer = {
      open(options = {}) {
        const id = ++layerId;
        const host = document.createElement("div");
        host.className = "layui-layer";
        host.id = `layui-layer${id}`;
        host.dataset.layerId = String(id);
        host.style.position = "fixed";
        host.style.top = "50%";
        host.style.left = "50%";
        host.style.transform = "translate(-50%, -50%)";
        const area = Array.isArray(options.area) ? options.area : [options.area, null];
        if (typeof area[0] === "string" && area[0] !== "auto") host.style.width = area[0];
        if (typeof area[1] === "string" && area[1] !== "auto") host.style.height = area[1];
        if (options.zIndex != null) host.style.zIndex = String(options.zIndex);
        const contentHost = document.createElement("div");
        contentHost.className = "layui-layer-content";
        contentHost.style.height = "100%";
        contentHost.style.overflow = "auto";
        contentHost.style.boxSizing = "border-box";
        const content = options.content?.jquery ? options.content[0] : options.content;
        if (Number(options.type) === 2) {
          const iframe = content instanceof HTMLIFrameElement ? content : document.createElement("iframe");
          iframe.id = `layui-layer-iframe${id}`;
          iframe.name = iframe.id;
          if (typeof content === "string") iframe.src = content;
          iframe.style.width = "100%";
          iframe.style.height = "100%";
          iframe.style.border = "0";
          contentHost.append(iframe);
        } else if (content instanceof Node) contentHost.append(content);
        else if (typeof content === "string") contentHost.innerHTML = content;
        host.append(contentHost);
        document.body.append(host);
        mountedLayers.set(id, { host, options });
        options.success?.(window.jQuery(host), id);
        return id;
      },
      close(id) {
        const mounted = mountedLayers.get(id);
        mounted?.options?.end?.();
        mounted?.host?.remove();
        mountedLayers.delete(id);
      },
      closeAll() { [...mountedLayers.keys()].forEach((id) => this.close(id)); },
      confirm(message, options = {}, yes, cancel) {
        const content = document.createElement("div");
        content.className = "layui-layer-dialog-content";
        content.textContent = String(message);
        const id = this.open({ ...options, type: 1, content });
        const mounted = mountedLayers.get(id);
        const buttons = document.createElement("div");
        buttons.className = "layui-layer-btn";
        const labels = Array.isArray(options.btn) ? options.btn : ["确定", "取消"];
        labels.forEach((label, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = `layui-layer-btn${index}`;
          button.textContent = String(label);
          button.addEventListener("click", () => index === 0 ? yes?.(id) : (cancel?.(id), this.close(id)));
          buttons.append(button);
        });
        mounted?.host?.append(buttons);
        return id;
      },
      alert(message, options = {}) { return this.open({ ...options, content: String(message) }); },
      msg() {}
    };
  }, { version: browserVersion, nativeTranslation: options.nativeTranslation || "", rankingMovies: options.rankingMovies || null, topMovies: options.topMovies || null });
  markPhase("fixture-setup");
  await page.addScriptTag({ path: join(repoRoot, "JHS.user.js") });
  markPhase("userscript-eval");
  try {
    await page.waitForFunction(() => Boolean(window.unsafeWindow?.pluginManager?.getStartupReport), null, { timeout: 15_000 });
    markPhase("startup-ready");
    await page.evaluate((phases) => { window.__jhsBrowserDiagnostics.bootstrapPhases = { ...(window.__jhsBrowserDiagnostics.bootstrapPhases || {}), harness: phases }; }, bootstrapPhases);
  } catch (error) {
    const state = await page.evaluate(() => ({
      phases: window.__jhsBrowserDiagnostics?.bootstrapPhases || {},
      hasPluginManager: Boolean(window.unsafeWindow?.pluginManager),
      bootstrapError: document.querySelector("#jhs-bootstrap-error")?.textContent || "",
    })).catch(() => ({}));
    const detail = startupErrors.join("\n") || error.message;
    throw new Error(`JHS fixture bootstrap failed: ${detail}; state=${JSON.stringify(state)}`);
  }
}

export async function assertNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  if (dimensions.scrollWidth > dimensions.clientWidth + 1) {
    throw new Error(`Horizontal overflow: ${dimensions.scrollWidth}px > ${dimensions.clientWidth}px`);
  }
}
