import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildUserscript, repoRoot } from "./build.mjs";
import { cleanRcSource, assertRcInputsTracked } from "./build-rc.mjs";
import { createRcTransforms, RC_SCRIPT, RC_META, validateRcFiles, sha256 } from "./rc-contract.mjs";

export async function verifyRcDelivery(path) {
    const folder = dirname(path), names = [RC_SCRIPT, RC_META, "release-manifest.json", "SHA256SUMS"];
    const files = Object.fromEntries(await Promise.all(names.map(async name => [name, await readFile(join(folder, name))])));
    if (resolve(path) !== resolve(folder, RC_SCRIPT)) throw new Error("Expected RC script path");
    const manifest = validateRcFiles(files);
    if (manifest.sourceSha !== cleanRcSource()) throw new Error("RC source SHA differs from checkout");
    const result = await buildUserscript({ outputPaths: [], ...createRcTransforms(manifest.version, manifest.sourceSha), packStaticResources: false });
    assertRcInputsTracked(result.analysis.modules);
    if (!files[RC_SCRIPT].equals(Buffer.from(result.output)) || cleanRcSource() !== manifest.sourceSha) throw new Error("RC differs from rebuilt frozen source");
    return { path, version: manifest.version, buildId: manifest.sourceSha, sourceSha: manifest.sourceSha, sha256: sha256(files[RC_SCRIPT]), bytes: files[RC_SCRIPT].length };
}
export async function freezeRcCandidate(path) {
    const verified = await verifyRcDelivery(path), folder = join(repoRoot, "output/rc-candidates", verified.sha256);
    await mkdir(folder, { recursive: true });
    for (const name of [RC_SCRIPT, RC_META, "release-manifest.json", "SHA256SUMS"]) {
        const bytes = await readFile(join(dirname(path), name));
        try { await writeFile(join(folder, name), bytes, { flag: "wx" }); }
        catch (error) { if (error.code !== "EEXIST" || !(await readFile(join(folder, name))).equals(bytes)) throw error; }
    }
    const frozen = await verifyRcDelivery(join(folder, RC_SCRIPT));
    if (frozen.sha256 !== verified.sha256) throw new Error("RC changed during freeze");
    return { ...frozen, deliveryPath: path };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) console.log(JSON.stringify(await (process.argv.includes("--freeze") ? freezeRcCandidate : verifyRcDelivery)(resolve(process.argv[2])), null, 2));
