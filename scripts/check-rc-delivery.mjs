import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildUserscript, repoRoot } from "./build.mjs";
import { cleanRcSource, assertRcInputsTracked } from "./build-rc.mjs";
import { createRcTransforms, RC_ARTIFACT_FILES, RC_SCRIPT, validateRcFiles } from "./rc-contract.mjs";
import { sha256, writeFrozenFiles } from "./delivery-artifact.mjs";

async function readRcFiles(folder) {
    return Object.fromEntries(await Promise.all(RC_ARTIFACT_FILES.map(async name => [name, await readFile(join(folder, name))])));
}

export async function verifyRcDelivery(path) {
    const folder = dirname(path);
    if (resolve(path) !== resolve(folder, RC_SCRIPT)) throw new Error("Expected RC script path");
    const files = await readRcFiles(folder);
    const manifest = validateRcFiles(files);
    if (manifest.sourceSha !== cleanRcSource()) throw new Error("RC source SHA differs from checkout");
    const result = await buildUserscript({ outputPaths: [], ...createRcTransforms(manifest.version, manifest.sourceSha), packStaticResources: false });
    assertRcInputsTracked(result.analysis.modules);
    if (!files[RC_SCRIPT].equals(Buffer.from(result.output)) || cleanRcSource() !== manifest.sourceSha) throw new Error("RC differs from rebuilt frozen source");
    return { path, version: manifest.version, buildId: manifest.sourceSha, sourceSha: manifest.sourceSha, sha256: sha256(files[RC_SCRIPT]), bytes: files[RC_SCRIPT].length };
}
export async function freezeRcCandidate(path) {
    const verified = await verifyRcDelivery(path), folder = join(repoRoot, "output/rc-candidates", verified.sha256);
    const files = await readRcFiles(dirname(path));
    validateRcFiles(files);
    if (sha256(files[RC_SCRIPT]) !== verified.sha256 || cleanRcSource() !== verified.sourceSha) throw new Error("RC changed during freeze");
    await writeFrozenFiles(folder, files);
    return { ...verified, path: join(folder, RC_SCRIPT), deliveryPath: path };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) console.log(JSON.stringify(await (process.argv.includes("--freeze") ? freezeRcCandidate : verifyRcDelivery)(resolve(process.argv[2])), null, 2));
