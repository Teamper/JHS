import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const integrationsDir = path.join(rootDir, "src", "integrations");
const allowedTrustClasses = new Set(["builtin-public", "custom-public", "user-local"]);
const allowedQualities = new Set(["bronze", "silver"]);

async function exists(file) {
    try {
        await access(file);
        return true;
    } catch {
        return false;
    }
}

if (!(await exists(integrationsDir))) {
    console.log("Integration quality gate passed (migration catalog not created yet)");
    process.exit(0);
}

const entries = (await readdir(integrationsDir, { withFileTypes: true })).filter((entry) => entry.isDirectory());
const errors = [];
for (const entry of entries) {
    const directory = path.join(integrationsDir, entry.name);
    const manifestPath = path.join(directory, "manifest.js");
    if (!(await exists(manifestPath))) {
        errors.push(`${entry.name}: missing manifest.js`);
        continue;
    }
    const module = await import(`${pathToFileURL(manifestPath).href}?quality-check=${Date.now()}`);
    const manifest = module.default ?? module.manifest;
    for (const field of ["id", "trustClass", "hosts", "capabilities", "requires", "cachePolicy", "quality"]) {
        if (manifest?.[field] === undefined) errors.push(`${entry.name}: missing ${field}`);
    }
    if (!allowedTrustClasses.has(manifest?.trustClass)) errors.push(`${entry.name}: invalid trustClass`);
    if (!allowedQualities.has(manifest?.quality)) errors.push(`${entry.name}: invalid quality`);
    if (!Array.isArray(manifest?.capabilities) || manifest.capabilities.length === 0) errors.push(`${entry.name}: no capabilities`);
    if (manifest?.cachePolicy === undefined) errors.push(`${entry.name}: cachePolicy must be explicit, including none`);
    const parserTest = path.join(rootDir, "tests", "integrations", `${entry.name}.contract.test.js`);
    const fixture = path.join(rootDir, "tests", "fixtures", "integrations", entry.name);
    if (!(await exists(parserTest))) errors.push(`${entry.name}: missing contract test`);
    if (!(await exists(fixture))) errors.push(`${entry.name}: missing fixture directory`);
    if (manifest?.quality === "silver") {
        const malformedTest = path.join(rootDir, "tests", "integrations", `${entry.name}.malformed.test.js`);
        if (!(await exists(malformedTest))) errors.push(`${entry.name}: Silver requires malformed response test`);
    }
}

if (errors.length) {
    errors.forEach((error) => console.error(error));
    throw new Error(`Integration quality gate failed with ${errors.length} error(s)`);
}
console.log(`Integration quality gate passed (${entries.length} integration(s))`);
