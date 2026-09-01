import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export const LEGACY_RETIREMENT_BASELINE = Object.freeze({
  metrics: Object.freeze({
    registryEntries: 0,
    basePluginSubclasses: 0,
    optionalDependencyCallsites: 0,
    resolveLegacyContributionCallsites: 0,
    legacyDependencyEdges: 0,
    unsafeWindowLegacyExports: 0,
  }),
});

export const LEGACY_RUNTIME_PATHS = Object.freeze([
  "src/core/plugin-manager.js",
  "src/core/legacy-contribution-registry.js",
  "src/plugins/registry.js",
  "src/plugins/dependency-map.js",
  "src/compat/list-page-adapter.js",
  "src/app/compatibility-facade.js",
]);

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
  const expectedNames = Object.keys(LEGACY_RETIREMENT_BASELINE.metrics);
  const missing = expectedNames.filter((name) => !Object.hasOwn(metrics, name));
  const unknown = Object.keys(metrics).filter((name) => !expectedNames.includes(name));
  const violations = [
    ...missing.map((name) => `${name} is missing`),
    ...unknown.map((name) => `${name} is not part of the sealed retirement metrics`),
    ...expectedNames
      .filter((name) => Object.hasOwn(metrics, name) && metrics[name] !== 0)
      .map((name) => `${name} must remain exactly 0 (current: ${metrics[name]})`),
  ];
  if (violations.length) throw new Error(`Legacy retirement budget exceeded: ${violations.join("; ")}`);
  return { violations };
}
