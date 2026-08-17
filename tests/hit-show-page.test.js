import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/core/site-context.js"), "utf8");
const context = vm.createContext({ URL });
vm.runInContext(`${source};globalThis.helpers={isHitShowPage,isNormalListPage,isListPage}`, context);

describe("hit-show page detection", () => {
    const { isHitShowPage, isNormalListPage, isListPage } = context.helpers;

    it.each([
        "https://javdb.com/advanced_search?handlePlayback=1&period=daily",
        "https://javdb.com/advanced_search?handlePlayback=1&period=weekly"
    ])("recognizes playback rankings: %s", href => {
        expect(isHitShowPage(href)).toBe(true);
        expect(isNormalListPage(href, true)).toBe(false);
        expect(isListPage(href, false)).toBe(true);
    });

    it.each([
        "https://javdb.com/advanced_search?period=daily",
        "https://javdb.com/advanced_search?type=1"
    ])("keeps normal advanced search separate: %s", href => {
        expect(isHitShowPage(href)).toBe(false);
        expect(isNormalListPage(href, false)).toBe(true);
    });
});
