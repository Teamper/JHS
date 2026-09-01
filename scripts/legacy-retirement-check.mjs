import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertLegacyRetirementBudget, collectLegacyRetirementMetrics, LEGACY_RETIREMENT_BASELINE, LEGACY_RUNTIME_PATHS } from "./legacy-retirement-budget.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const relativePath of LEGACY_RUNTIME_PATHS) {
  try {
    await access(path.join(rootDir, relativePath));
  } catch (error) {
    if (error?.code === "ENOENT") continue;
    throw error;
  }
  throw new Error(`Retired legacy runtime file returned: ${relativePath}`);
}

const metrics = await collectLegacyRetirementMetrics(rootDir);
assertLegacyRetirementBudget(metrics);
console.log("Legacy retirement budget passed:");
for (const [name, value] of Object.entries(metrics)) {
  console.log(`  ${name.padEnd(38)} ${value} (sealed == ${LEGACY_RETIREMENT_BASELINE.metrics[name]})`);
}
