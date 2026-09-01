import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertLegacyRetirementBudget, collectLegacyRetirementMetrics, LEGACY_RETIREMENT_BASELINE } from "./legacy-retirement-budget.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const currentIds = [];
const baselineIds = LEGACY_RETIREMENT_BASELINE.ids;
const baselineSet = new Set(baselineIds);
const additions = currentIds.filter((id) => !baselineSet.has(id));
const orderChanged = currentIds.some((id, index) => id !== baselineIds.filter((candidate) => currentIds.includes(candidate))[index]);
if (additions.length || orderChanged) {
  throw new Error(`Legacy contribution IDs may only be removed; additions: ${additions.join(", ") || "none"}`);
}

const metrics = await collectLegacyRetirementMetrics(rootDir);
assertLegacyRetirementBudget({ ...metrics, registryEntries: currentIds.length });
console.log("Legacy retirement budget passed:");
for (const [name, value] of Object.entries({ ...metrics, registryEntries: currentIds.length })) {
  console.log(`  ${name.padEnd(38)} ${value} (baseline <= ${LEGACY_RETIREMENT_BASELINE.metrics[name]})`);
}
