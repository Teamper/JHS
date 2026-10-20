import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { injectRealLayer } from "../harness/real-layer.js";

async function bootOfflineTabs(context, settings = {}) {
  await fulfillHostFixtures(context);
  const pages = await Promise.all([context.newPage(), context.newPage()]);
  for (const page of pages) {
    await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page, { beforeUserscriptInjection: injectRealLayer, settingOverrides: { enableLoadReview: "no", enable123Offline: true, enable115Offline: false, ...settings } });
    await page.evaluate(() => {
      const offline = window.unsafeWindow.pluginManager.getBean("UnifiedOfflinePlugin");
      const candidate = { provider: { id: "123", name: "123", isEnabled: async () => true, openUrl: () => "https://yun.123pan.com", submit: async (_resource, _info, options) => {
        options.onMutationDispatch();
        try { return await window.__auditCloudSubmit(); }
        catch (error) { if (window.__auditDefiniteRefusal) error.details = { submissionOutcome: "rejected" }; throw error; }
      } }, availability: { authState: "ready" } };
      offline.registry = { getCandidates: async () => [candidate], updateAvailability() {} };
      const button = window.jQuery('<button type="button" class="jhs-offline-btn" data-resource="magnet:?xt=urn:btih:synthetic-multitab">离线</button>').appendTo(document.body);
      window.__auditOfflineButton = button;
      window.__auditOfflineController = offline;
    });
  }
  return pages;
}

async function startSubmission(page) {
  await page.evaluate(() => {
    const button = window.__auditOfflineButton;
    window.__auditOfflinePromise = window.__auditOfflineController.submitResource({ currentTarget: button[0] }, button.attr("data-resource"), button, { carNum: "ABC-123" });
  });
}

test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop-wide" && !(info.project.name === "mobile" && info.title.startsWith("an unknown result")), "cross-tab locking runs on desktop; confirmation also covers touch"));

test("overlapping same-resource cloud submits from two tabs dispatch only once", async ({ context }) => {
  let submissions = 0;
  const releases = [];
  await context.exposeBinding("__auditCloudSubmit", () => {
    submissions++;
    return new Promise(resolve => releases.push(resolve));
  });
  const [first, second] = await bootOfflineTabs(context);
  expect(await first.evaluate(() => Boolean(navigator.locks?.request))).toBe(true);
  try {
    await startSubmission(first);
    await expect.poll(() => submissions).toBe(1);
    const held = await first.evaluate(async () => (await navigator.locks.query()).held.map(({ name }) => name).filter(name => name.startsWith("jhs_offline_submit_v1:")));
    expect(held).toHaveLength(1);
    expect(held[0]).not.toContain("synthetic-multitab");

    await startSubmission(second);
    await second.evaluate(() => window.__auditOfflinePromise);
    expect(submissions).toBe(1);
  } finally {
    for (const release of releases) release({ taskId: "synthetic" });
    await first.evaluate(() => window.__auditOfflinePromise).catch(() => null);
  }
});

test("a definite cloud refusal releases the cross-tab resource lock for retry", async ({ context }) => {
  let submissions = 0;
  const pending = [];
  await context.exposeBinding("__auditCloudSubmit", () => {
    submissions++;
    return new Promise((resolve, reject) => pending.push({ resolve, reject }));
  });
  const [first, second] = await bootOfflineTabs(context);
  await first.evaluate(() => { window.__auditDefiniteRefusal = true; });
  try {
    await startSubmission(first);
    await expect.poll(() => submissions).toBe(1);
    pending[0].reject(new Error("synthetic remote failure"));
    await first.evaluate(() => window.__auditOfflinePromise);
    await startSubmission(second);
    await expect.poll(() => submissions).toBe(2);
  } finally {
    for (const item of pending) item.resolve({ taskId: "synthetic" });
    await Promise.all([first, second].map(page => page.evaluate(() => window.__auditOfflinePromise).catch(() => null)));
  }
});

test("cloud success with failed local history does not submit again from another tab", async ({ context }) => {
  let submissions = 0;
  await context.exposeBinding("__auditCloudSubmit", () => { submissions++; return { taskId: "synthetic" }; });
  const [first, second] = await bootOfflineTabs(context);
  await first.evaluate(() => {
    window.__auditOfflineController.state.appendOfflineHistory = async () => { throw new Error("synthetic local history failure"); };
  });
  await startSubmission(first);
  await first.evaluate(() => window.__auditOfflinePromise);
  expect(submissions).toBe(1);
  await startSubmission(second);
  await expect(second.getByText("已核实，重新提交", { exact: true })).toBeVisible();
  await second.getByText("取消", { exact: true }).click();
  await second.evaluate(() => window.__auditOfflinePromise);
  expect(submissions).toBe(1);
});

test("a failed receipt reservation stops the cloud request before dispatch", async ({ context }) => {
  let submissions = 0;
  await context.exposeBinding("__auditCloudSubmit", () => { submissions++; return { taskId: "synthetic" }; });
  const [page] = await bootOfflineTabs(context);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("jhs_offline_receipt_v1:")) throw new Error("synthetic receipt storage failure");
      return original.call(this, key, value);
    };
  });
  await startSubmission(page);
  await page.evaluate(() => window.__auditOfflinePromise);
  expect(submissions).toBe(0);
});

test("an explicit history retry requires confirmation before a second submission", async ({ context }) => {
  let submissions = 0;
  await context.exposeBinding("__auditCloudSubmit", () => { submissions++; return { taskId: "synthetic" }; });
  const [first, second] = await bootOfflineTabs(context);
  await startSubmission(first);
  await first.evaluate(() => window.__auditOfflinePromise);
  await second.evaluate(() => {
    const button = window.__auditOfflineButton;
    window.__auditOfflinePromise = window.__auditOfflineController.submitResource({ currentTarget: button[0] }, button.attr("data-resource"), button, { carNum: "ABC-123" }, "synthetic-history-id");
  });
  await expect(second.getByText("已核实，重新提交", { exact: true })).toBeVisible();
  expect(submissions).toBe(1);
  await second.getByText("已核实，重新提交", { exact: true }).click();
  await second.evaluate(() => window.__auditOfflinePromise);
  expect(submissions).toBe(2);
});

for (const theme of ["light", "dark"]) test(`an unknown result persists past TTL and ordinary cross-tab clicks need confirmation (${theme})`, async ({ context }, testInfo) => {
  let submissions = 0;
  await context.exposeBinding("__auditCloudSubmit", () => { submissions++; if (submissions === 1) throw new Error("synthetic response lost"); return { taskId: "synthetic" }; });
  const [first, second] = await bootOfflineTabs(context, { themeMode: theme });
  await first.evaluate(() => { window.__auditOfflineController.state.appendOfflineHistory = async () => { throw new Error("synthetic history failure"); }; });
  await startSubmission(first);
  await first.evaluate(() => window.__auditOfflinePromise);
  await first.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith("jhs_offline_receipt_v1:"));
    const receipt = JSON.parse(localStorage.getItem(key));
    if (receipt.state !== "pending") throw new Error("expected unknown receipt");
    receipt.at = Date.now() - 2 * 86400_000;
    localStorage.setItem(key, JSON.stringify(receipt));
  });
  await second.evaluate(() => window.__auditOfflineButton[0].focus());
  await startSubmission(second);
  const confirm = second.getByText("已核实，重新提交", { exact: true });
  await expect(confirm).toBeVisible();
  const dialog = second.getByRole("dialog", { name: "确认重新提交" });
  await expect(dialog.getByRole("button", { name: "取消", exact: true })).toBeFocused();
  const cloudLink = dialog.getByRole("link", { name: "打开云盘核实" });
  await expect(cloudLink).toHaveAttribute("rel", "noopener noreferrer");
  await expect(cloudLink).toHaveAttribute("href", "https://yun.123pan.com");
  await expect(cloudLink).toBeVisible();
  const contentBox = await dialog.locator(".layui-layer-content").boundingBox(), linkBox = await cloudLink.boundingBox();
  expect(linkBox.y + linkBox.height).toBeLessThanOrEqual(contentBox.y + contentBox.height);
  await cloudLink.click({ trial: true });
  const box = await dialog.boundingBox(), viewport = second.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  await second.screenshot({ path: testInfo.outputPath(`offline-retry-${theme}.png`) });
  expect(submissions).toBe(1);
  await second.keyboard.press("Escape");
  await second.evaluate(() => window.__auditOfflinePromise);
  await expect(second.locator(".jhs-offline-btn[data-resource*=synthetic-multitab]")).toBeFocused();
  expect(submissions).toBe(1);
  await startSubmission(second);
  await expect(confirm).toBeVisible();
  await confirm.focus();
  await second.keyboard.press("Enter");
  await second.evaluate(() => window.__auditOfflinePromise);
  expect(submissions).toBe(2);
});

test("a changed receipt while confirming prevents a stale explicit retry", async ({ context }) => {
  let submissions = 0;
  await context.exposeBinding("__auditCloudSubmit", () => { submissions++; throw new Error("synthetic response lost"); });
  const [first, second] = await bootOfflineTabs(context);
  await startSubmission(first);
  await first.evaluate(() => window.__auditOfflinePromise);
  await startSubmission(second);
  await expect(second.getByText("已核实，重新提交", { exact: true })).toBeVisible();
  await first.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith("jhs_offline_receipt_v1:"));
    localStorage.setItem(key, JSON.stringify({ state: "submitted", at: Date.now(), providerId: "123", attemptId: "other-attempt" }));
  });
  await second.getByText("已核实，重新提交", { exact: true }).click();
  await second.evaluate(() => window.__auditOfflinePromise);
  expect(submissions).toBe(1);
});
