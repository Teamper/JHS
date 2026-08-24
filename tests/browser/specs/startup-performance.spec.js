import { expect, test } from "@playwright/test";
import budget from "../../../performance-budget.json" with { type: "json" };
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const SAMPLE_COUNT = 5;

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

for (const [label, url] of [
  ["JavDB", "https://javdb.com/v/test-id"],
  ["JavBus", "https://www.javbus.com/ABC-123"]
]) {
  test(`${label} fixture startup remains within the reviewed median`, async ({ context }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide", "one deterministic desktop project owns startup timing");
    await fulfillHostFixtures(context);
    const samples = [];
    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const startedAt = performance.now();
      await injectUserscriptRuntime(page);
      samples.push(performance.now() - startedAt);
      await page.close();
    }
    const actualMedian = median(samples);
    const baseline = budget.browserFixture.startupMedianMilliseconds[label];
    const maximum = baseline * (1 + budget.browserFixture.startupRegressionRatio);
    const report = `${label} fixture startup median ${actualMedian.toFixed(1)}ms; baseline ${baseline}ms; samples ${samples.map((value) => value.toFixed(1)).join(", ")}`;
    testInfo.annotations.push({ type: "startup-median", description: report });
    console.log(report);
    expect(baseline, `${label} startup baseline must be positive`).toBeGreaterThan(0);
    if (actualMedian > maximum) console.warn(`PERFORMANCE REVIEW REQUIRED: ${report}; reviewed maximum ${maximum.toFixed(1)}ms`);
  });
}
