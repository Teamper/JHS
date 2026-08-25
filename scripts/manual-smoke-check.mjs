import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const REQUIRED_MANUAL_SMOKE_CHECKS = Object.freeze([
    "javdb.list",
    "javdb.detail",
    "javbus.list",
    "javbus.detail",
    "fc2.ownedDetail",
    "mobile.realViewport",
    "settings.crossTabSync",
    "fc2.autopagePage2",
    "dialog.layeredBlacklistSettingsWebdav",
    "plugin.disabledNewVideo",
    "plugin.disabledBlacklist",
    "cloud.115",
    "cloud.123",
]);

/** Placeholder version strings that can never count as a real human-verified environment. */
export const PLACEHOLDER_VERSIONS = Object.freeze([ "release", "latest", "unknown" ]);

function assert(condition, message) {
    if (!condition) throw new Error(`Manual smoke gate failed: ${message}`);
}

export function isVersionAtLeast(version, minimum) {
    const parse = (value) => String(value).split(".").map((part) => Number(part));
    const left = parse(version), right = parse(minimum);
    for (let index = 0; index < Math.max(left.length, right.length); index++) {
        const difference = (left[index] || 0) - (right[index] || 0);
        if (difference) return difference > 0;
    }
    return true;
}

/** @param {Buffer | string} value */
export function sha256(value) {
    return createHash("sha256").update(value).digest("hex");
}

/**
 * Validate a human-created Tampermonkey smoke record against the exact built artifact.
 * @param {unknown} value
 * @param {{ version: string, artifactSha256: string }} expected
 */
export function validateManualSmokeRecord(value, expected) {
    const record = value && "object" === typeof value ? /** @type {Record<string, any>} */ (value) : {};
    assert(record.version === expected.version, `record version must equal ${expected.version}`);
    assert(Number.isFinite(Date.parse(record.testedAt)), "testedAt must be an ISO date-time");
    assert(record.humanVerified === true, "humanVerified must be true: only a real human-verified Tampermonkey record counts");
    assert("string" === typeof record.tester && record.tester.trim().length > 0, "tester is required");
    assert(!/bot/i.test(String(record.tester)), "tester must be a human, not a bot or placeholder");
    assert(["msedge", "chrome"].includes(record.browser?.channel), "browser.channel must be msedge or chrome");
    assert("string" === typeof record.browser?.version && record.browser.version.trim().length > 0, "browser.version is required");
    assert(!PLACEHOLDER_VERSIONS.includes(String(record.browser.version).trim().toLowerCase()), "browser.version must be a real version, not release/latest/unknown");
    assert("tampermonkey" === String(record.userscriptManager?.name || "").toLowerCase(), "userscriptManager.name must be Tampermonkey");
    assert("string" === typeof record.userscriptManager?.version && record.userscriptManager.version.trim().length > 0, "userscriptManager.version is required");
    assert(!PLACEHOLDER_VERSIONS.includes(String(record.userscriptManager.version).trim().toLowerCase()), "userscriptManager.version must be a real version, not release/latest/unknown");
    assert(record.artifact?.sha256 === expected.artifactSha256, "artifact.sha256 must match JHS.user.js");
    for (const check of REQUIRED_MANUAL_SMOKE_CHECKS) assert(record.checks?.[check] === true, `checks.${check} must be true`);
    return record;
}

async function main() {
    const args = new Set(process.argv.slice(2));
    const packageJson = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"));
    const required = args.has("--require") || isVersionAtLeast(packageJson.version, "6.5.0");
    if (!required) {
        console.log(`Manual Tampermonkey smoke gate skipped for ${packageJson.version}; required from 6.5.0`);
        return;
    }
    const recordArgIndex = process.argv.indexOf("--record");
    const recordPath = recordArgIndex >= 0
        ? path.resolve(process.argv[recordArgIndex + 1] || "")
        : path.join(rootDir, "docs", "release", `manual-smoke-v${packageJson.version}.json`);
    const artifact = await readFile(path.join(rootDir, "JHS.user.js"));
    const record = JSON.parse(await readFile(recordPath, "utf8"));
    validateManualSmokeRecord(record, { version: packageJson.version, artifactSha256: sha256(artifact) });
    console.log(`Manual Tampermonkey smoke gate passed for ${packageJson.version}: ${path.relative(rootDir, recordPath)}`);
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || "")) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
