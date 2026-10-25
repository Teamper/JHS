import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateBundleBudget, formatBundleBudget, validateBundleBudget } from "./bundle-budget.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const budget = JSON.parse(await readFile(path.join(rootDir, "performance-budget.json"), "utf8"));
validateBundleBudget(budget.bundle);
if (!budget.browserFixture?.startupBaselineReason) throw new Error("Fixture startup baseline changes require a reason");
if (!budget.browserFixture?.ciStartupBaselineReason) throw new Error("CI fixture startup baseline changes require a reason");
for (const label of Object.keys(budget.browserFixture.maximumInitialRequests || {})) {
    const baseline = budget.browserFixture.startupMedianMilliseconds?.[label];
    if (!Number.isFinite(baseline) || baseline <= 0) throw new Error(`Missing positive fixture startup baseline for ${label}`);
    const ciBaseline = budget.browserFixture.ciStartupMedianMilliseconds?.[label];
    if (!Number.isFinite(ciBaseline) || ciBaseline <= 0) throw new Error(`Missing positive CI fixture startup baseline for ${label}`);
}
const size = (await stat(path.join(rootDir, "dist", "dev", "JHS-7.0.dev.user.js"))).size;
const result = evaluateBundleBudget(size, budget.bundle);
const message = formatBundleBudget("Dev artifact", result);
if (result.status === "exceeded") throw new Error(`${message}; review bundle growth or justify a budget change`);
if (result.status === "warning") {
    console.warn(`${process.env.GITHUB_ACTIONS === "true" ? "::warning::" : ""}${message}; explain growth and attach npm run analyze:bundle output for module cost review`);
} else {
    console.log(message);
}
console.log(`Fixture budget configuration validated (runtime measurements run separately): requests ${JSON.stringify(budget.browserFixture.maximumInitialRequests)}; Windows Edge startup medians ${JSON.stringify(budget.browserFixture.startupMedianMilliseconds)}ms; GitHub Ubuntu Chromium startup medians ${JSON.stringify(budget.browserFixture.ciStartupMedianMilliseconds)}ms`);
