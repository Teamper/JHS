import { expect, test } from "@playwright/test";
import { assertNoHorizontalOverflow, fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const ownedUrl = "https://javdb.com/users/collection_codes?movieId=fixture-id&carNum=FC2-1234567&url=https%3A%2F%2Fjavdb.com%2Fv%2Ffixture-id&source=fc2";
const hostSelector = "body > section.section > .container";
const settings = { enableLoadReview: "no", enableLoadRelated: "no", enableLoadScreenShot: "no", enableLoadOtherSite: "no" };
test.beforeEach(({}, info) => test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "desktop and 390×844 main-host coverage"));

test("owned FC2 mounts in the main content while preserving and restoring host nodes", async ({ page, context }, info) => {
  await fulfillHostFixtures(context);
  await page.goto(ownedUrl);
  await page.evaluate(() => {
    window.__ownedMountProbe = {
      host: document.querySelector("body > section.section > .container"),
      original: [...document.querySelector("body > section.section > .container").childNodes],
      navigation: document.querySelector(".main-tabs"),
      modals: [...document.querySelectorAll(".modal")].map(node => ({ node, html: node.innerHTML })),
    };
  });
  await injectUserscriptRuntime(page, { settingOverrides: settings });
  const workspace = page.locator(`${hostSelector} > .jhs-fc2-workspace`);
  await expect(workspace).toHaveCount(1);
  await expect(workspace).toBeVisible();
  await expect(page.locator(".modal .jhs-fc2-workspace")).toHaveCount(0);
  expect(await page.evaluate(() => {
    const probe = window.__ownedMountProbe;
    return document.querySelector(".main-tabs") === probe.navigation
      && probe.modals.every(({ node, html }) => node.isConnected && node.innerHTML === html);
  })).toBe(true);
  const bounds = await workspace.evaluate(node => ({ client: node.clientWidth, scroll: node.scrollWidth }));
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1);
  await assertNoHorizontalOverflow(page);
  await workspace.screenshot({ path: info.outputPath("fc2-owned-visible.png") });
  await page.evaluate(async () => (await window.unsafeWindow.pluginManager.getBean("Fc2Plugin").getRuntimeService("scope")()).dispose());
  await expect(workspace).toHaveCount(0);
  expect(await page.evaluate(() => {
    const probe = window.__ownedMountProbe;
    return [...probe.host.childNodes].every((node, index) => node === probe.original[index])
      && probe.host.childNodes.length === probe.original.length
      && probe.modals.every(({ node, html }) => node.innerHTML === html);
  })).toBe(true);
  await page.reload();
  await injectUserscriptRuntime(page, { settingOverrides: settings });
  await expect(workspace).toHaveCount(1);
  await expect(workspace).toBeVisible();
});

test("ordinary collection codes keeps its original surface", async ({ page, context }) => {
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/users/collection_codes");
  await injectUserscriptRuntime(page, { settingOverrides: settings });
  await expect(page.locator(`${hostSelector} #collection-heading`)).toHaveText("收藏的番号");
  await expect(page.locator(`${hostSelector} #collection-empty`)).toHaveText("暂无内容");
  await expect(page.locator(".jhs-fc2-workspace")).toHaveCount(0);
  await expect(page.locator("#domain-notice")).toHaveText("Fixture domain notice");
});

for (const [name, count] of [["missing", 0], ["ambiguous", 2]]) {
  test(`owned FC2 retains the original page when the main host is ${name}`, async ({ page, context }) => {
    await fulfillHostFixtures(context);
    await page.goto(ownedUrl);
    await page.evaluate(matches => {
      const section = document.querySelector("body > section.section");
      if (matches === 0) section.classList.remove("section");
      else section.after(section.cloneNode(true));
      window.__ownedRetainedNodes = [...document.querySelectorAll("body > section, .modal section")].map(node => ({
        node, text: node.textContent,
        descendants: [node, ...node.querySelectorAll("*")].map(element => ({ element, children: [...element.childNodes] })),
      }));
    }, count);
    await injectUserscriptRuntime(page, { settingOverrides: settings });
    await expect(page.locator(".jhs-fc2-workspace")).toHaveCount(0);
    expect(await page.evaluate(() => window.__ownedRetainedNodes.every(({ node, text, descendants }) => node.isConnected && node.textContent === text
      && descendants.every(({ element, children }) => element.childNodes.length === children.length && [...element.childNodes].every((child, index) => child === children[index]))))).toBe(true);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.diagnostics.exportSnapshot().errors.map(error => error.message)))
      .toContain(`FC2 详情正文容器匹配异常：预期 1 个，实际 ${count} 个`);
  });
}
