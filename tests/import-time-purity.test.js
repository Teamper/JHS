import { describe, expect, it } from "vitest";
import { scanImportTimeEffects } from "../scripts/import-time-purity.mjs";

describe("import-time purity scanner", () => {
    it.each([
        ["document.body.append(root);", "document.body.append(root)"],
        ["const timer = setTimeout(start, 0);", "setTimeout(start, 0)"],
        ["window.addEventListener('resize', refresh);", "window.addEventListener('resize', refresh)"],
        ["export const href = window.location.href;", "window.location.href"],
        ["const cached = localStorage.getItem('settings');", "localStorage.getItem('settings')"],
        ["const observer = new MutationObserver(refresh);", "new MutationObserver(refresh)"],
        ["globalThis.runtime = createRuntime();", "globalThis.runtime = createRuntime()"],
        ["(() => document.head.append(style))();", "document.head.append(style)"]
    ])("rejects module-level effect: %s", (source, effect) => {
        expect(scanImportTimeEffects(source)).toEqual([
            expect.objectContaining({ line: 1, effect })
        ]);
    });

    it.each([
        "export function start() { document.body.append(root); }",
        "export const start = () => document.body.append(root);",
        "const manifest = { activate: async () => gmHttp.get('/movie') };",
        "class Feature { activate() { window.addEventListener('resize', refresh); } }"
    ])("allows effects deferred behind an explicit lifecycle: %s", (source) => {
        expect(scanImportTimeEffects(source)).toEqual([]);
    });
});
