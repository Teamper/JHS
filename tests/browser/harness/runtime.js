import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const browserRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(browserRoot, "..", "..");

export async function fulfillHostFixtures(context) {
  const javdb = await readFile(join(browserRoot, "fixtures", "javdb-detail.html"), "utf8");
  const javbus = await readFile(join(browserRoot, "fixtures", "javbus-detail.html"), "utf8");
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.isNavigationRequest() && request.frame() === request.frame().page().mainFrame()) {
      if (url.hostname === "javdb.com") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: javdb });
      if (url.hostname === "www.javbus.com") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: javbus });
    }
    return route.abort("blockedbyclient");
  });
}

export async function injectUserscriptRuntime(page, options = {}) {
  const startupErrors = [];
  const browserVersion = page.context().browser()?.version() || "unknown";
  page.on("pageerror", (error) => startupErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error") startupErrors.push(message.text());
  });
  await page.addScriptTag({ path: join(browserRoot, "node_modules", "jquery", "dist", "jquery.min.js") });
  await page.addScriptTag({ path: join(browserRoot, "node_modules", "localforage", "dist", "localforage.min.js") });
  await page.addScriptTag({ path: join(browserRoot, "node_modules", "tabulator-tables", "dist", "js", "tabulator.min.js") });
  await page.addStyleTag({ path: join(browserRoot, "node_modules", "tabulator-tables", "dist", "css", "tabulator.min.css") });
  await page.evaluate(async (disabledPlugins) => {
    const forage = window.localforage.createInstance({ driver: window.localforage.INDEXEDDB, name: "JAV-JHS", version: 1, storeName: "appData" });
    await forage.setItem("setting", {
      translateTitle: "no",
      httpRetryCount: 1,
      circuitBreakerThreshold: 1,
      ...(disabledPlugins?.length ? { disabledPlugins: JSON.stringify(disabledPlugins) } : {}),
    });
  }, options.disabledPlugins || []);
  await page.evaluate((version) => {
    window.__jhsBrowserTestMetadata = { fixture: true, version };
    window.__jhsBrowserDiagnostics = { requests: [], startedAt: performance.now() };
    window.unsafeWindow = window;
    window.GM_getValue = async (_key, fallback) => fallback;
    window.GM_setValue = async () => undefined;
    window.GM_openInTab = () => ({ close() {} });
    window.GM_xmlhttpRequest = (options) => {
      window.__jhsBrowserDiagnostics.requests.push({ method: options.method || "GET", url: String(options.url || "") });
      let aborted = false;
      queueMicrotask(() => {
        if (!aborted) options.onerror?.({ error: "Browser fixture blocked external request" });
      });
      return { abort() { aborted = true; options.onabort?.(); } };
    };
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
        host.dataset.layerId = String(id);
        const content = options.content?.jquery ? options.content[0] : options.content;
        if (content instanceof Node) host.append(content);
        else if (typeof content === "string") host.textContent = content;
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
      confirm(_message, options, yes) { const id = this.open(options); yes?.(id); return id; },
      alert(message, options = {}) { return this.open({ ...options, content: String(message) }); },
      msg() {}
    };
  }, browserVersion);
  await page.addScriptTag({ path: join(repoRoot, "JHS.user.js") });
  try {
    await page.waitForFunction(() => Boolean(window.unsafeWindow?.pluginManager?.getStartupReport), null, { timeout: 15_000 });
  } catch (error) {
    throw new Error(`JHS fixture bootstrap failed: ${startupErrors.join("\n") || error.message}`);
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
