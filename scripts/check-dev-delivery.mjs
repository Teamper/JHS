import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildUserscript, repoRoot } from "./build.mjs";
import { createDevTransforms } from "./dev-metadata.mjs";

export function readDevIdentity(source) {
    const version = source.match(/^\/\/ @version\s+(7\.0\.0-dev\.\d{12})\s*$/m)?.[1];
    const buildId = source.match(/^\/\/ @description\s+JHS 7\.0 migration build ([a-f0-9]{12}(?:\.dirty)?)\s*$/m)?.[1];
    if (!version || !buildId || !source.includes(JSON.stringify(`${version}|${buildId}`))) throw new Error("交付文件缺少有效 Dev 身份");
    return { version, buildId };
}
export async function verifyDevDelivery(path) {
    const bytes = await readFile(path), source = bytes.toString("utf8");
    const identity = readDevIdentity(source);
    const transforms = createDevTransforms(identity.version, identity.buildId);
    const candidate = await buildUserscript({ outputPaths: [], ...transforms, packStaticResources: false });
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== candidate.analysis.sha256) throw new Error(`Dev 交付与当前源码不一致：${sha256} != ${candidate.analysis.sha256}`);
    return { path, ...identity, sha256, bytes: bytes.length };
}
export async function freezeDevCandidate(path) {
    const verified = await verifyDevDelivery(path);
    const folder = resolve(repoRoot, "output/dev-candidates");
    await mkdir(folder, { recursive: true });
    const frozen = resolve(folder, `${verified.sha256}.user.js`), bytes = await readFile(path);
    if (createHash("sha256").update(bytes).digest("hex") !== verified.sha256) throw new Error("交付文件在核验期间发生变化");
    try { await writeFile(frozen, bytes, { flag: "wx" }); }
    catch (error) { if (error.code !== "EEXIST" || !(await readFile(frozen)).equals(bytes)) throw error; }
    return { ...verified, path: frozen, deliveryPath: path };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    const path = resolve(process.argv.slice(2).find(value => !value.startsWith("--")) || resolve(repoRoot, "JHS-7.0.dev.user.js"));
    console.log(JSON.stringify(await (process.argv.includes("--freeze") ? freezeDevCandidate(path) : verifyDevDelivery(path)), null, 2));
}
