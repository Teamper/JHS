import { getNowStr, formatDate, getHourDifference } from "../src/core/ui-date-time.js";
import { isUrl, getUrlParam } from "../src/core/url-parameters.js";
import { genericSort } from "../src/core/collection-sort.js";
import { waitForDom } from "../src/core/dom-actions.js";
import { debounce } from "../src/core/timing.js";
import { afterEach, describe, it, expect, vi } from 'vitest';

function loadUtilsWithObserver() {
    let observer = null;
    class FakeMutationObserver {
        constructor(callback) { this.callback = callback; this.disconnected = false; observer = this; }
        observe() {}
        disconnect() { this.disconnected = true; }
        emit() { this.callback([]); }
    }
    vi.stubGlobal("document", { documentElement: {} });
    const scope = {
        observe(target, callback, options) { const value = new FakeMutationObserver(callback); value.observe(target, options); return value; },
        releaseObserver(value) { value.disconnect(); },
    };
    return { getObserver: () => observer, scope };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('getNowStr', () => {
    it('should format a given date with default separators', () => {
        // Use a fixed date: 2026-01-15 14:30:45
        const result = getNowStr("-", ":", "2026-01-15T14:30:45");
        expect(result).toMatch(/2026-01-15 14:30:45/);
    });

    it('should format with custom separators', () => {
        const result = getNowStr("/", " ", "2026-01-15T14:30:45");
        expect(result).toMatch(/2026\/01\/15 14 30 45/);
    });
});

describe('formatDate', () => {
    it('should format a Date object', () => {
        const d = new Date(2026, 0, 15, 14, 30, 45); // Jan 15 2026 14:30:45
        expect(formatDate(d)).toBe("2026-01-15 14:30:45");
    });

    it('should format a date string', () => {
        expect(formatDate("2026-06-01T12:00:00")).toMatch(/2026-06-01 12:00:00/);
    });

    it('should throw on invalid input type', () => {
        expect(() => formatDate(12345)).toThrow("Invalid date input");
    });

    it('should throw on invalid date string', () => {
        expect(() => formatDate("not-a-date")).toThrow("Invalid date string");
    });
});

describe('getHourDifference', () => {
    it('should return 0 for same time', () => {
        const d = new Date("2026-01-15T14:00:00");
        expect(getHourDifference(d, d)).toBe(0);
    });

    it('should return 24 for one day apart', () => {
        const d1 = new Date("2026-01-15T14:00:00");
        const d2 = new Date("2026-01-16T14:00:00");
        expect(getHourDifference(d1, d2)).toBe(24);
    });

    it('should handle reversed order (absolute value)', () => {
        const d1 = new Date("2026-01-16T14:00:00");
        const d2 = new Date("2026-01-15T14:00:00");
        expect(getHourDifference(d1, d2)).toBe(24);
    });

    it('should floor partial hours', () => {
        const d1 = new Date("2026-01-15T14:00:00");
        const d2 = new Date("2026-01-15T15:30:00");
        expect(getHourDifference(d1, d2)).toBe(1);
    });
});

describe('isUrl', () => {
    it('should return true for valid URLs', () => {
        expect(isUrl("https://example.com")).toBe(true);
        expect(isUrl("http://localhost:3000/path")).toBe(true);
        expect(isUrl("ftp://files.example.com")).toBe(true);
    });

    it('should return false for invalid URLs', () => {
        expect(isUrl("not a url")).toBe(false);
        expect(isUrl("")).toBe(false);
        expect(isUrl("javascript:alert(1)")).toBe(true); // URL constructor accepts this
    });
});

describe('getUrlParam', () => {
    it('should extract string params', () => {
        expect(getUrlParam("https://example.com?name=hello", "name")).toBe("hello");
    });

    it('should extract numeric params as numbers', () => {
        expect(getUrlParam("https://example.com?page=5", "page")).toBe(5);
    });

    it('should extract boolean params', () => {
        expect(getUrlParam("https://example.com?debug=true", "debug")).toBe(true);
        expect(getUrlParam("https://example.com?debug=false", "debug")).toBe(false);
    });

    it('should return empty string for missing params', () => {
        expect(getUrlParam("https://example.com?other=1", "missing")).toBe("");
    });

    it('should return null for URLs without query string', () => {
        expect(getUrlParam("https://example.com", "param")).toBe(null);
    });

    it('should handle URL-encoded values', () => {
        expect(getUrlParam("https://example.com?q=hello+world", "q")).toBe("hello world");
        expect(getUrlParam("https://example.com?q=%E4%BD%A0%E5%A5%BD", "q")).toBe("你好");
    });
});

describe('genericSort', () => {
    it('should sort by string field ascending', () => {
        const items = [{ name: 'Charlie' }, { name: 'Alice' }, { name: 'Bob' }];
        const result = genericSort(items, [{ key: 'name', order: 'asc' }]);
        expect(result.map(i => i.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('should sort by string field descending', () => {
        const items = [{ name: 'Charlie' }, { name: 'Alice' }, { name: 'Bob' }];
        const result = genericSort(items, [{ key: 'name', order: 'desc' }]);
        expect(result.map(i => i.name)).toEqual(['Charlie', 'Bob', 'Alice']);
    });

    it('should sort by numeric field', () => {
        const items = [{ val: 3 }, { val: 1 }, { val: 2 }];
        const result = genericSort(items, [{ key: 'val' }]);
        expect(result.map(i => i.val)).toEqual([1, 2, 3]);
    });

    it('should sort by multiple keys', () => {
        const items = [
            { type: 'A', val: 2 },
            { type: 'B', val: 1 },
            { type: 'A', val: 1 },
        ];
        const result = genericSort(items, [
            { key: 'type', order: 'asc' },
            { key: 'val', order: 'asc' },
        ]);
        expect(result.map(i => `${i.type}-${i.val}`)).toEqual(['A-1', 'A-2', 'B-1']);
    });

    it('should push null values to the end with nullsLast', () => {
        const items = [{ val: 3 }, { val: null }, { val: 1 }, { val: 2 }];
        const result = genericSort(items, [{ key: 'val' }], true);
        // null should be last
        expect(result[result.length - 1].val).toBe(null);
        // non-null items should be sorted ascending
        const nonNull = result.filter(i => i.val !== null);
        expect(nonNull.map(i => i.val)).toEqual([1, 2, 3]);
    });

    it('should sort non-null items correctly', () => {
        const items = [{ val: 3 }, { val: 1 }, { val: 2 }];
        const result = genericSort(items, [{ key: 'val' }]);
        expect(result.map(i => i.val)).toEqual([1, 2, 3]);
    });

    it('should sort dates as strings', () => {
        const items = [
            { date: '2026-01-15' },
            { date: '2026-01-10' },
            { date: '2026-01-20' },
        ];
        const result = genericSort(items, [{ key: 'date' }]);
        expect(result.map(i => i.date)).toEqual(['2026-01-10', '2026-01-15', '2026-01-20']);
    });

    it('should use function key accessor', () => {
        const items = [{ name: 'Charlie' }, { name: 'Alice' }];
        const result = genericSort(items, [{ key: item => item.name }]);
        expect(result.map(i => i.name)).toEqual(['Alice', 'Charlie']);
    });

    it('should return empty array for empty input', () => {
        expect(genericSort([], [{ key: 'name' }])).toEqual([]);
    });

    it('should return copy for empty sort rules', () => {
        const items = [{ name: 'A' }];
        const result = genericSort(items, []);
        expect(result).toEqual(items);
        expect(result).not.toBe(items); // should be a copy
    });

    it('should not mutate original array', () => {
        const items = [{ val: 3 }, { val: 1 }];
        genericSort(items, [{ key: 'val' }]);
        expect(items[0].val).toBe(3);
    });
});

describe("loopDetector", () => {
    it("resolves immediately without creating a polling interval", () => {
        const intervalSpy = vi.spyOn(globalThis, "setInterval"), callback = vi.fn(), { getObserver } = loadUtilsWithObserver();
        waitForDom(() => true, callback, 1, 1e4, false);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(getObserver()).toBeNull();
        expect(intervalSpy).not.toHaveBeenCalled();
        intervalSpy.mockRestore();
    });

    it("reacts to DOM mutation and cleans up its observer", () => {
        vi.useFakeTimers();
        let ready = false;
        const callback = vi.fn(), { getObserver, scope } = loadUtilsWithObserver();
        waitForDom(() => ready, callback, 20, 1e4, false, scope);
        ready = true, getObserver().emit(), vi.advanceTimersByTime(20);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(getObserver().disconnected).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("honors a timeout without invoking a disabled timeout callback", () => {
        vi.useFakeTimers();
        const callback = vi.fn(), { getObserver, scope } = loadUtilsWithObserver();
        waitForDom(() => false, callback, 1, 50, false, scope), vi.advanceTimersByTime(50);
        expect(callback).not.toHaveBeenCalled();
        expect(getObserver().disconnected).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("supports lifecycle cancellation before the condition becomes ready", () => {
        vi.useFakeTimers();
        let ready = false;
        const callback = vi.fn(), { getObserver, scope } = loadUtilsWithObserver(), cancel = waitForDom(() => ready, callback, 20, 1e4, false, scope);
        cancel(), ready = true, getObserver().emit(), vi.advanceTimersByTime(20);
        expect(callback).not.toHaveBeenCalled();
        expect(getObserver().disconnected).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe("debounce", () => {
    it("coalesces rapid calls and supports lifecycle cancellation", () => {
        vi.useFakeTimers();
        const callback = vi.fn(), debounced = debounce(callback, 200);
        debounced("first"), debounced("last"), vi.advanceTimersByTime(199);
        expect(callback).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(callback).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenLastCalledWith("last");
        debounced("cancelled"), debounced.cancel(), vi.advanceTimersByTime(200);
        expect(callback).toHaveBeenCalledOnce();
    });
});
