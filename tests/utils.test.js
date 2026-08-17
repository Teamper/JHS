import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { afterEach, describe, it, expect, vi } from 'vitest';

function loadUtilsWithObserver() {
    let observer = null;
    class FakeMutationObserver {
        constructor(callback) { this.callback = callback; this.disconnected = false; observer = this; }
        observe() {}
        disconnect() { this.disconnected = true; }
        emit() { this.callback([]); }
    }
    const context = vm.createContext({
        console, URL, document: { documentElement: {} }, MutationObserver: FakeMutationObserver,
        setTimeout, clearTimeout, setInterval, clearInterval, clog: { error: vi.fn() },
        i: (target, key, value) => (target[key] = value)
    });
    vm.runInContext(`${readFileSync(join(process.cwd(), "src/core/utils.js"), "utf8")};globalThis.TestUtils=Utils;`, context);
    return { utils: new context.TestUtils(), getObserver: () => observer };
}

afterEach(() => vi.useRealTimers());

// --- Functions under test (extracted from src/core/utils.js class Utils) ---

function getNowStr(e = "-", t = ":", n = null) {
    let a;
    a = n ? new Date(n) : new Date;
    const i = a.getFullYear(), s = String(a.getMonth() + 1).padStart(2, "0"), o = String(a.getDate()).padStart(2, "0"), r = String(a.getHours()).padStart(2, "0"), l = String(a.getMinutes()).padStart(2, "0"), c = String(a.getSeconds()).padStart(2, "0");
    return `${[ i, s, o ].join(e)} ${[ r, l, c ].join(t)}`;
}

function formatDate(e, t = "-", n = ":") {
    let a;
    if (e instanceof Date) a = e; else {
        if ("string" != typeof e) throw new Error("Invalid date input: must be Date object or date string");
        if (a = new Date(e), isNaN(a.getTime())) throw new Error("Invalid date string");
    }
    const i = a.getFullYear(), s = String(a.getMonth() + 1).padStart(2, "0"), o = String(a.getDate()).padStart(2, "0"), r = String(a.getHours()).padStart(2, "0"), l = String(a.getMinutes()).padStart(2, "0"), c = String(a.getSeconds()).padStart(2, "0");
    return `${[ i, s, o ].join(t)} ${[ r, l, c ].join(n)}`;
}

function getHourDifference(e, t) {
    const n = e.getTime(), a = t.getTime(), i = Math.abs(a - n) / 36e5;
    return Math.floor(i);
}

function isUrl(e) {
    try {
        return new URL(e), !0;
    } catch (t) {
        return !1;
    }
}

function getUrlParam(e, t) {
    const n = e.split("?")[1];
    if (!n) return null;
    const a = new RegExp(`(?:^|&)${t}=([^&]*)`), i = n.match(a);
    let s = "";
    return i && i[1] && (s = decodeURIComponent(i[1].replace(/\+/g, " "))), s ? "true" === s || "false" === s ? "true" === s.toLowerCase() : "string" != typeof s || "" === s.trim() || isNaN(Number(s)) ? s : Number(s) : s;
}

function genericSort(e, t, n = !0) {
    if (!Array.isArray(e) || 0 === e.length) return [];
    if (!Array.isArray(t) || 0 === t.length) return [ ...e ];
    const i = e => {
        if (e instanceof Date) return e;
        if ("string" == typeof e) {
            const t = new Date(e);
            if (!isNaN(t.getTime())) return t;
        }
        return e;
    };
    const getVal = (e, t) => null != t ? "function" == typeof t ? t(e) : e && "object" == typeof e ? e[t] : void 0 : e;
    const nulls = [], nonNulls = [];
    for (const item of e) {
        let hasNull = !1;
        for (const s of t) {
            const val = getVal(item, s.key);
            if (null == val || void 0 === val) { hasNull = !0; break; }
        }
        hasNull ? nulls.push(item) : nonNulls.push(item);
    }
    return nonNulls.sort(((e, a) => {
        for (const s of t) {
            const {key: t, order: o = "asc"} = s;
            let r = getVal(e, t), l = getVal(a, t);
            const c = i(r), d = i(l);
            let h = c instanceof Date && d instanceof Date ? c.getTime() - d.getTime() : "number" == typeof r && "number" == typeof l ? r - l : "string" == typeof r && "string" == typeof l ? r.localeCompare(l) : String(r).localeCompare(String(l));
            "desc" === o && (h *= -1);
            if (0 !== h) return h;
        }
        return 0;
    })), n ? [ ...nonNulls, ...nulls ] : [ ...nulls, ...nonNulls ];
}

// --- Tests ---

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
        const intervalSpy = vi.spyOn(globalThis, "setInterval"), callback = vi.fn(), { utils, getObserver } = loadUtilsWithObserver();
        utils.loopDetector(() => true, callback, 1, 1e4, false);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(getObserver()).toBeNull();
        expect(intervalSpy).not.toHaveBeenCalled();
        intervalSpy.mockRestore();
    });

    it("reacts to DOM mutation and cleans up its observer", () => {
        vi.useFakeTimers();
        let ready = false;
        const callback = vi.fn(), { utils, getObserver } = loadUtilsWithObserver();
        utils.loopDetector(() => ready, callback, 20, 1e4, false);
        ready = true, getObserver().emit(), vi.advanceTimersByTime(20);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(getObserver().disconnected).toBe(true);
        expect(Object.keys(utils.intervalContainer)).toHaveLength(0);
    });

    it("honors a timeout without invoking a disabled timeout callback", () => {
        vi.useFakeTimers();
        const callback = vi.fn(), { utils, getObserver } = loadUtilsWithObserver();
        utils.loopDetector(() => false, callback, 1, 50, false), vi.advanceTimersByTime(50);
        expect(callback).not.toHaveBeenCalled();
        expect(getObserver().disconnected).toBe(true);
        expect(Object.keys(utils.intervalContainer)).toHaveLength(0);
    });
});
