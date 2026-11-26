import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildUserscript, repoRoot } from "./build.mjs";
import { createDevTransforms, readDevIdentity } from "./dev-metadata.mjs";
import { sha256, writeFrozenFiles } from "./delivery-artifact.mjs";

export { readDevIdentity };
export async function verifyDevDelivery(path) {
    const bytes = await readFile(path), source = bytes.toString("utf8");
    const identity = readDevIdentity(source);
    const transforms = createDevTransforms(identity.version, identity.buildId);
    const candidate = await buildUserscript({ outputPaths: [], ...transforms, packStaticResources: true });
    const digest = sha256(bytes);
    if (digest !== candidate.analysis.sha256) throw new Error(`Dev 交付与当前源码不一致：${digest} != ${candidate.analysis.sha256}`);
    return { path, ...identity, sha256: digest, bytes: bytes.length };
}
export async function freezeDevCandidate(path) {
    const verified = await verifyDevDelivery(path);
    const folder = resolve(repoRoot, "output/dev-candidates");
    const name = `${verified.sha256}.user.js`, bytes = await readFile(path);
    if (sha256(bytes) !== verified.sha256) throw new Error("交付文件在核验期间发生变化");
    await writeFrozenFiles(folder, { [name]: bytes });
    return { ...verified, path: resolve(folder, name), deliveryPath: path };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    const path = resolve(process.argv.slice(2).find(value => !value.startsWith("--")) || resolve(repoRoot, "JHS-7.0.dev.user.js"));
    console.log(JSON.stringify(await (process.argv.includes("--freeze") ? freezeDevCandidate(path) : verifyDevDelivery(path)), null, 2));
}
