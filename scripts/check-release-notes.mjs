import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseNotesVersion, readReleaseNotes } from "./release-notes.mjs";

export async function checkNotes(root, requested) {
    const versions = requested ? [requested] : (await readdir(resolve(root, "release-notes"))).filter(name => {
        try { return name.endsWith(".md") && !!parseNotesVersion(name.slice(0, -3)); } catch { return false; }
    }).map(name => name.slice(0, -3));
    for (const version of versions) await readReleaseNotes(root, version);
    return versions;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
    console.log(`Release notes checked: ${(await checkNotes(root, process.argv[2])).join(", ")}`);
}
