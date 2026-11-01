import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const NOTE_SECTIONS = ["新增", "修复", "改进", "升级说明", "致谢"];
export function parseNotesVersion(version) {
    const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(version || "");
    if (!match || match.slice(1, 4).some(value => !Number.isSafeInteger(Number(value)))) throw new Error("Invalid release notes version");
    const pre = match[4]?.split(".") || [];
    if (pre.some(value => /^\d+$/.test(value) && (!Number.isSafeInteger(Number(value)) || /^0\d/.test(value)))) throw new Error("Invalid prerelease identifier");
    return { core: match.slice(1, 4).map(Number), pre };
}
export function compareNotesVersions(left, right) {
    const a = parseNotesVersion(left), b = parseNotesVersion(right);
    for (let i = 0; i < 3; i++) if (a.core[i] !== b.core[i]) return a.core[i] > b.core[i] ? 1 : -1;
    if (!a.pre.length || !b.pre.length) return Number(!a.pre.length) - Number(!b.pre.length);
    for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
        if (a.pre[i] === undefined || b.pre[i] === undefined) return a.pre[i] === undefined ? -1 : 1;
        if (a.pre[i] === b.pre[i]) continue;
        const an = /^\d+$/.test(a.pre[i]), bn = /^\d+$/.test(b.pre[i]);
        if (an !== bn) return an ? -1 : 1;
        return an ? Math.sign(Number(a.pre[i]) - Number(b.pre[i])) : (a.pre[i] > b.pre[i] ? 1 : -1);
    }
    return 0;
}
export function validateReleaseNotes(source, version) {
    parseNotesVersion(version);
    const body = source.replace(/\r\n/g, "\n");
    if (/\{\{[\s\S]*?\}\}|\bTODO\b|\bTBD\b|待填写|<填写[^>]*>/i.test(body)) throw new Error("Unresolved release notes placeholder");
    let fence = null;
    const visible = body.split("\n").map(line => {
        const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
        if (marker) { if (!fence) fence = marker; else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null; return ""; }
        return fence ? "" : line;
    }).join("\n");
    const titles = [...visible.matchAll(/^# (.+)$/gm)];
    if (titles.length !== 1 || titles[0][1] !== `JHS ${version}` || !visible.startsWith(`# JHS ${version}\n`)) throw new Error("Release notes title/version mismatch");
    const sections = [...visible.matchAll(/^## (.+)$/gm)];
    if (!sections.length || !visible.slice(titles[0][0].length, sections[0].index).trim()) throw new Error("Missing release summary");
    let previous = -1;
    for (let i = 0; i < sections.length; i++) {
        const section = sections[i], index = NOTE_SECTIONS.indexOf(section[1]);
        if (index < 0 || index <= previous) throw new Error("Unknown, duplicate or out-of-order release section");
        previous = index;
        const content = visible.slice(section.index + section[0].length, sections[i + 1]?.index).replace(/^### .+$/gm, "").replace(/^\s*---+\s*$/gm, "").trim();
        if (!content || /^(?:[-*]\s*)?(?:无|暂无|无更新)[。.!！]?$/.test(content)) throw new Error(`Empty release section: ${section[1]}`);
    }
    if (!sections.some(section => NOTE_SECTIONS.indexOf(section[1]) < 3)) throw new Error("Missing product changes");
    return body;
}
export async function readReleaseNotes(root, version, { required = true, fallback } = {}) {
    parseNotesVersion(version);
    try { return validateReleaseNotes(await readFile(join(root, "release-notes", `${version}.md`), "utf8"), version); }
    catch (error) {
        if (error.code === "ENOENT" && !required && typeof fallback === "string") return fallback;
        throw error;
    }
}
export function chooseNotesBase(tags, version) {
    const target = parseNotesVersion(version);
    const candidates = tags.map(tag => ({ tag, version: tag.replace(/^v/, "") })).filter(item => {
        try { parseNotesVersion(item.version); return compareNotesVersions(item.version, version) < 0; } catch { return false; }
    });
    const prior = target.pre.length ? candidates.filter(item => {
        const parsed = parseNotesVersion(item.version);
        return parsed.core.join(".") === target.core.join(".") && parsed.pre[0] === target.pre[0];
    }) : [];
    const eligible = prior.length ? prior : candidates.filter(item => !parseNotesVersion(item.version).pre.length);
    eligible.sort((a, b) => compareNotesVersions(b.version, a.version));
    if (!eligible.length) throw new Error("No comparable ancestor release tag; specify --base");
    return eligible[0].tag;
}
