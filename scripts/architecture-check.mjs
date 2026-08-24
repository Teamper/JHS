import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(rootDir, "architecture-baseline.json");

const rules = [
    { id: "internal-getbean", pattern: /\.getBean\s*\(/, phase: 6 },
    { id: "feature-direct-gmhttp", pattern: /\bgmHttp\s*\./, phase: 5, featureOnly: true },
    { id: "feature-direct-layer", pattern: /\blayer\s*\./, phase: 5, featureOnly: true },
    { id: "feature-direct-localstorage", pattern: /\blocalStorage\s*\./, phase: 5, featureOnly: true },
    { id: "feature-third-party-url", pattern: /https?:\/\//, phase: 4, featureOnly: true },
    { id: "host-selector", pattern: /(?:\.movie-panel-info|#magnet-table|\.movie-list)/, phase: 4 },
    { id: "app-global-listener", pattern: /(?:window|document)\.addEventListener\s*\(/, phase: 7 },
    { id: "app-global-observer", pattern: /new\s+MutationObserver\s*\(/, phase: 7 },
];

async function listJavaScriptFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return listJavaScriptFiles(fullPath);
        return entry.isFile() && entry.name.endsWith(".js") ? [fullPath] : [];
    }));
    return nested.flat();
}

function normalizeLine(line) {
    return line.trim()
        .replace(/^export\s+/, "")
        // Dependency injection is the approved in-place replacement for the
        // legacy locator; unrelated debt on the same line keeps its identity.
        .replace(/\.getDependency\s*\(/g, ".getBean(")
        .replace(/\s+/g, " ");
}

function fingerprint(rule, normalizedLine) {
    return createHash("sha256").update(`${rule}\0${normalizedLine}`).digest("hex").slice(0, 16);
}

async function scan() {
    const findings = [];
    const files = await listJavaScriptFiles(path.join(rootDir, "src"));
    for (const file of files) {
        const relativeFile = path.relative(rootDir, file).replaceAll("\\", "/");
        const isFeature = relativeFile.startsWith("src/plugins/") || relativeFile.startsWith("src/features/");
        const lines = (await readFile(file, "utf8")).split(/\r?\n/);
        for (const rule of rules) {
            if (rule.featureOnly && !isFeature) continue;
            lines.forEach((line, index) => {
                if (rule.id === "host-selector" && /host-adapter\.js$/.test(relativeFile)) return;
                if (!rule.pattern.test(line)) return;
                const symbol = normalizeLine(line);
                findings.push({
                    rule: rule.id,
                    file: relativeFile,
                    symbol,
                    fingerprint: fingerprint(rule.id, symbol),
                    line: index + 1,
                    reason: "legacy debt recorded before the v6.5 migration",
                    removalPhase: rule.phase,
                });
            });
        }
    }
    return findings.sort((a, b) => `${a.rule}:${a.file}:${a.line}`.localeCompare(`${b.rule}:${b.file}:${b.line}`));
}

async function checkImportGraph() {
    const files = await listJavaScriptFiles(path.join(rootDir, "src"));
    const knownFiles = new Set(files.map((file) => path.resolve(file)));
    /** @type {Map<string, string[]>} */
    const graph = new Map();
    const boundaryErrors = [];
    const allowedLayers = {
        features: new Set(["services", "ui", "contracts", "core"]),
        services: new Set(["contracts", "core"]),
        integrations: new Set(["contracts", "core"]),
        ui: new Set(["contracts", "core"]),
        platform: new Set(["contracts", "core"]),
        contracts: new Set(["core"]),
    };
    for (const file of files) {
        const source = await readFile(file, "utf8");
        const dependencies = [];
        for (const match of source.matchAll(/^import\s+[^;]*?from\s+["']([^"']+)["'];?/gm)) {
            if (!match[1].startsWith(".")) continue;
            const dependency = path.resolve(path.dirname(file), match[1]);
            if (!knownFiles.has(dependency)) continue;
            dependencies.push(dependency);
            const sourceLayer = path.relative(path.join(rootDir, "src"), file).split(path.sep)[0];
            const targetLayer = path.relative(path.join(rootDir, "src"), dependency).split(path.sep)[0];
            const sourceRelative = path.relative(path.join(rootDir, "src"), file).split(path.sep);
            const targetRelative = path.relative(path.join(rootDir, "src"), dependency).split(path.sep);
            const sameFeature = sourceLayer === "features" && targetLayer === "features" && sourceRelative[1] === targetRelative[1];
            const featureCatalog = sourceRelative.join("/") === "features/catalog.js" && targetLayer === "features";
            if (allowedLayers[sourceLayer] && !allowedLayers[sourceLayer].has(targetLayer) && !sameFeature && !featureCatalog) {
                boundaryErrors.push(`${sourceLayer} -> ${targetLayer}: ${path.relative(rootDir, file)} imports ${path.relative(rootDir, dependency)}`);
            }
        }
        graph.set(file, dependencies);
    }

    const visiting = new Set();
    const visited = new Set();
    const stack = [];
    const cycles = [];
    function visit(file) {
        if (visiting.has(file)) {
            const index = stack.indexOf(file);
            cycles.push([...stack.slice(index), file].map((item) => path.relative(rootDir, item).replaceAll("\\", "/")).join(" -> "));
            return;
        }
        if (visited.has(file)) return;
        visiting.add(file);
        stack.push(file);
        for (const dependency of graph.get(file) ?? []) visit(dependency);
        stack.pop();
        visiting.delete(file);
        visited.add(file);
    }
    for (const file of files) visit(file);
    if (boundaryErrors.length || cycles.length) {
        [...boundaryErrors, ...cycles.map((cycle) => `import cycle: ${cycle}`)].forEach((error) => console.error(error));
        throw new Error(`Import architecture failed (${boundaryErrors.length} boundary, ${cycles.length} cycle)`);
    }
    console.log(`Import graph passed (${files.length} modules, 0 cycles)`);
}

const findings = await scan();
if (process.argv.includes("--write-baseline")) {
    await writeFile(baselinePath, `${JSON.stringify({ version: 1, exceptions: findings }, null, 2)}\n`);
    console.log(`Wrote ${findings.length} architecture exceptions to architecture-baseline.json`);
    process.exit(0);
}

const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
const approved = new Set(baseline.exceptions.map((item) => `${item.rule}\0${item.file}\0${item.fingerprint}`));
const additions = findings.filter((item) => !approved.has(`${item.rule}\0${item.file}\0${item.fingerprint}`));
if (additions.length) {
    for (const item of additions) {
        console.error(`${item.rule}: new exception at ${item.file}:${item.line} (${item.symbol})`);
    }
    throw new Error(`Architecture debt increased by ${additions.length} exception(s)`);
}

const remaining = findings.length;
const removed = baseline.exceptions.length - remaining;
console.log(`Architecture debt ratchet passed (${remaining} remaining, ${removed} removed)`);
await checkImportGraph();
