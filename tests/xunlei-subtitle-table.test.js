// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { DetailPageActionsController } from "../src/features/detail/detail-page-actions-controller.js";
import { parseXunleiSubtitles } from "../src/integrations/xunlei/parser.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ""; });

it("gives the subtitle table writable rows without changing frozen integration records", async () => {
    const results = parseXunleiSubtitles({ data: [{ name: "Chinese subtitle", ext: "srt", url: "https://subtitle.example/test.srt" }] });
    const original = { ...results[0] }, close = vi.fn(), open = vi.fn();
    const table = vi.fn(function (_target, options) { this.options = options; });
    vi.stubGlobal("Tabulator", table);
    const controller = new DetailPageActionsController({
        hostAdapter: { document }, scope: new LifecycleScope("subtitle-test"), dialog: { open }, subtitle: { search: vi.fn(async () => results) },
        ui: { loading: () => ({ close }), getResponsiveArea: area => area, setupEscClose: vi.fn() },
        notifications: { error: vi.fn() }, diagnostics: { recordError: vi.fn() },
    });

    await controller.searchXunLeiSubtitle("ABC-123");
    const root = document.createElement("div"); root.innerHTML = open.mock.calls[0][0].content;
    open.mock.calls[0][0].success(root, 1);
    const rows = table.mock.calls[0][1].data;

    expect(rows).toEqual(results);
    expect(rows).not.toBe(results);
    expect(rows[0]).not.toBe(results[0]);
    rows[0].name = "Table-local name";
    expect(rows[0].name).toBe("Table-local name");
    expect(results[0]).toEqual(original);
    expect(Object.isFrozen(results)).toBe(true);
    expect(Object.isFrozen(results[0])).toBe(true);
    expect(close).toHaveBeenCalledOnce();
});
