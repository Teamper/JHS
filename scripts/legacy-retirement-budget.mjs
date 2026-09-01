import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export const LEGACY_RETIREMENT_BASELINE = Object.freeze({
  ids: Object.freeze([
    "list.core",
    "list.auto-page",
    "detail.fc2-owned",
    "list.fc2-navigation",
    "list.fold-category",
    "list.actions",
    "settings.core",
    "list.cover-state-actions",
    "list.fc2-lookup",
    "detail.javdb-native",
    "detail.workspace",
    "detail.reviews",
    "detail.related",
    "detail.page-state-actions",
    "detail.native-magnets",
    "detail.javdb-preview",
    "detail.external-sites",
    "detail.external-magnets",
    "detail.screenshot",
    "responsive-shell.bottom-bar",
    "list.javbus-images",
    "detail.javbus-native",
    "detail.javbus-preview",
  ]),
  metrics: Object.freeze({
    registryEntries: 23,
    basePluginSubclasses: 24,
    optionalDependencyCallsites: 39,
    resolveLegacyContributionCallsites: 23,
    legacyDependencyEdges: 21,
    unsafeWindowLegacyExports: 9,
  }),
});

async function listJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".js") ? [fullPath] : [];
  }));
  return nested.flat();
}

function countMatches(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

function countDependencyEdges(source) {
  let count = 0;
  for (const match of source.matchAll(/^\s*[A-Za-z][A-Za-z0-9]*:\s*\[([^\]]*)\]/gms)) {
    count += countMatches(match[1], /"[^"]+"/g);
  }
  return count;
}

/** Collect the ratcheted legacy-runtime metrics from the current checkout. */
export async function collectLegacyRetirementMetrics(rootDir) {
  const srcRoot = path.join(rootDir, "src");
  const files = await listJavaScriptFiles(srcRoot);
  const sources = await Promise.all(files.map(async (file) => ({
    relative: path.relative(rootDir, file).replaceAll("\\", "/"),
    source: await readFile(file, "utf8"),
  })));
  const productionSources = sources.filter(({ relative }) => relative !== "src/core/plugin-manager.js");
  const registrySource = sources.find(({ relative }) => relative === "src/plugins/registry.js")?.source ?? "";
  const dependencyMapSource = sources.find(({ relative }) => relative === "src/plugins/dependency-map.js")?.source ?? "";
  const facadeSource = sources.find(({ relative }) => relative === "src/app/compatibility-facade.js")?.source ?? "";
  const facadeNames = facadeSource.match(/for\s*\(const name of \[([\s\S]*?)\]\)/)?.[1] ?? "";

  return {
    registryEntries: countMatches(registrySource, /manifest\("[^"]+"/g),
    basePluginSubclasses: countMatches(sources.map(({ source }) => source).join("\n"), /extends\s+BasePlugin\b/g),
    optionalDependencyCallsites: countMatches(productionSources.map(({ source }) => source).join("\n"), /\bgetOptionalDependency\s*\(/g),
    resolveLegacyContributionCallsites: countMatches(sources.map(({ source }) => source).join("\n"), /\bresolveLegacyContribution\?\.\s*\(/g),
    legacyDependencyEdges: countDependencyEdges(dependencyMapSource),
    unsafeWindowLegacyExports: countMatches(facadeNames, /"[^"]+"/g),
  };
}

/** @param {Record<string, number>} metrics */
export function assertLegacyRetirementBudget(metrics) {
  const baselineIds = new Set(LEGACY_RETIREMENT_BASELINE.ids);
  const violations = Object.entries(metrics)
    .filter(([name, value]) => value > LEGACY_RETIREMENT_BASELINE.metrics[name])
    .map(([name, value]) => `${name} increased from ${LEGACY_RETIREMENT_BASELINE.metrics[name]} to ${value}`);
  if (violations.length) throw new Error(`Legacy retirement budget exceeded: ${violations.join("; ")}`);
  return { baselineIds, violations };
}
