import { expect, test } from "@playwright/test";
import budget from "../../../performance-budget.json" with { type: "json" };
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const SAMPLE_COUNT = Math.max(1, Number.parseInt(process.env.JHS_STARTUP_SAMPLES || "30", 10) || 30);
const BOOTSTRAP_PHASES = ["legacy-runtime", "pre-settings", "context", "settings-load", "settings-migration", "logger", "theme-ui", "registry", "feature-runtime", "data-prepare", "plugin-css", "plugin-runtime", "first-ready", "total"];

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

for (const [label, url] of [
  ["JavDB", "https://javdb.com/v/test-id"],
  ["JavBus", "https://www.javbus.com/ABC-123"]
]) {
  test(`${label} fixture startup remains within the reviewed median`, async ({ browser, context }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide", "one deterministic desktop project owns startup timing");
    const cold = process.env.JHS_STARTUP_MODE === "cold";
    if (!cold) await fulfillHostFixtures(context);
    const samples = [], phaseSamples = [];
    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      const sampleContext = cold ? await browser.newContext({ viewport: testInfo.project.use.viewport, hasTouch: testInfo.project.use.hasTouch, isMobile: testInfo.project.use.isMobile, serviceWorkers: "block" }) : context;
      if (cold) await fulfillHostFixtures(sampleContext);
      const page = await sampleContext.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const startedAt = performance.now();
      // 保持启动基准只测核心引导；评论默认开启的请求不纳入启动预算。
      await injectUserscriptRuntime(page, { settingOverrides: { enableLoadReview: "no" } });
      samples.push(performance.now() - startedAt);
      await expect.poll(() => page.evaluate(() => Boolean(window.__jhsBrowserDiagnostics?.bootstrapPhases?.["first-ready"]))).toBe(true);
      phaseSamples.push(await page.evaluate(() => window.__jhsBrowserDiagnostics.bootstrapPhases));
      for (const phase of BOOTSTRAP_PHASES) expect(typeof phaseSamples.at(-1)?.[phase], `${label} bootstrap phase ${phase} must be recorded`).toBe("number");
      await page.close();
      if (cold) await sampleContext.close();
    }
    const actualMedian = median(samples);
    const baseline = budget.browserFixture.startupMedianMilliseconds[label];
    const maximum = baseline * (1 + budget.browserFixture.startupRegressionRatio);
    const actualP95 = percentile(samples, 0.95);
    const report = `${label} fixture startup P50 ${actualMedian.toFixed(1)}ms P95 ${actualP95.toFixed(1)}ms; baseline ${baseline}ms; samples ${samples.map((value) => value.toFixed(1)).join(", ")}`;
    const harnessPhases = Object.keys(phaseSamples[0]?.harness || {}).map((phase) => `${phase}=${median(phaseSamples.map((sample) => sample.harness?.[phase] || 0)).toFixed(1)}ms`).join(", ");
    const bootstrapPhases = Object.keys(phaseSamples[0] || {}).filter((phase) => phase !== "harness").map((phase) => `${phase}=${median(phaseSamples.map((sample) => sample[phase] || 0)).toFixed(1)}ms`).join(", ");
    testInfo.annotations.push({ type: "startup-median", description: report });
    console.log(`${report}; harness phases ${harnessPhases}; bootstrap phases ${bootstrapPhases}`);
    expect(baseline, `${label} startup baseline must be positive`).toBeGreaterThan(0);
    expect(actualMedian, `${report}; reviewed maximum ${maximum.toFixed(1)}ms`).toBeLessThanOrEqual(maximum);
  });
}
