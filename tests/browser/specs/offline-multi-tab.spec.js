import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

async function bootOfflineTabs(context) {
  await fulfillHostFixtures(context);
  const pages = await Promise.all([context.newPage(), context.newPage()]);
  for (const page of pages) {
    await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page, { settingOverrides: { enableLoadReview: "no", enable123Offline: true, enable115Offline: false } });
    await page.evaluate(() => {
      const offline = window.unsafeWindow.pluginManager.getBean("UnifiedOfflinePlugin");
      const candidate = { provider: { id: "123", name: "123", isEnabled: async () => true, submit: () => window.__auditCloudSubmit() }, availability: { authState: "ready" } };
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

test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop-wide", "one browser context proves cross-tab Web Locks behavior"));

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

test("a failed cloud submit releases the cross-tab resource lock for retry", async ({ context }) => {
  let submissions = 0;
  const pending = [];
  await context.exposeBinding("__auditCloudSubmit", () => {
    submissions++;
    return new Promise((resolve, reject) => pending.push({ resolve, reject }));
  });
  const [first, second] = await bootOfflineTabs(context);
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

test("an explicit history retry may submit a resource with a success receipt", async ({ context }) => {
  let submissions = 0;
  await context.exposeBinding("__auditCloudSubmit", () => { submissions++; return { taskId: "synthetic" }; });
  const [first, second] = await bootOfflineTabs(context);
  await startSubmission(first);
  await first.evaluate(() => window.__auditOfflinePromise);
  await second.evaluate(() => {
    const button = window.__auditOfflineButton;
    window.__auditOfflinePromise = window.__auditOfflineController.submitResource({ currentTarget: button[0] }, button.attr("data-resource"), button, { carNum: "ABC-123" }, "synthetic-history-id");
  });
  await second.evaluate(() => window.__auditOfflinePromise);
  expect(submissions).toBe(2);
});
