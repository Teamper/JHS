import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanImportTimeEffects } from "./import-time-purity.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function listJavaScriptFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return listJavaScriptFiles(fullPath);
        return entry.isFile() && entry.name.endsWith(".js") ? [fullPath] : [];
    }));
    return nested.flat();
}

async function checkImportGraph() {
    const files = await listJavaScriptFiles(path.join(rootDir, "src"));
    const knownFiles = new Set(files.map((file) => path.resolve(file)));
    /** @type {Map<string, string[]>} */
    const graph = new Map();
    const boundaryErrors = [];
    const allowedLayers = {
        core: new Set(["core"]),
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
            const sameIntegration = sourceLayer === "integrations" && targetLayer === "integrations" && sourceRelative[1] === targetRelative[1];
            const sameSharedLayer = sourceLayer === targetLayer && [ "services", "ui" ].includes(sourceLayer);
            const featureCatalog = sourceRelative.join("/") === "features/catalog.js" && targetLayer === "features";
            if (allowedLayers[sourceLayer] && !allowedLayers[sourceLayer].has(targetLayer) && !sameFeature && !sameIntegration && !sameSharedLayer && !featureCatalog) {
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

async function checkImportTimePurity() {
    const files = await listJavaScriptFiles(path.join(rootDir, "src"));
    const violations = [];
    for (const file of files) {
        const relativeFile = path.relative(rootDir, file).replaceAll("\\", "/");
        if (relativeFile === "src/main.js") continue;
        const source = await readFile(file, "utf8");
        for (const violation of scanImportTimeEffects(source, file)) {
            violations.push(`${relativeFile}:${violation.line}:${violation.column}: ${violation.effect.slice(0, 160)}`);
        }
    }
    if (violations.length) {
        violations.forEach((violation) => console.error(`import-time side effect: ${violation}`));
        throw new Error(`Bootstrap purity failed (${violations.length} import-time side effect(s))`);
    }
    console.log(`Bootstrap purity passed (${files.length - 1} non-root modules)`);
}

await checkImportGraph();
await checkImportTimePurity();
