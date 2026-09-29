import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test("blacklist host scans use the current site's login session before GM fallback", async ({ context, page }, info) => {
  test.skip(info.project.name !== "desktop-wide", "one isolated browser context proves the credential boundary");
  await fulfillHostFixtures(context);
  await context.addCookies([{ name: "jhs_fixture_session", value: "signed-in", domain: "javdb.com", path: "/", secure: true }]);
  const targetUrl = "https://javdb.com/actors/jhs-auth-fixture?t=d";
  let cookieObserved = false;
  await context.route(targetUrl, async (route) => {
    cookieObserved = route.request().headers().cookie?.includes("jhs_fixture_session=signed-in") === true;
    await route.fulfill(cookieObserved
      ? { status: 200, contentType: "text/html", body: '<!DOCTYPE html><html><body><main class="movie-list" data-jhs-auth-fixture="yes"><div class="item"><a href="/v/jhs-auth-001"><div class="video-title"><strong>JHS-AUTH-001</strong> Fixture</div><div class="meta">2026-09-29</div></a></div></main></body></html>' }
      : { status: 200, contentType: "text/javascript", body: "window.location.href='/login';" });
  });
  await page.goto("https://javdb.com/");
  await injectUserscriptRuntime(page, {
    settingOverrides: { enableCheckBlacklist: "yes", enableCheckFavoriteActress: "no", enableCheckNewVideo: "no" },
  });
  await expect.poll(() => page.evaluate(() => Boolean(window.unsafeWindow.pluginManager.getBean("TaskPlugin")?.featureBlacklistScanController))).toBe(true);

  const result = await page.evaluate(async (url) => {
    const controller = window.unsafeWindow.pluginManager.getBean("TaskPlugin").featureBlacklistScanController;
    const item = { starId: "jhs-auth-fixture", name: "Synthetic Actor", allName: ["Synthetic Actor"], role: "actor", movieType: "", url, createTime: "2026-09-29" };
    await window.unsafeWindow.storageManager.addBlacklistItem(item);
    await controller.scanActor({ item, site: "javdb" }, {
      requestConfig: { httpTimeout: 5000, httpRetryCount: 1, circuitBreakerThreshold: 3, circuitBreakerCooldown: 30000 },
      getTimestamp: () => "2026-09-29 00:00:00",
    });
    const saved = (await window.unsafeWindow.storageManager.getBlacklist()).find((entry) => entry.starId === item.starId);
    const savedCars = (await window.unsafeWindow.storageManager.getBlacklistCarList()).filter((entry) => entry.starId === item.starId);
    return {
      gmCallsForTarget: window.__jhsBrowserDiagnostics.requests.filter((request) => request.url === url).length,
      checkTime: saved?.checkTime,
      savedCars: savedCars.map((entry) => ({ carNum: entry.carNum, names: entry.names, starId: entry.starId })),
    };
  }, targetUrl);

  expect(cookieObserved).toBe(true);
  expect(result).toEqual({
    gmCallsForTarget: 0,
    checkTime: "2026-09-29 00:00:00",
    savedCars: [{ carNum: "JHS-AUTH-001", names: "Synthetic Actor", starId: "jhs-auth-fixture" }],
  });
});

test("JavBus blacklist scans skip the native actor profile item", async ({ context, page }, info) => {
  test.skip(info.project.name !== "desktop-wide", "one isolated browser context proves the native actor-page boundary");
  await fulfillHostFixtures(context);
  await context.addCookies([{ name: "jhs_fixture_session_bus", value: "signed-in", domain: ".javbus.com", path: "/", secure: true }]);
  const targetUrl = "https://www.javbus.com/star/jhs-auth-fixture";
  let cookieObserved = false;
  await context.route(targetUrl, async (route) => {
    cookieObserved = route.request().headers().cookie?.includes("jhs_fixture_session_bus=signed-in") === true;
    await route.fulfill(cookieObserved
      ? { status: 200, contentType: "text/html", body: '<!DOCTYPE html><html><body><div id="waterfall"><div class="item"><div class="avatar-box">Synthetic Actor</div></div><div class="item"><a href="/JHS-BUS-001"><img title="Fixture"><date>JHS-BUS-001</date><date>2026-09-29</date></a></div></div></body></html>' }
      : { status: 200, contentType: "text/javascript", body: "window.location.href='/login';" });
  });
  await page.goto("https://www.javbus.com/");
  await injectUserscriptRuntime(page, {
    settingOverrides: { enableCheckBlacklist: "yes", enableCheckFavoriteActress: "no", enableCheckNewVideo: "no" },
  });
  await expect.poll(() => page.evaluate(() => Boolean(window.unsafeWindow.pluginManager.getBean("TaskPlugin")?.featureBlacklistScanController))).toBe(true);

  const result = await page.evaluate(async (url) => {
    const controller = window.unsafeWindow.pluginManager.getBean("TaskPlugin").featureBlacklistScanController;
    const item = { starId: "jhs-auth-fixture", name: "Synthetic Actor", allName: ["Synthetic Actor"], role: "actor", movieType: "", url, createTime: "2026-09-29" };
    await window.unsafeWindow.storageManager.addBlacklistItem(item);
    await controller.scanActor({ item, site: "javbus" }, {
      requestConfig: { httpTimeout: 5000, httpRetryCount: 1, circuitBreakerThreshold: 3, circuitBreakerCooldown: 30000 },
      getTimestamp: () => "2026-09-29 00:00:00",
    });
    const saved = (await window.unsafeWindow.storageManager.getBlacklist()).find((entry) => entry.starId === item.starId);
    const savedCars = (await window.unsafeWindow.storageManager.getBlacklistCarList()).filter((entry) => entry.starId === item.starId);
    return {
      gmCallsForTarget: window.__jhsBrowserDiagnostics.requests.filter((request) => request.url === url).length,
      checkTime: saved?.checkTime,
      savedCars: savedCars.map((entry) => ({ carNum: entry.carNum, names: entry.names, starId: entry.starId })),
    };
  }, targetUrl);

  expect(cookieObserved).toBe(true);
  expect(result).toEqual({
    gmCallsForTarget: 0,
    checkTime: "2026-09-29 00:00:00",
    savedCars: [{ carNum: "JHS-BUS-001", names: "Synthetic Actor", starId: "jhs-auth-fixture" }],
  });
});
