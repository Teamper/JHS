import { describe, it, expect } from 'vitest';

// --- Functions under test (extracted from src/core/storage.js class StorageManager) ---

function stableStringify(e) {
    if (null === e || "object" != typeof e) return JSON.stringify(e);
    if (Array.isArray(e)) return "[" + e.map((e => stableStringify(e))).join(",") + "]";
    return "{" + Object.keys(e).sort().map((t => JSON.stringify(t) + ":" + stableStringify(e[t]))).join(",") + "}";
}

function getArrayKey(e) {
    return "car_list" === e || "blacklist_car_list" === e ? "carNum" : "blacklist" === e || "favorite_actresses" === e ? "starId" : null;
}

function diffObjects(e, t) {
    const n = new Set([ ...Object.keys(e), ...Object.keys(t) ]), a = {};
    let i = 0;
    for (const s of n) {
        const o = e[s], r = t[s];
        stableStringify(o) !== stableStringify(r) && (a[s] = [ o, r ], i++);
    }
    return { status: 0 === i ? "unchanged" : "modified", changes: a };
}

function diffArrays(e, t, n) {
    const a = getArrayKey(n);
    if (!a) {
        const n = stableStringify(e), i = stableStringify(t);
        if (n === i) return { status: "unchanged", added: [], removed: [], modified: [] };
        const s = new Set(e.map((e => stableStringify(e)))), o = new Set(t.map((e => stableStringify(e))));
        return { status: "modified", added: t.filter((e => !s.has(stableStringify(e)))), removed: e.filter((e => !o.has(stableStringify(e)))), modified: [] };
    }
    const i = new Map(e.map((e => [ e[a], e ]))), s = new Map(t.map((e => [ e[a], e ]))), o = [], r = [], l = [];
    for (const [c, d] of s) {
        const t = i.get(c);
        if (!t) o.push(d); else {
            const e = diffObjects(t, d);
            "unchanged" !== e.status && l.push({ key: c, changes: e.changes });
        }
    }
    for (const [c] of i) s.has(c) || r.push(e.find((e => e[a] === c)));
    return { status: 0 === o.length && 0 === r.length && 0 === l.length ? "unchanged" : "modified", added: o, removed: r, modified: l };
}

function diffData(e, t) {
    const n = new Set([ ...Object.keys(e), ...Object.keys(t) ]), a = {}, i = { added: 0, removed: 0, modified: 0, unchanged: 0 };
    for (const o of n) {
        const r = e[o], l = t[o];
        if (void 0 === r) { a[o] = { status: "added", oldCount: 0, newCount: Array.isArray(l) ? l.length : Object.keys(l || {}).length, added: Array.isArray(l) ? l : [], removed: [], modified: [] }; i.added++; }
        else if (void 0 === l) { a[o] = { status: "removed", oldCount: Array.isArray(r) ? r.length : Object.keys(r).length, newCount: 0, added: [], removed: Array.isArray(r) ? r : [], modified: [] }; i.removed++; }
        else if (Array.isArray(r) && Array.isArray(l)) {
            const e = diffArrays(r, l, o);
            a[o] = { status: e.status, oldCount: r.length, newCount: l.length, ...e }, i[e.status]++;
        } else if ("object" == typeof r && "object" == typeof l && !Array.isArray(r) && !Array.isArray(l)) {
            const e = diffObjects(r, l);
            a[o] = { status: e.status, oldCount: Object.keys(r).length, newCount: Object.keys(l).length, added: [], removed: [], modified: e.changes }, i[e.status]++;
        } else { a[o] = { status: stableStringify(r) === stableStringify(l) ? "unchanged" : "modified" }; i[a[o].status]++; }
    }
    return { summary: i, stores: a };
}

function getSettingSync(key, defaultVal, cacheSettingObj) {
    if (!cacheSettingObj) return defaultVal;
    const n = cacheSettingObj[key];
    if (void 0 === n || null === n) return defaultVal;
    if ("string" == typeof n) {
        if ("true" === n.toLowerCase()) return true;
        if ("false" === n.toLowerCase()) return false;
        if ("" !== n.trim() && !isNaN(Number(n))) return Number(n);
    }
    return n;
}

// --- Tests ---

describe('stableStringify', () => {
    it('should stringify primitives', () => {
        expect(stableStringify(42)).toBe('42');
        expect(stableStringify("hello")).toBe('"hello"');
        expect(stableStringify(true)).toBe('true');
        expect(stableStringify(null)).toBe('null');
    });

    it('should sort object keys deterministically', () => {
        const obj = { z: 1, a: 2, m: 3 };
        expect(stableStringify(obj)).toBe('{"a":2,"m":3,"z":1}');
    });

    it('should handle nested objects with sorted keys', () => {
        const obj = { b: { z: 1, a: 2 }, a: 1 };
        expect(stableStringify(obj)).toBe('{"a":1,"b":{"a":2,"z":1}}');
    });

    it('should handle arrays', () => {
        expect(stableStringify([3, 1, 2])).toBe('[3,1,2]');
    });

    it('should handle arrays of objects', () => {
        const arr = [{ b: 2, a: 1 }];
        expect(stableStringify(arr)).toBe('[{"a":1,"b":2}]');
    });

    it('should produce identical output for equivalent objects with different key order', () => {
        const a = { z: 1, a: 2 };
        const b = { a: 2, z: 1 };
        expect(stableStringify(a)).toBe(stableStringify(b));
    });
});

describe('diffObjects', () => {
    it('should return unchanged for identical objects', () => {
        const result = diffObjects({ a: 1, b: 2 }, { a: 1, b: 2 });
        expect(result.status).toBe('unchanged');
        expect(Object.keys(result.changes).length).toBe(0);
    });

    it('should detect modified fields', () => {
        const result = diffObjects({ a: 1, b: 2 }, { a: 1, b: 3 });
        expect(result.status).toBe('modified');
        expect(result.changes.b).toEqual([2, 3]);
    });

    it('should detect added fields', () => {
        const result = diffObjects({ a: 1 }, { a: 1, b: 2 });
        expect(result.status).toBe('modified');
        expect(result.changes.b).toEqual([undefined, 2]);
    });

    it('should detect removed fields', () => {
        const result = diffObjects({ a: 1, b: 2 }, { a: 1 });
        expect(result.status).toBe('modified');
        expect(result.changes.b).toEqual([2, undefined]);
    });
});

describe('diffArrays', () => {
    it('should return unchanged for identical arrays (no key)', () => {
        const result = diffArrays([1, 2, 3], [1, 2, 3], 'unknown_store');
        expect(result.status).toBe('unchanged');
    });

    it('should detect added items (no key)', () => {
        const result = diffArrays([1, 2], [1, 2, 3], 'unknown_store');
        expect(result.status).toBe('modified');
        expect(result.added).toEqual([3]);
    });

    it('should detect removed items (no key)', () => {
        const result = diffArrays([1, 2, 3], [1, 2], 'unknown_store');
        expect(result.status).toBe('modified');
        expect(result.removed).toEqual([3]);
    });

    it('should diff keyed arrays (car_list)', () => {
        const old = [
            { carNum: 'A001', val: 1 },
            { carNum: 'A002', val: 2 },
        ];
        const fresh = [
            { carNum: 'A001', val: 1 },
            { carNum: 'A003', val: 3 },
        ];
        const result = diffArrays(old, fresh, 'car_list');
        expect(result.status).toBe('modified');
        expect(result.added.length).toBe(1);
        expect(result.added[0].carNum).toBe('A003');
        expect(result.removed.length).toBe(1);
        expect(result.removed[0].carNum).toBe('A002');
    });

    it('should detect modified items in keyed arrays', () => {
        const old = [{ carNum: 'A001', val: 1 }];
        const fresh = [{ carNum: 'A001', val: 99 }];
        const result = diffArrays(old, fresh, 'car_list');
        expect(result.status).toBe('modified');
        expect(result.modified.length).toBe(1);
        expect(result.modified[0].key).toBe('A001');
    });

    it('should return unchanged for identical keyed arrays', () => {
        const items = [
            { carNum: 'A001', val: 1 },
            { carNum: 'A002', val: 2 },
        ];
        const result = diffArrays(items, [...items], 'car_list');
        expect(result.status).toBe('unchanged');
    });
});

describe('diffData', () => {
    it('should return unchanged for identical data', () => {
        const data = {
            car_list: [{ carNum: 'A001', val: 1 }],
            blacklist: [{ starId: 'S001', name: 'test' }],
        };
        const result = diffData(data, { ...data });
        expect(result.summary.unchanged).toBe(2);
        expect(result.summary.modified).toBe(0);
    });

    it('should detect added stores', () => {
        const old = { car_list: [] };
        const fresh = { car_list: [], blacklist: [] };
        const result = diffData(old, fresh);
        expect(result.stores.blacklist.status).toBe('added');
        expect(result.summary.added).toBe(1);
    });

    it('should detect removed stores', () => {
        const old = { car_list: [], blacklist: [] };
        const fresh = { car_list: [] };
        const result = diffData(old, fresh);
        expect(result.stores.blacklist.status).toBe('removed');
        expect(result.summary.removed).toBe(1);
    });

    it('should detect modified stores', () => {
        const old = { car_list: [{ carNum: 'A001', val: 1 }] };
        const fresh = { car_list: [{ carNum: 'A001', val: 99 }] };
        const result = diffData(old, fresh);
        expect(result.stores.car_list.status).toBe('modified');
        expect(result.summary.modified).toBe(1);
    });
});

describe('getSettingSync', () => {
    it('should return default when cache is null', () => {
        expect(getSettingSync('key', 'default', null)).toBe('default');
    });

    it('should return default when key missing', () => {
        expect(getSettingSync('missing', 'default', {})).toBe('default');
    });

    it('should return stored value', () => {
        expect(getSettingSync('key', 'default', { key: 'value' })).toBe('value');
    });

    it('should parse "true" string to boolean', () => {
        expect(getSettingSync('flag', false, { flag: 'true' })).toBe(true);
    });

    it('should parse "false" string to boolean', () => {
        expect(getSettingSync('flag', true, { flag: 'false' })).toBe(false);
    });

    it('should parse numeric strings to numbers', () => {
        expect(getSettingSync('count', 0, { count: '42' })).toBe(42);
    });

    it('should not parse non-numeric strings', () => {
        expect(getSettingSync('name', '', { name: 'hello' })).toBe('hello');
    });

    it('should return null values as default', () => {
        expect(getSettingSync('key', 'default', { key: null })).toBe('default');
    });
});
