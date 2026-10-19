import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test.beforeEach(({}, info) => test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "subtitle desktop and touch coverage"));

const bodies = {
  srt: "1\n00:00:01,000 --> 00:00:02,000\n字幕 <b>literal text</b>\n",
  ass: "[Script Info]\nTitle: ABC-123\n[Events]\nDialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,字幕\n",
};

async function boot(page, context, { theme = "light", mode = "results" } = {}) {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await fulfillHostFixtures(context);
  const html = await readFile(new URL("../fixtures/javdb-detail-interactions.html", import.meta.url), "utf8");
  await context.route("https://javdb.com/v/**", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("https://javdb.com/v/test-id");
  const addScript = page.addScriptTag.bind(page);
  page.addScriptTag = async options => {
    if (options.path?.endsWith(".user.js")) {
      await addScript({ path: fileURLToPath(new URL("../fixtures/layer-runtime/layer-1.0.9.min.js", import.meta.url)) });
      await page.evaluate(({ bodies, mode }) => {
        const original = window.GM_xmlhttpRequest;
        window.__subtitleRequests = [];
        window.__subtitleRejections = [];
        window.addEventListener("unhandledrejection", event => window.__subtitleRejections.push(String(event.reason)));
        window.GM_xmlhttpRequest = options => {
          const url = String(options.url);
          if (!url.startsWith("https://api-shoulei-ssl.xunlei.com/oracle/subtitle") && !url.startsWith("https://subtitle.example/")) return original(options);
          window.__subtitleRequests.push(url);
          let aborted = false;
          queueMicrotask(() => {
            if (aborted) return;
            if (mode === "failure") return options.onerror?.({ error: "Fixture subtitle network failure" });
            const search = url.includes("/oracle/subtitle");
            const payload = { data: mode === "empty" ? [] : [
              { name: "ABC-123 SRT", ext: "srt", url: "https://subtitle.example/ABC-123.srt" },
              { name: "ABC-123 ASS", ext: "ass", url: "https://subtitle.example/ABC-123.ass" },
            ] };
            const data = search ? payload : bodies[url.endsWith(".ass") ? "ass" : "srt"];
            options.onload?.({ status: 200, finalUrl: url, response: data, responseText: search ? JSON.stringify(data) : data, responseHeaders: `content-type: ${search ? "application/json" : "text/plain"}` });
          });
          return { abort() { aborted = true; options.onabort?.(); } };
        };
      }, { bodies, mode });
    }
    return addScript(options);
  };
  try {
    await injectUserscriptRuntime(page, { settingOverrides: { themeMode: theme, enableLoadPreviewVideo: "no", enableLoadReview: "no", enableLoadOtherSite: "no", enableMagnetsFilter: "no" } });
  } finally { page.addScriptTag = addScript; }
  await expect(page.locator("#xunLeiSubtitleBtn")).toBeVisible();
  await page.evaluate(() => {
    const owner = window.unsafeWindow.pluginManager.getBean("DetailPageButtonPlugin");
    const service = owner.subtitle || owner.getRuntimeService("subtitle");
    const search = service.search.bind(service);
    service.search = async (...args) => {
      const results = await search(...args);
      window.__subtitleSource = results;
      window.__subtitleOriginal = JSON.stringify(results);
      return results;
    };
    const feedback = window.show;
    const report = feedback.error.bind(feedback);
    window.__subtitleMessages = [];
    feedback.error = (...args) => { window.__subtitleMessages.push(args.map(String).join(" ")); return report(...args); };
  });
  return errors;
}

async function expectDownload(page, trigger, extension) {
  const pending = page.waitForEvent("download");
  await trigger.click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe(`ABC-123.${extension}`);
  const stream = await download.createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString("utf8")).toBe(bodies[extension]);
}

for (const theme of ["light", "dark"]) test(`Xunlei frozen records render, preview and download with real Tabulator ${theme}`, async ({ page, context }, info) => {
  const errors = await boot(page, context, { theme });
  const trigger = page.locator("#xunLeiSubtitleBtn");
  await trigger.click();
  const dialog = page.locator(".layui-layer").filter({ has: page.locator("#xunlei-table-container") });
  const rows = dialog.locator(".tabulator-row").filter({ has: page.locator(".subtitle-preview-btn") });
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("ABC-123 SRT");
  await expect(rows.nth(1)).toContainText("ABC-123 ASS");
  expect(await page.evaluate(() => {
    const source = window.__subtitleSource;
    const table = window.Tabulator.findTable("#xunlei-table-container")[0];
    const independent = table.getData()[0] !== source[0];
    table.getRows()[0].getCell("name").setValue("Table-local subtitle name");
    return { independent, frozenArray: Object.isFrozen(source), frozenRecords: source.every(Object.isFrozen), unchanged: JSON.stringify(source) === window.__subtitleOriginal };
  })).toEqual({ independent: true, frozenArray: true, frozenRecords: true, unchanged: true });

  for (const [index, extension] of ["srt", "ass"].entries()) {
    await expectDownload(page, rows.nth(index).locator(".subtitle-download-btn"), extension);
    const previewButton = rows.nth(index).locator(".subtitle-preview-btn");
    await previewButton.click();
    const preview = page.locator(".layui-layer").filter({ has: page.locator(".jhs-code-viewer") });
    await expect(preview).toContainText(extension === "srt" ? "literal text" : "Dialogue:");
    await expect(preview.locator(".jhs-code-viewer b")).toHaveCount(0);
    await expectDownload(page, preview.locator(".layui-layer-btn0"), extension);
    if (extension === "srt") {
      await preview.locator(".layui-layer-close").focus();
      await page.keyboard.press("Enter");
    } else await preview.locator(".layui-layer-btn1").click();
    await expect(preview).toHaveCount(0);
    await expect(previewButton).toBeFocused();
  }
  await page.screenshot({ path: info.outputPath(`xunlei-${theme}.png`) });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => window.__subtitleRequests.some(url => url.includes("/oracle/subtitle")))).toBe(true);
  expect(await page.evaluate(() => window.__subtitleRejections)).toEqual([]);
  expect(errors).toEqual([]);
});

for (const mode of ["empty", "failure"]) test(`Xunlei ${mode} response reports feedback and closes loading`, async ({ page, context }) => {
  const errors = await boot(page, context, { mode });
  await page.locator("#xunLeiSubtitleBtn").click();
  await expect.poll(() => page.evaluate(() => window.__subtitleMessages.length)).toBeGreaterThan(0);
  await expect(page.locator("#xunlei-table-container")).toHaveCount(0);
  await expect(page.locator(".layui-layer-loading")).toHaveCount(0);
  expect(await page.evaluate(() => window.__subtitleRejections)).toEqual([]);
  expect(errors).toEqual([]);
});
