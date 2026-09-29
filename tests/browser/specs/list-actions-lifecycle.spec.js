import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const devUserscriptPath = join(repoRoot, "dist", "dev", "JHS-7.0.dev.user.js");

test.describe("JavDB list actions Feature lifecycle", () => {
  test("actor blacklist batch uses the shared Feature runner and keeps its transaction type", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/actors/fixture-actor", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      const list = document.querySelector(".movie-list");
      if (!list) throw new Error("JavDB list fixture is missing");
      document.querySelector(".pagination-next")?.remove();
      const toolbar = document.createElement("div");
      toolbar.className = "toolbar";
      const actor = document.createElement("div");
      actor.className = "actor-section-name";
      actor.textContent = "Fixture Actor, Alias";
      toolbar.append(actor);
      list.before(toolbar);
      const card = document.createElement("div");
      card.className = "item";
      const link = document.createElement("a");
      link.href = "/v/abc-123";
      const title = document.createElement("div");
      title.className = "video-title";
      const code = document.createElement("strong");
      code.textContent = "ABC-123";
      title.append(code, document.createTextNode(" Synthetic batch title"));
      link.append(title);
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = "2026-09-01";
      card.append(link, meta);
      list.replaceChildren(card);
    });
    await injectUserscriptRuntime(page, { settingOverrides: { enableLoadReview: "no", defaultQuickFilterTab: "all" } });

    const ownership = await page.evaluate(() => {
      const list = window.unsafeWindow.pluginManager.getBean("ListPagePlugin");
      return {
        featureRunner: typeof list?.listBatchController?.run,
        blacklistCompatibility: typeof window.unsafeWindow.pluginManager.getBean("BlacklistPlugin")?.filterAllVideo,
        button: Boolean(document.querySelector("#filterAllVideo")),
      };
    });
    expect(ownership).toEqual({ featureRunner: "function", blacklistCompatibility: "function", button: true });
    await page.evaluate(() => {
      window.__loadingAudit = { count: 0, stacks: [] };
      const original = window.loading;
      window.loading = () => {
        window.__loadingAudit.count += 1;
        window.__loadingAudit.stacks.push(new Error("loading created").stack);
        return original();
      };
    });

    await page.locator(".jhs-commandbar__batch .jhs-commandbar__menu-toggle").click();
    await page.locator("#filterAllVideo").click();
    await expect(page.locator(".layui-layer-btn0")).toBeVisible();
    const loadingAudit = await page.evaluate(() => window.__loadingAudit);
    expect(loadingAudit.count).toBe(0);
    await page.locator(".layui-layer-btn0").click();
    await expect.poll(() => page.evaluate(async () => {
      const log = await window.stateService.getActivityLog();
      return log.entries.find((entry) => entry.type === "actor-page-block")?.commitState || null;
    })).toBe("committed");
    await expect.poll(() => page.evaluate(async () => (await window.stateService.getState("ABC-123"))?.stateFlags?.blocked)).toBe(true);
  });

  test("List Feature owns safe JavBus markup normalization for initial and added cards", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://www.javbus.com/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      const root = document.querySelector(".masonry");
      const card = root?.querySelector(".item");
      if (!root || !card) throw new Error("JavBus list fixture card is missing");
      const header = document.createElement("header");
      header.id = "waterfall_h";
      root.before(header);
      const repeated = document.createElement("div");
      repeated.id = "waterfall";
      const moved = document.createElement("section");
      moved.id = "moved-waterfall-child";
      repeated.append(moved);
      root.before(repeated);
      root.id = "waterfall";
      const hostTitle = '<img src=x onerror="globalThis.pwned=true">';
      card.querySelector("img")?.setAttribute("title", hostTitle);
      card.querySelector(".photo-info")?.remove();
      card.querySelectorAll("a > date").forEach((node) => node.remove());
      card.querySelector("a")?.setAttribute("href", "/ABC-123");
      const info = document.createElement("div");
      info.className = "photo-info";
      const title = document.createElement("span"), hot = document.createElement("div"), code = document.createElement("date"), date = document.createElement("date");
      title.append(document.createElement("br"));
      hot.className = "item-tag";
      hot.textContent = "昨日新種";
      code.textContent = "ABC-123";
      date.textContent = "2026-08-25";
      title.append(hot, code, document.createTextNode(" / "), date, document.createTextNode(hostTitle));
      info.append(title);
      card.append(info);
    });
    await injectUserscriptRuntime(page, { userscriptPath: devUserscriptPath });

    const initial = await page.evaluate(() => {
      const card = document.querySelector(".masonry > .item");
      const title = card?.querySelector(".photo-info .video-title");
      const moved = document.querySelector("#moved-waterfall-child"), masonry = document.querySelector(".masonry");
      return {
        renamedHeader: document.querySelector("#no-page")?.tagName === "HEADER",
        repeatedWrapperRemoved: document.querySelectorAll('[id="waterfall"]:not(.masonry)').length === 0,
        movedChildInPlace: Boolean(moved && masonry && moved.parentElement === masonry.parentElement && (moved.compareDocumentPosition(masonry) & Node.DOCUMENT_POSITION_FOLLOWING)),
        masonryRootPreserved: document.querySelector(".masonry")?.id === "waterfall",
        titleAttribute: title?.getAttribute("title"),
        titleText: title?.firstChild?.textContent,
        titleCopies: card?.querySelector(".photo-info > span")?.textContent.split('<img src=x onerror="globalThis.pwned=true">').length - 1,
        trailingHostTitleCopies: [...(card?.querySelector(".photo-info > span")?.childNodes ?? [])].filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.includes('<img src=x onerror="globalThis.pwned=true">')).length,
        nestedInjectedImage: Boolean(title?.querySelector("img")),
        remainingBreaks: card?.querySelectorAll("br").length,
        preservedItemTag: card?.querySelector(".item-tag")?.textContent,
        preservedDates: [...(card?.querySelectorAll("date") ?? [])].map((node) => node.textContent),
        listFeatureActive: window.unsafeWindow.pluginManager.diagnostics.exportSnapshot().activeFeatures.includes("list"),
        navigationAdapterActive: Boolean(window.unsafeWindow.pluginManager.getBean("ListPagePlugin")?.delegate?.featureListNavigationAdapter),
      };
    });
    expect(initial).toEqual({
      renamedHeader: true,
      repeatedWrapperRemoved: true,
      movedChildInPlace: true,
      masonryRootPreserved: true,
      titleAttribute: '<img src=x onerror="globalThis.pwned=true">',
      titleText: '<img src=x onerror="globalThis.pwned=true">',
      titleCopies: 1,
      trailingHostTitleCopies: 0,
      nestedInjectedImage: false,
      remainingBreaks: 0,
      preservedItemTag: "昨日新種",
      preservedDates: ["ABC-123", "2026-08-25"],
      listFeatureActive: true,
      navigationAdapterActive: true,
    });

    await page.evaluate(() => {
      window.__javbusCardOpens = [];
      window.utils.openPage = (url, carNum, shadeClose, options) => window.__javbusCardOpens.push({
        url, carNum, shadeClose, newTab: options.newTab, ctrlKey: Boolean(options.event?.ctrlKey),
      });
    });
    const image = page.locator(".masonry .item img").first();
    await image.evaluate((element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true })));
    await expect.poll(() => page.evaluate(() => window.__javbusCardOpens.length)).toBe(1);
    await image.evaluate((element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
    await expect.poll(() => page.evaluate(() => window.__javbusCardOpens.length)).toBe(2);
    expect(await page.evaluate(() => window.__javbusCardOpens)).toEqual([
      { url: "https://www.javbus.com/ABC-123", carNum: "ABC-123", shadeClose: true, newTab: true, ctrlKey: true },
      { url: "https://www.javbus.com/ABC-123", carNum: "ABC-123", shadeClose: true, newTab: false, ctrlKey: false },
    ]);

    await page.evaluate(() => {
      const root = document.querySelector(".masonry"), template = root?.querySelector(".item");
      if (!root || !template) throw new Error("JavBus list fixture card is missing");
      const added = /** @type {HTMLElement} */ (template.cloneNode(true));
      added.removeAttribute("data-jhs-processed");
      added.querySelector("a")?.setAttribute("href", "/DEF-456");
      const title = document.createElement("span"), code = document.createElement("strong");
      code.textContent = "DEF-456";
      title.append(code);
      added.querySelector(".video-title")?.replaceWith(title);
      added.querySelector("img")?.setAttribute("title", "Dynamic fixture title");
      added.querySelector(".photo-info")?.append(document.createElement("br"));
      root.append(added);
    });
    const dynamicCard = page.locator('.masonry > .item a[href="/DEF-456"]').locator("xpath=..");
    const dynamicTitle = dynamicCard.locator(".photo-info .video-title");
    await expect(dynamicTitle).toHaveAttribute("title", "Dynamic fixture title");
    await expect(dynamicTitle.locator("strong")).toHaveText("DEF-456");
    await expect(dynamicCard.locator("br")).toHaveCount(0);
  });

  test("List Feature owns next-page navigation and keeps unrelated query parameters", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/?page=2&keyword=fixture", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      const pagination = document.createElement("ul");
      pagination.className = "pagination-list";
      const current = document.createElement("a");
      current.className = "pagination-link is-current";
      current.textContent = "2";
      pagination.append(current);
      document.querySelector(".movie-list")?.after(pagination);
    });
    await injectUserscriptRuntime(page, { userscriptPath: devUserscriptPath });

    const input = page.locator("#jumpPageInput");
    await expect(input).toHaveValue("3");
    const ownership = await page.evaluate(() => ({
      featureController: Boolean(window.unsafeWindow.pluginManager.getBean("ListPagePlugin").listView),
      legacyExecutorMethod: typeof window.unsafeWindow.pluginManager.getBean("ListPagePlugin").addJumpPageControl,
    }));
    expect(ownership).toEqual({ featureController: true, legacyExecutorMethod: "undefined" });
    await input.fill("7");
    await page.locator(".jhs-jump-page-btn").click();
    await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBe("7");
    expect(new URL(page.url()).searchParams.get("keyword")).toBe("fixture");
  });

  test("List Feature owns native card video playback without a duplicate legacy handler", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
    await page.locator(".movie-list > .item").evaluate((item) => {
      const video = document.createElement("video");
      video.className = "jhs-native-card-video";
      item.append(video);
    });
    await injectUserscriptRuntime(page, {
      userscriptPath: devUserscriptPath,
      settingOverrides: { enablePreviewVideo: "no", enableVideoSvg: "no" },
    });

    const video = page.locator(".jhs-native-card-video");
    const playback = await video.evaluate(async (element) => {
      const video = /** @type {HTMLVideoElement} */ (element);
      let plays = 0, pauses = 0;
      Object.defineProperty(video, "paused", { configurable: true, value: true });
      video.play = async () => { plays++; };
      video.pause = () => { pauses++; };
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      video.dispatchEvent(event);
      await Promise.resolve();
      await Promise.resolve();
      return { eventPrevented: event.defaultPrevented, plays, pauses };
    });
    expect(playback).toEqual({ eventPrevented: true, plays: 1, pauses: 0 });

    await page.evaluate(async () => {
      await window.unsafeWindow.pluginManager.getBean("ListPagePlugin").bindClick();
    });
    const afterLegacyCompatibilityCall = await video.evaluate(async (element) => {
      const video = /** @type {HTMLVideoElement} */ (element);
      let plays = 0;
      Object.defineProperty(video, "paused", { configurable: true, value: true });
      video.play = async () => { plays++; };
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      video.dispatchEvent(event);
      await Promise.resolve();
      await Promise.resolve();
      return { eventPrevented: event.defaultPrevented, plays };
    });
    expect(afterLegacyCompatibilityCall).toEqual({ eventPrevented: true, plays: 1 });

    await video.evaluate((element) => {
      const video = /** @type {HTMLVideoElement} */ (element);
      let pauses = 0;
      Object.defineProperty(video, "paused", { configurable: true, value: false });
      video.pause = () => { pauses++; };
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      video.dispatchEvent(event);
      if (!event.defaultPrevented || pauses !== 1) throw new Error("Feature did not own card video pause");
    });

  });

  test("Cover Button actions are Feature-owned, keep the legacy disable ID, and follow live settings", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page, {
      userscriptPath: devUserscriptPath,
      settingOverrides: { enablePreviewVideo: "no", enableVideoSvg: "no", enableHandleSvg: "yes" },
    });

    const ownership = await page.evaluate(() => ({
      legacyExecutor: window.unsafeWindow.pluginManager.getPluginNames().includes("CoverButtonPlugin"),
      compatibility: typeof window.unsafeWindow.pluginManager.getBean("CoverButtonPlugin")?.enableSvgBtn === "function",
      contribution: window.unsafeWindow.pluginManager.getPluginDescriptors().some(({ name }) => name === "CoverButtonPlugin"),
    }));
    expect(ownership).toEqual({ legacyExecutor: false, compatibility: true, contribution: true });
    await expect(page.locator(".movie-list > .item .jhs-cover-tools")).toHaveCount(1);
    const handle = page.locator(".movie-list > .item .handleSvg");
    await expect(handle).toHaveCSS("display", "block");
    await page.evaluate(async () => window.unsafeWindow.settingsService.set("enableHandleSvg", "no"));
    await expect(handle).toHaveCSS("display", "none");
    await page.evaluate(async () => window.unsafeWindow.settingsService.set("enableHandleSvg", "yes"));
    await expect(handle).toHaveCSS("display", "block");

    await page.locator(".movie-list > .item").evaluate((item) => {
      const next = /** @type {HTMLElement} */ (item.cloneNode(true));
      next.removeAttribute("data-jhs-processed");
      next.querySelector("a")?.setAttribute("href", "/v/def-456");
      const code = next.querySelector(".video-title strong");
      if (code) code.textContent = "DEF-456";
      next.querySelector(".jhs-cover-tools")?.remove();
      item.parentElement.append(next);
    });
    await page.waitForTimeout(250);
    const dynamicEvidence = await page.evaluate(() => {
      const plugin = window.unsafeWindow.pluginManager.getBean("ListPagePlugin");
      const item = document.querySelector('.movie-list > .item a[href="/v/def-456"]')?.closest(".item");
      return {
        cardProcessed: item?.dataset.jhsProcessed === "true",
        coverTools: item?.querySelectorAll(".jhs-cover-tools").length ?? 0,
        adapterAttached: Boolean(plugin?.delegate?.featureCoverButtonAdapter),
        addedItemsFeatureAttached: typeof plugin?.delegate?.featureListAddedItemsAdapter?.processAddedItems === "function",
      };
    });
    expect(dynamicEvidence).toEqual({ cardProcessed: true, coverTools: 1, adapterAttached: true, addedItemsFeatureAttached: true });
    await expect(page.locator('.movie-list > .item:has(a[href="/v/def-456"]) .jhs-cover-tools')).toHaveCount(1);
  });

  test("List Feature owns ordinary-list sorting and restores the original order", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      const root = document.querySelector(".movie-list");
      const template = root?.querySelector(".item");
      if (!root || !template) throw new Error("list fixture card is missing");
      for (const record of [
        { id: "jhs-older", carNum: "OLD-111", date: "2026-08-01", count: "5人評價" },
        { id: "jhs-newer", carNum: "NEW-222", date: "2026-08-30", count: "55人評價" },
      ]) {
        const card = /** @type {HTMLElement} */ (template.cloneNode(true));
        card.id = record.id;
        card.querySelector("a")?.setAttribute("href", `/v/${record.carNum.toLowerCase()}`);
        const code = card.querySelector(".video-title strong");
        if (code) code.textContent = record.carNum;
        const meta = card.querySelector(".meta");
        if (meta) meta.textContent = record.date;
        const count = card.querySelector(".score .count");
        if (count) count.textContent = record.count;
        card.setAttribute("data-jhs-publish-time", record.date);
        root.append(card);
      }
    });
    await injectUserscriptRuntime(page, {
      userscriptPath: devUserscriptPath,
      settingOverrides: { autoPage: "no", sortMethod: "date" },
    });

    const order = () => page.locator(".movie-list > .item").evaluateAll((items) => items.map((item) => item.id || item.querySelector(".video-title strong")?.textContent));
    await expect.poll(order).toEqual(["jhs-newer", "ABC-123", "jhs-older"]);
    await page.locator("#sort-toggle-btn").click();
    await page.locator('[data-sort-method="default"]').click();
    await expect.poll(order).toEqual(["ABC-123", "jhs-older", "jhs-newer"]);
  });

  test("mounts native List Feature actions once and releases their compatibility bean on dispose", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page, { userscriptPath: devUserscriptPath });

    await expect(page.locator("#waitCheckBtn")).toHaveCount(1);
    await expect(page.locator("#favoriteAllVideo")).toHaveCount(1);
    await expect(page.locator(".jhs-sort-control")).toHaveCount(1);
    const ownership = await page.evaluate(() => ({
      legacyExecutor: window.unsafeWindow.pluginManager.getPluginNames().includes("ListPageButtonPlugin"),
      compatibility: typeof window.unsafeWindow.pluginManager.getBean("ListPageButtonPlugin")?.openWaitCheck === "function",
      managedByFeature: window.unsafeWindow.pluginManager.getBean("ListPageButtonPlugin")?.managedByFeature === true,
    }));
    expect(ownership).toEqual({ legacyExecutor: false, compatibility: true, managedByFeature: true });

    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("ListPageButtonPlugin").dispose());
    await expect(page.locator("#waitCheckBtn, #favoriteAllVideo, #sort-toggle-btn")).toHaveCount(0);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("ListPageButtonPlugin"))).toBeUndefined();
  });

  test("preserves the old ListPageButtonPlugin disable setting while List core stays mounted", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page, { disabledPlugins: ["ListPageButtonPlugin"], userscriptPath: devUserscriptPath });

    await expect(page.locator(".movie-list .item")).toHaveCount(1);
    await expect(page.locator(".jhs-list-btn-row")).toHaveCount(0);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("ListPagePlugin")?.managedByFeature === true)).toBe(true);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("ListPagePlugin"))).toBe(false);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("ListPageButtonPlugin"))).toBe(false);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginDescriptors().some(({ name }) => name === "ListPageButtonPlugin"))).toBe(true);
  });

  test("List core owns right-click blocking once even when list actions are disabled", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page, {
      disabledPlugins: ["ListPageButtonPlugin"],
      settingOverrides: { enableSaveActressCarInfo: "no" },
      userscriptPath: devUserscriptPath,
    });
    await page.evaluate(() => {
      const actor = document.createElement("div");
      actor.className = "actor-section-name";
      actor.textContent = "Fixture Actress, Other";
      document.body.append(actor);
      window.__listBlockConfirms = [];
      window.utils.q = (_event, message, confirm) => {
        window.__listBlockConfirms.push(message);
        return confirm();
      };
    });
    const image = page.locator(".movie-list > .item img").first();
    await expect(image).toHaveCount(1);
    const prevented = await image.evaluate((element) => {
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 18, clientY: 29 });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(true);
    await expect.poll(() => page.evaluate(async () => (await window.stateService.getState("ABC-123"))?.stateFlags?.blocked)).toBe(true);
    const result = await page.evaluate(() => ({
      confirmations: window.__listBlockConfirms,
      names: window.__listBlockConfirms.length,
      listCore: window.unsafeWindow.pluginManager.getBean("ListPagePlugin")?.managedByFeature === true,
      listActions: window.unsafeWindow.pluginManager.getPluginNames().includes("ListPageButtonPlugin"),
    }));
    expect(result).toEqual({
      confirmations: ["是否屏蔽番号 ABC-123?"], names: 1, listCore: true, listActions: false,
    });
    await expect(page.locator(".movie-list > .item .jhs-status-tags .status-tag")).toHaveText(["已屏蔽"]);
  });

  test("List Feature owns the hoverBigImg subscription and replaces previews on live setting changes", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page, {
      settingOverrides: { hoverBigImg: "yes" },
      userscriptPath: devUserscriptPath,
    });

    await expect(page.locator(".image-hover-preview")).toHaveCount(1);
    expect(await page.evaluate(() => Boolean(window.unsafeWindow.pluginManager.getBean("ListPagePlugin")?.featureListHoverPreviewAdapter))).toBe(true);
    await page.evaluate(async () => window.settingsService.set("hoverBigImg", "no"));
    await expect(page.locator(".image-hover-preview")).toHaveCount(0);
    expect(await page.evaluate(() => window.imageHoverPreviewObj ?? null)).toBeNull();

    await page.evaluate(async () => window.settingsService.set("hoverBigImg", "yes"));
    await expect(page.locator(".image-hover-preview")).toHaveCount(1);
    const instances = await page.evaluate(() => ({
      previewCount: document.querySelectorAll(".image-hover-preview").length,
      hasInstance: Boolean(window.imageHoverPreviewObj),
      setting: window.settingsService.snapshot().hoverBigImg,
    }));
    expect(instances).toEqual({ previewCount: 1, hasInstance: true, setting: "yes" });
  });

  test("List Feature restores and persists the actor tag expansion under the legacy local key", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/actors/list-tag-expansion-fixture", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      const tags = document.createElement("section");
      tags.className = "actor-tags";
      tags.innerHTML = '<div class="content collapse">Fixture tags</div><button class="tag-expand" type="button">toggle</button>';
      tags.querySelector(".tag-expand").addEventListener("click", () => tags.querySelector(".content").classList.toggle("collapse"));
      document.querySelector("main")?.append(tags);
      localStorage.setItem("jhs_tag_expand", "true");
    });
    await injectUserscriptRuntime(page, { userscriptPath: devUserscriptPath });

    await expect(page.locator(".actor-tags .content")).not.toHaveClass(/collapse/);
    expect(await page.evaluate(() => Boolean(window.unsafeWindow.pluginManager.getBean("ListPagePlugin")?.featureListTagExpansionAdapter))).toBe(true);
    await page.locator(".actor-tags .tag-expand").click();
    await expect(page.locator(".actor-tags .content")).toHaveClass(/collapse/);
    expect(await page.evaluate(() => localStorage.getItem("jhs_tag_expand"))).toBe("false");
  });

  test("List Feature routes card modifier clicks and autoplay through the injected navigation capability", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page, { userscriptPath: devUserscriptPath });
    await page.evaluate(() => {
      window.__listCardOpens = [];
      window.utils.openPage = (url, carNum, shadeClose, options) => window.__listCardOpens.push({
        url, carNum, shadeClose, newTab: options.newTab, ctrlKey: Boolean(options.event?.ctrlKey),
      });
    });

    const image = page.locator(".movie-list > .item img").first();
    await image.evaluate((element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true })));
    await expect.poll(() => page.evaluate(() => window.__listCardOpens.length)).toBe(1);
    await image.evaluate((element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
    await expect.poll(() => page.evaluate(() => window.__listCardOpens.length)).toBe(2);
    expect(await page.evaluate(() => window.__listCardOpens)).toEqual([
      { url: "https://javdb.com/v/abc-123", carNum: "ABC-123", shadeClose: true, newTab: true, ctrlKey: true },
      { url: "https://javdb.com/v/abc-123", carNum: "ABC-123", shadeClose: true, newTab: false, ctrlKey: false },
    ]);
  });
});
