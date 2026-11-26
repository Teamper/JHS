import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

export async function readFileHash(file) {
    try { return sha256(await readFile(file)); }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

export function readMetadataField(header, key, channel) {
    const matches = [...header.matchAll(new RegExp(`^// @${key}[ \\t]+([^\\r\\n]+)\\r?$`, "gm"))];
    if (matches.length !== 1) throw new Error(`Invalid ${channel} @${key}`);
    return matches[0][1];
}

export function replaceMetadataFields(metadata, fields) {
    for (const [key, value] of Object.entries(fields)) {
        metadata = metadata.replace(new RegExp(`^// @${key}[ \\t]+[^\\r\\n]+(?=\\r?$)`, "m"),
            () => `// @${key.padEnd(13)}${value}`);
    }
    return metadata;
}

export function runtimeBuildMarker(channel, version, buildId) {
    return `document.documentElement?.setAttribute("data-jhs-${channel}-build", ${JSON.stringify(`${version}|${buildId}`)});`;
}

export async function writeFrozenFiles(folder, files) {
    await mkdir(folder, { recursive: true });
    for (const [name, value] of Object.entries(files)) {
        const file = join(folder, name), bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
        try { await writeFile(file, bytes, { flag: "wx" }); }
        catch (error) { if (error.code !== "EEXIST" || !(await readFile(file)).equals(bytes)) throw error; }
    }
}
