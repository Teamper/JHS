import { test, expect } from "@playwright/test";
test.beforeEach(({}, testInfo) => { test.skip(!["desktop-wide", "mobile"].includes(testInfo.project.name), "interaction owners"); });

import { readFile } from "node:fs/promises";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const injectRuntime = async (page, options) => {
  if (!process.env.JHS_AUDIT_BASELINE) return injectUserscriptRuntime(page, options);
  const original = page.addScriptTag.bind(page);
  page.addScriptTag = options => original(options.path?.endsWith("JHS.user.js") ? { path: process.env.JHS_AUDIT_BASELINE } : options);
  try { return await injectUserscriptRuntime(page, options); } finally { page.addScriptTag = original; }
};

async function boot(page, context, { hiddenVideo = false, iframe = false } = {}) {
  await fulfillHostFixtures(context);
  const base = await readFile(new URL("../fixtures/javdb-detail-interactions.html", import.meta.url), "utf8");
  await context.route("https://javdb.com/v/**", route => route.fulfill({ contentType: "text/html", body: base }));
  await page.goto(iframe ? "https://javdb.com/" : "https://javdb.com/v/test-id");
  await injectRuntime(page, { settingOverrides: { enableLoadPreviewVideo: "no", enableLoadReview: "no", enableMagnetsFilter: "no", needClosePage: "no" } });
  await page.waitForFunction(() => Boolean(window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]));
  if (!iframe) return page;
  const navigation = page.waitForEvent("framenavigated", { predicate: frame => frame !== page.mainFrame() && frame.url().includes("/v/") });
  await page.locator(".movie-list .video-title").click();
  const frame = await navigation;
  await injectRuntime(frame, { settingOverrides: { enableLoadPreviewVideo: "no", enableLoadReview: "no", enableMagnetsFilter: "no", needClosePage: "no" } });
  await frame.waitForFunction(() => Boolean(window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]));
  return frame;
}

async function nativePlayer(frame) {
  await frame.evaluate(() => {
    document.querySelector("#preview-video")?.remove();
    const video = document.createElement("video"); video.id = "preview-video"; video.currentTime = 7; video.style.display = "none";
    document.body.append(video);
    HTMLMediaElement.prototype.play = function () { this.dataset.auditPlaying = "true"; return Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function () { this.dataset.auditPlaying = "false"; };
    HTMLMediaElement.prototype.load = function () {};
    Object.defineProperty(HTMLMediaElement.prototype, "readyState", { configurable:true, get() { return 4; } });
    Object.defineProperty(HTMLMediaElement.prototype, "paused", { configurable:true, get() { return this.dataset.auditPlaying !== "true"; } });
    const plugin = window.unsafeWindow.pluginManager.getBean("PreviewVideoPlugin");
    window.auditPlugin = plugin;
    plugin.getDmmPreview = async () => ({ sources: { "720": "https://example.invalid/test.mp4" }, error: null });
    let trigger = document.querySelector(".preview-video-container");
    if (!trigger) { trigger = document.createElement("button"); trigger.type = "button"; trigger.className = "preview-video-container"; trigger.textContent = "预览"; document.body.append(trigger); }
    // Fixture host adapter models Fancybox mounting; the test does not claim real media decoding.
    trigger.addEventListener("click", event => {
      event.preventDefault();
      const host = document.createElement("div"); host.className = "fancybox-content";
      video.style.display = ""; host.append(video); document.body.append(host); void video.play();
    });
    plugin._previewMounted = false; plugin.mountPreview();
  });
  await frame.locator(".preview-video-container").first().click();
  await expect(frame.locator("#video-bottom-toolbar")).toBeVisible();
}

test("open detail iframe shrinks with its viewport and stays usable", async ({ page, context }) => {
  await page.setViewportSize({width:1600,height:1000});
  const frame = await boot(page, context, {iframe:true});
  await page.setViewportSize({width:390,height:844});
  await expect.poll(async()=>frame.evaluate(()=>innerWidth)).toBeLessThanOrEqual(390);
  expect(await frame.evaluate(()=>innerWidth)).toBeGreaterThan(320);
  await expect(frame.locator("#favoriteBtn")).toBeVisible();
  await page.setViewportSize({width:1248,height:900});
  await expect.poll(async()=>frame.evaluate(()=>innerWidth)).toBeGreaterThan(1000);
});

test("unopened native preview must not show a second detail toolbar in the list iframe", async ({ page, context }) => {
  const frame = await boot(page, context, { hiddenVideo: true, iframe: true });
  await expect(frame.locator("#favoriteBtn")).toBeVisible();

  console.log("unopened-preview", await frame.evaluate(() => ({ width: innerWidth, toolbarParent: document.querySelector("#video-bottom-toolbar")?.parentElement.tagName, toolbarText: document.querySelector("#video-bottom-toolbar")?.textContent, nativeDisplay: getComputedStyle(document.querySelector("#preview-video")).display })));
  await expect(frame.locator("#video-bottom-toolbar")).not.toBeVisible();
});

test("native preview fast-forward must seek the currently playing native video", async ({ page, context }) => {
  await boot(page, context); await nativePlayer(page);
  await page.evaluate(() => window.auditPlugin.handleVideo());
  await page.locator("#speed-btn").click();
  expect(await page.locator("#preview-video").evaluate(video => video.currentTime)).toBe(17);
});

test("DMM fallback entry must have an existing playback target when no native video exists", async ({ page, context }) => {
  await boot(page, context); await nativePlayer(page);
  await page.evaluate(async () => {
    document.querySelector("#preview-video").remove(); document.querySelectorAll(".preview-video-container").forEach(node => node.remove());
    document.body.insertAdjacentHTML("beforeend", '<div class="preview-images"></div>');
    await window.auditPlugin.getRuntimeService("settings").set("enableLoadPreviewVideo", "yes");
    await window.auditPlugin.initDmm(window.auditPlugin.lifecycleScope);
  });
  await expect(page.locator("[data-jhs-dmm-trigger]").first()).toBeVisible();
  await page.locator("[data-jhs-dmm-trigger]").first().click();
  await expect(page.locator("[data-jhs-preview-host] #jhs-preview-video")).toBeVisible();
  await expect(page.locator("[data-jhs-preview-host] #speed-btn")).toBeVisible();
});

test("disabling preview while media.play is pending must not resurrect toolbar or hide native video", async ({ page, context }) => {
  await boot(page, context); await nativePlayer(page);
  await page.evaluate(async () => {
    HTMLMediaElement.prototype.play = function () { return this.id === "jhs-preview-video" ? new Promise(resolve => { window.auditReleasePlayback = resolve; }) : Promise.resolve(); };
    await window.auditPlugin.getRuntimeService("settings").set("enableLoadPreviewVideo", "yes");
  });
  await expect.poll(() => page.evaluate(() => typeof window.auditReleasePlayback)).toBe("function");
  await page.evaluate(async () => { await window.auditPlugin.getRuntimeService("settings").set("enablePreviewVideo", "no"); window.auditReleasePlayback(); });
  expect(await page.locator("#preview-video").evaluate(video => video.classList.contains("jhs-native-preview-hidden"))).toBe(false);
  await expect(page.locator("#video-bottom-toolbar")).toHaveCount(0);
});

test("DMM OFF must resume the native player previously paused by DMM", async ({ page, context }) => {
  await boot(page, context); await nativePlayer(page);
  await page.evaluate(async () => { await window.auditPlugin.getRuntimeService("settings").set("enableLoadPreviewVideo", "yes"); await window.auditPlugin.handleVideo(); });
  await expect(page.locator("#jhs-preview-video")).toHaveCount(1);
  await page.evaluate(() => window.auditPlugin.getRuntimeService("settings").set("enableLoadPreviewVideo", "no"));
  await expect(page.locator("#jhs-preview-video")).toHaveCount(0);
  expect(await page.locator("#preview-video").getAttribute("data-audit-playing")).toBe("true");
});

test("unloadable DMM cannot hide a paused native preview", async ({page,context}) => {
  await boot(page,context); await nativePlayer(page);
  await page.evaluate(async()=>{
    document.querySelector("#preview-video").pause();
    Object.defineProperty(HTMLMediaElement.prototype,"readyState",{configurable:true,get(){return this.id === "jhs-preview-video" ? 0 : 4;}});
    HTMLMediaElement.prototype.load=function(){ if(this.id === "jhs-preview-video") setTimeout(()=>this.dispatchEvent(new Event("error")),0); };
    await window.auditPlugin.getRuntimeService("settings").set("enableLoadPreviewVideo","yes");
  });
  await expect(page.locator("#jhs-preview-video")).toHaveCount(0);
  await expect(page.locator("#preview-video")).toBeVisible();
  expect(await page.locator("#preview-video").evaluate(v=>v.paused)).toBe(true);
  await expect(page.locator("#speed-btn")).toBeVisible();
});

test("DMM ON must enhance an already open native preview without reopening it", async ({ page, context }) => {
  await boot(page, context); await nativePlayer(page);
  await page.evaluate(() => window.auditPlugin.handleVideo());
  await page.evaluate(() => window.auditPlugin.getRuntimeService("settings").set("enableLoadPreviewVideo", "yes"));
  await expect(page.locator("#jhs-preview-video")).toHaveCount(1);
});

test("preview favorite control must reflect the saved favorite state", async ({ page, context }) => {
  await boot(page, context); await nativePlayer(page);
  await page.evaluate(async () => {
    await window.auditPlugin.handleVideo();
    await window.stateService.patch("ABC-123", { favorite: true }, { type: "audit", record: { carNum: "ABC-123" } });
    await window.unsafeWindow.pluginManager.getBean("DetailPageButtonPlugin").showStatus("ABC-123");
  });
  await expect(page.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#video-favoriteBtn")).toHaveAttribute("aria-pressed", "true");
});

test("two rapid offline clicks during availability checks must submit only once", async ({ page, context }) => {
  await boot(page, context);
  await page.evaluate(() => {
    document.body.insertAdjacentHTML("beforeend", '<button id="audit-offline" class="jhs-offline-btn" data-resource="magnet:?xt=urn:btih:audit">离线</button>');
    window.jQuery("#audit-offline").data("jhsMovieContext", { carNum: "ABC-123", surface: "native-detail" });
    window.auditOffline = window.unsafeWindow.pluginManager.getBean("UnifiedOfflinePlugin");
    window.auditPendingAvailability = []; window.auditSubmits = 0;
    window.auditCandidate = { provider: { id: "123", name: "123", isEnabled: async () => true, submit: async () => { window.auditSubmits++; } }, availability: { authState: "ready" } };
    window.auditOffline.registry = { getCandidates: () => new Promise(resolve => window.auditPendingAvailability.push(resolve)), updateAvailability() {} };
  });
  await page.locator("#audit-offline").click(); await page.locator("#audit-offline").dispatchEvent("click");
  await page.evaluate(() => window.auditPendingAvailability.forEach(resolve => resolve([window.auditCandidate])));
  console.log("offline-doubleclick", await page.evaluate(() => ({availability: window.auditPendingAvailability.length, submissions: window.auditSubmits, button:document.querySelector("#audit-offline").textContent})));
  await expect.poll(() => page.locator("#audit-offline").textContent()).toBe("已提交");
  expect(await page.evaluate(() => window.auditSubmits)).toBe(1);
});

test("offline remote success followed by history failure must not be recorded as remote failure", async ({ page, context }) => {
  await boot(page, context);
  const result = await page.evaluate(async () => {
    const offline = window.unsafeWindow.pluginManager.getBean("UnifiedOfflinePlugin"), button = window.jQuery('<button>离线</button>').appendTo(document.body);
    let calls = 0; const history = [];
    offline.registry = { getCandidates: async () => [{ provider: { id: "123", name: "123", isEnabled: async () => true, submit: async () => { calls++; } }, availability: { authState: "ready" } }], updateAvailability() {} };
    offline.getRuntimeService("state").appendOfflineHistory = async row => { history.push(row.status); if (history.length === 1) throw new Error("local history write failed"); };
    await offline.submitResource({ currentTarget: button[0] }, "magnet:?xt=urn:btih:audit", button, { carNum: "ABC-123" });
    return { calls, history, buttonText: button.text() };
  });
  console.log("offline-history-failure", result);
  expect(result.calls).toBe(1);
  expect(result.history).not.toContain("failed");
});

test("mark downloaded with automatic close disabled must not report a close failure", async ({ page, context }) => {
  await boot(page, context);
  const result = await page.evaluate(async () => {
    const offline = window.unsafeWindow.pluginManager.getBean("UnifiedOfflinePlugin"), messages = [];
    window.show.error = message => messages.push(String(message));
    await offline.markDownloadedAndClose({ carNum: "ABC-123" }, { root: document, layerIndex: null });
    return { messages, downloaded: (await offline.getRuntimeService("state").getState("ABC-123")).stateFlags.downloaded };
  });
  expect(result.downloaded).toBe(true);
  expect(result.messages).toEqual([]);
});

test("list iframe preview closes, reopens, and persists favorite without a second detail toolbar", async ({ page, context }) => {
  const frame = await boot(page, context, { iframe: true });
  await nativePlayer(frame);
  await frame.locator("#video-favoriteBtn").click();
  await expect(frame.locator("#video-favoriteBtn")).toHaveAttribute("aria-pressed", "true");
  await expect(frame.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "true");
  await frame.evaluate(() => {
    const host = document.querySelector(".fancybox-content"), video = host.querySelector("video");
    video.style.display = "none"; document.body.append(video); host.remove();
  });
  await expect(frame.locator("#video-bottom-toolbar")).toHaveCount(0);
  await frame.locator(".preview-video-container").click();
  await expect(frame.locator("#video-bottom-toolbar")).toHaveCount(1);
  await expect(frame.locator("#video-favoriteBtn")).toHaveAttribute("aria-pressed", "true");
  await frame.locator("#video-favoriteBtn").click();
  await expect(frame.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "false");
  expect(await frame.evaluate(() => document.querySelector("#preview-video").getAttribute("src"))).toBeNull();
});

test("saved state reaches an already open preview in another tab", async ({page,context}) => {
  await boot(page,context); await nativePlayer(page);
  const other = await context.newPage(); await boot(other,context); await nativePlayer(other);
  await page.locator("#video-favoriteBtn").click();
  await expect(other.locator("#video-favoriteBtn")).toHaveAttribute("aria-pressed","true");
  await expect(other.locator("#favoriteBtn")).toHaveAttribute("aria-pressed","true");
  await other.close();
});

test("native magnet layout uses container width and keeps host operations after sorting", async ({ page, context }, testInfo) => {
  const frame = await boot(page, context, { iframe: true });
  await frame.addStyleTag({ path: new URL("../fixtures/javdb-magnet-host.css", import.meta.url).pathname.replace(/^\/(\w:)/, "$1") });
  await frame.evaluate(() => {
    const root = document.querySelector("#magnets-content"), row = root.firstElementChild;
    row.querySelector(".name").textContent = "ABC-123 " + "VeryLongResourceName".repeat(12);
    root.append(row.cloneNode(true));
    window.fixtureCopies = 0;
    root.querySelectorAll(".copy-to-clipboard").forEach(button => button.addEventListener("click", () => window.fixtureCopies++));
    document.querySelector('select[data-action*="magnet-sort"]').addEventListener("change", () => root.prepend(root.lastElementChild));
  });
  await expect(frame.locator("[data-jhs-magnet-row]")).toHaveCount(2);
  for (const width of [360,390,768,992,1248,1408]) {
    await page.setViewportSize({ width: width + 32, height: 1000 });
    await frame.evaluate(width => {
      const root = document.querySelector("#magnets-content"); root.style.width = `${width}px`; root.style.maxWidth = "none";
    }, width);
    const geometry = await frame.locator("[data-jhs-magnet-row]").first().evaluate(row => {
      const box = node => { const r = node.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom }; };
      return { display:getComputedStyle(row).display, style:row.getAttribute("style"), grid:getComputedStyle(row).gridTemplateAreas, row:box(row), info:box(row.querySelector('[data-jhs-magnet-part="info"]')), date:box(row.querySelector('[data-jhs-magnet-part="date"]')), actions:box(row.querySelector('[data-jhs-magnet-part="actions"]')), buttons:[...row.querySelector('[data-jhs-magnet-part="actions"]').children].map(box) };
    });
    expect(geometry.buttons).toHaveLength(3);
    const appearances = await frame.locator('[data-jhs-magnet-part="actions"]').first().evaluate(root => [...root.children].map(button => { const s=getComputedStyle(button); return [s.backgroundColor,s.color,s.borderRadius,s.fontSize]; }));
    expect(appearances[0]).toEqual(appearances[1]);
    expect(appearances[1]).toEqual(appearances[2]);
    expect(Math.max(...geometry.buttons.map(x=>x.y))-Math.min(...geometry.buttons.map(x=>x.y))).toBeLessThanOrEqual(1);
    expect(Math.max(...geometry.buttons.map(x=>x.height))-Math.min(...geometry.buttons.map(x=>x.height))).toBeLessThanOrEqual(1);
    expect(geometry.buttons.at(-1).right).toBeLessThanOrEqual(geometry.row.right + 1);
    if (width >= 768) {
      expect(geometry.info.right).toBeLessThanOrEqual(geometry.date.x);
      expect(geometry.date.right).toBeLessThanOrEqual(geometry.actions.x);
    } else {
      expect(geometry.date.y).toBeGreaterThanOrEqual(geometry.info.bottom);
      expect(geometry.actions.y).toBeGreaterThanOrEqual(geometry.date.bottom);
      expect(geometry.buttons[0].height).toBeGreaterThanOrEqual(44);
    }
  }
  await frame.locator('select[data-action*="magnet-sort"]').selectOption("1", {force:true});
  await frame.locator(".copy-to-clipboard").first().click();
  expect(await frame.evaluate(() => window.fixtureCopies)).toBe(1);
  await expect(frame.locator(".jhs-offline-native")).toHaveCount(2);
  await expect(frame.locator('[data-jhs-magnet-part="actions"] a').first()).toHaveAttribute("href", "magnet:?xt=urn:btih:fixture");
  await frame.evaluate(() => {
    document.querySelector("#magnets-content .name").textContent = "ABC-123 4k";
  });
  await frame.locator("#enable-magnets-filter").click();
  await expect(frame.locator("[data-jhs-magnet-row]:visible")).toHaveCount(1);
  await frame.locator("#enable-magnets-filter").click();
  await expect(frame.locator("[data-jhs-magnet-row]:visible")).toHaveCount(2);
  for (const zoom of [1,1.25,1.5]) {
    await frame.evaluate(zoom => { document.body.style.zoom = String(zoom); document.querySelector("#magnets-content").style.width = `${1360/zoom}px`; }, zoom);
    const layout = await frame.locator("[data-jhs-magnet-row]").first().evaluate(row => ({display:getComputedStyle(row).display,overflow:row.scrollWidth>row.clientWidth+1, tops:[...row.querySelector('[data-jhs-magnet-part="actions"]').children].map(button=>button.getBoundingClientRect().top)}));
    expect(layout.display).toBe("grid"); expect(layout.overflow).toBe(false);
    expect(Math.max(...layout.tops)-Math.min(...layout.tops)).toBeLessThanOrEqual(1);
  }
  await frame.evaluate(() => {document.body.style.zoom="1";});
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({colorScheme:theme});
    await frame.evaluate(theme => document.documentElement.setAttribute("data-jhs-theme", theme), theme);
    await page.screenshot({path:testInfo.outputPath(`magnet-${theme}.png`),fullPage:true});
  }
});
