import { createHash } from "node:crypto";

export const RC_NAME = "JHS RC 7.0";
export const RC_NAMESPACE = "https://github.com/Teamper/JHS/rc/7.0";
export const RC_CHANNEL = "https://raw.githubusercontent.com/Teamper/JHS/rc-channel/";
export const RC_SCRIPT = "JHS-7.0.rc.user.js";
export const RC_META = "JHS-7.0.rc.meta.js";
export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
export function rcNumber(version) {
    const match = /^7\.0\.0-rc\.([1-9]\d*)$/.exec(version);
    if (!match || !Number.isSafeInteger(Number(match[1]))) throw new Error("RC version must be 7.0.0-rc.N (positive integer)");
    return Number(match[1]);
}
export function assertNextRc(version, previous) {
    if (rcNumber(version) <= rcNumber(previous)) throw new Error("RC version must increase");
}
export function advertisedRcCommit(output, tag) {
    const refs = new Map(output.trim().split(/\r?\n/).filter(Boolean).map(line => {
        const [sha, ref] = line.split(/\s+/);
        return [ref, sha];
    }));
    const commit = refs.get(`refs/tags/${tag}^{}`) || refs.get(`refs/tags/${tag}`);
    if (!/^[a-f0-9]{40}$/.test(commit || "")) throw new Error("Missing advertised RC tag");
    return commit;
}
export function assertValidatedRcRun(run, jobs, sourceSha) {
    if (run.repository?.full_name !== "Teamper/JHS" || run.head_sha !== sourceSha || run.path !== ".github/workflows/release-rc.yml" || run.event !== "push" || run.status !== "completed") throw new Error("Retry does not reference a completed RC validation for this source");
    for (const name of ["node20", "candidate"]) {
        const matching = jobs.filter(job => job.name === name);
        if (matching.length !== 1 || matching[0].conclusion !== "success") throw new Error(`Required RC validation did not pass: ${name}`);
    }
}
export function rcChecksPassed(results) {
    return ["check", "functional", "visual"].every(name => results.some(result => result.name === name && result.status === 0))
        && results.every(result => ["startup", "serial"].includes(result.name) || result.status === 0);
}
export function createRcTransforms(version, sourceSha) {
    rcNumber(version);
    if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error("RC requires a full clean source SHA");
    return {
        transformMetadata: metadata => metadata.replace(/\r\n/g, "\n")
            .replace(/^\/\/ @name\s+.+$/m, `// @name         ${RC_NAME}`)
            .replace(/^\/\/ @namespace\s+.+$/m, `// @namespace    ${RC_NAMESPACE}`)
            .replace(/^\/\/ @version\s+.+$/m, `// @version      ${version}`)
            .replace(/^\/\/ @description\s+.+$/m, `// @description  JHS 7.0 RC build ${sourceSha}`)
            .replace(/^\/\/ @updateURL\s+.+$/m, `// @updateURL    ${RC_CHANNEL}${RC_META}`)
            .replace(/^\/\/ @downloadURL\s+.+$/m, `// @downloadURL  ${RC_CHANNEL}${RC_SCRIPT}`),
        transformBundle: bundle => `document.documentElement?.setAttribute("data-jhs-rc-build", ${JSON.stringify(`${version}|${sourceSha}`)});\n${bundle}`,
    };
}
export function readRcIdentity(source) {
    const header = source.match(/^\/\/ ==UserScript==\n[\s\S]*?^\/\/ ==\/UserScript==/m)?.[0];
    if (!header || source.includes("\r")) throw new Error("RC metadata must use LF");
    const field = key => {
        const matches = [...header.matchAll(new RegExp(`^// @${key}\\s+(.+)$`, "gm"))];
        if (matches.length !== 1) throw new Error(`Invalid RC @${key}`);
        return matches[0][1];
    };
    const version = field("version"), sourceSha = field("description").match(/^JHS 7\.0 RC build ([a-f0-9]{40})$/)?.[1];
    rcNumber(version);
    if (!sourceSha || field("name") !== RC_NAME || field("namespace") !== RC_NAMESPACE || field("updateURL") !== RC_CHANNEL + RC_META || field("downloadURL") !== RC_CHANNEL + RC_SCRIPT) throw new Error("Invalid RC identity or update channel");
    if (!source.includes(`document.documentElement?.setAttribute("data-jhs-rc-build", ${JSON.stringify(`${version}|${sourceSha}`)});`) || source.includes("data-jhs-dev-build")) throw new Error("Invalid RC runtime marker");
    return { version, sourceSha, buildId: sourceSha };
}
export function rcFiles(source) {
    source = String(source);
    const { version, sourceSha } = readRcIdentity(source);
    const meta = source.slice(0, source.indexOf("// ==/UserScript==") + "// ==/UserScript==".length) + "\n";
    const files = { [RC_SCRIPT]: source, [RC_META]: meta };
    const manifest = { schema: 1, version, sourceSha, packStaticResources: false, files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, { sha256: sha256(bytes), bytes: Buffer.byteLength(bytes) }])) };
    files["release-manifest.json"] = JSON.stringify(manifest, null, 2) + "\n";
    files.SHA256SUMS = Object.entries(files).map(([name, bytes]) => `${sha256(bytes)}  ${name}\n`).join("");
    return { files, manifest };
}
export function validateRcFiles(files) {
    const expected = rcFiles(files[RC_SCRIPT]);
    for (const [name, bytes] of Object.entries(expected.files)) if (!Buffer.from(files[name] ?? "").equals(Buffer.from(bytes))) throw new Error(`RC file mismatch: ${name}`);
    return expected.manifest;
}
