import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test("FC2 JavDB want login retries without the TOP250 contribution", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers the account dialog");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/users/collection_codes?movieId=fixture-id&carNum=FC2-123&url=https%3A%2F%2Ffc2ppvdb.com%2Farticles%2F123&source=fc2", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { disabledPlugins: ["TOP250Plugin"] });
  await expect(page.locator('.jhs-fc2-workspace[data-jhs-fc2-mode="page"]')).toBeVisible();
  await expect(page.locator('[data-jhs-action="javdb-want"]')).toBeEnabled();

  await page.evaluate(() => {
    const fc2 = window.unsafeWindow.pluginManager.getBean("Fc2Plugin");
    const account = fc2.getRuntimeService("account");
    const credential = fc2.getRuntimeService("credential");
    window.__fc2WantProbe = { loginCount: 0, credentialKeys: [], submitUrls: [], token: "" };
    account.login = async () => {
      window.__fc2WantProbe.loginCount += 1;
      return { success: true, token: "synthetic-javdb-token" };
    };
    credential.get = async () => window.__fc2WantProbe.token;
    credential.set = async (key, value) => {
      window.__fc2WantProbe.credentialKeys.push(key);
      window.__fc2WantProbe.token = value;
    };
    window.credentialService = credential;
    const request = window.GM_xmlhttpRequest;
    window.GM_xmlhttpRequest = (options) => {
      if (String(options.url).includes("/v1/movies/fixture-id/reviews")) {
        window.__fc2WantProbe.submitUrls.push(String(options.url));
        queueMicrotask(() => options.onload?.({ status: 200, response: { success: 1 }, responseText: '{"success":1}', responseHeaders: "content-type: application/json" }));
        return { abort() {} };
      }
      return request(options);
    };
  });

  await page.locator('[data-jhs-action="javdb-want"]').click();
  await expect(page.locator('.layui-layer #loginBtn')).toBeVisible();
  await page.locator('.layui-layer #username').fill("synthetic-user");
  await page.locator('.layui-layer #password').fill("synthetic-password");
  await page.locator('.layui-layer #loginBtn').click();
  await expect(page.locator('[data-jhs-action="javdb-want"]')).toHaveText("已加入 JavDB 想看");
  expect(await page.evaluate(() => window.__fc2WantProbe)).toEqual({
    loginCount: 1,
    credentialKeys: ["jhs_appAuthorization"],
    submitUrls: ["https://jdforrepam.com/api/v1/movies/fixture-id/reviews"],
    token: "synthetic-javdb-token",
  });
  expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("TOP250Plugin"))).toBe(false);
});

test("FC2 JavDB want remains committed after cache and success-notice failures", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers the post-commit boundary");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/users/collection_codes?movieId=fixture-id&carNum=FC2-123&url=https%3A%2F%2Ffc2ppvdb.com%2Farticles%2F123&source=fc2", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  const button = page.locator('[data-jhs-action="javdb-want"]');
  await expect(button).toBeEnabled();

  await page.evaluate(() => {
    window.__fc2PostCommitProbe = { submissions: 0, cacheFailures: 0 };
    const fc2 = window.unsafeWindow.pluginManager.getBean("Fc2Plugin");
    const credential = fc2.getRuntimeService("credential");
    credential.get = async () => "synthetic-javdb-token";
    window.credentialService = credential;
    window.storageManager.deleteCachedRequest = async () => {
      window.__fc2PostCommitProbe.cacheFailures += 1;
      throw new Error("synthetic cache failure");
    };
    window.show.ok = () => { throw new Error("synthetic toast failure"); };
    const request = window.GM_xmlhttpRequest;
    window.GM_xmlhttpRequest = (options) => {
      if (String(options.url).includes("/v1/movies/fixture-id/reviews")) {
        window.__fc2PostCommitProbe.submissions += 1;
        queueMicrotask(() => options.onload?.({ status: 200, response: { success: 1 }, responseText: '{"success":1}', responseHeaders: "content-type: application/json" }));
        return { abort() {} };
      }
      return request(options);
    };
  });

  await button.click();
  await expect(button).toHaveText("已加入 JavDB 想看");
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await button.click();
  expect(await page.evaluate(() => window.__fc2PostCommitProbe)).toEqual({ submissions: 1, cacheFailures: 1 });
});

test("FC2 JavDB login continues after its success notice fails", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers the account dialog");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/users/collection_codes?movieId=fixture-id&carNum=FC2-123&url=https%3A%2F%2Ffc2ppvdb.com%2Farticles%2F123&source=fc2", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  const button = page.locator('[data-jhs-action="javdb-want"]');
  await expect(button).toBeEnabled();

  await page.evaluate(() => {
    const fc2 = window.unsafeWindow.pluginManager.getBean("Fc2Plugin");
    const account = fc2.getRuntimeService("account");
    const credential = fc2.getRuntimeService("credential");
    window.__fc2LoginPostCommitProbe = { credentialWrites: 0, submissions: 0, token: "" };
    account.login = async () => ({ success: true, token: "synthetic-javdb-token" });
    credential.get = async () => window.__fc2LoginPostCommitProbe.token;
    credential.set = async (_key, value) => {
      window.__fc2LoginPostCommitProbe.credentialWrites += 1;
      window.__fc2LoginPostCommitProbe.token = value;
    };
    window.credentialService = credential;
    fc2.getRuntimeService("notifications").ok = () => { throw new Error("synthetic toast failure"); };
    const request = window.GM_xmlhttpRequest;
    window.GM_xmlhttpRequest = (options) => {
      if (String(options.url).includes("/v1/movies/fixture-id/reviews")) {
        window.__fc2LoginPostCommitProbe.submissions += 1;
        queueMicrotask(() => options.onload?.({ status: 200, response: { success: 1 }, responseText: '{"success":1}', responseHeaders: "content-type: application/json" }));
        return { abort() {} };
      }
      return request(options);
    };
  });

  await button.click();
  await expect(page.locator('.layui-layer #loginBtn')).toBeVisible();
  await page.locator('.layui-layer #username').fill("synthetic-user");
  await page.locator('.layui-layer #password').fill("synthetic-password");
  await page.locator('.layui-layer #loginBtn').click();
  await expect(button).toHaveText("已加入 JavDB 想看");
  await expect(page.locator('.layui-layer #loginBtn')).toHaveCount(0);
  expect(await page.evaluate(() => window.__fc2LoginPostCommitProbe)).toEqual({
    credentialWrites: 1, submissions: 1, token: "synthetic-javdb-token",
  });
});
