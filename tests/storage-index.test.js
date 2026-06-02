import { describe, it, expect } from 'vitest';

// Status constants (from constants.js)
const d = "filter";
const h = "favorite";
const g = "hasDown";
const p = "hasWatch";

// --- Functions under test (from src/core/storage-index.js) ---

function createIndexedMap(items, key) {
    return new Map(items.filter((item => item && item[key])).map((item => [ item[key], item ])));
}

function createStatusMap(items) {
    const statusMap = {
        [d]: new Set,
        [h]: new Set,
        [g]: new Set,
        [p]: new Set
    };
    items.forEach((item => {
        item && Object.prototype.hasOwnProperty.call(statusMap, item.status) && statusMap[item.status].add(item.carNum);
    }));
    return statusMap;
}

function groupDuplicateItems(items, key) {
    const counts = new Map;
    items.forEach((item => {
        const value = item && item[key];
        value && counts.set(value, (counts.get(value) || 0) + 1);
    }));
    return Array.from(counts.entries()).filter((item => item[1] > 1));
}

function dedupeByKey(items, key) {
    const seen = new Map, list = [];
    let changed = !1;
    for (const item of items) {
        const value = item && item[key];
        if (!value) {
            list.push(item);
            continue;
        }
        if (seen.has(value)) {
            Object.assign(seen.get(value), item), changed = !0;
        } else seen.set(value, item), list.push(item);
    }
    return {
        list,
        changed
    };
}

// --- Tests ---

describe('createIndexedMap', () => {
    it('should build a map keyed by the specified field', () => {
        const items = [
            { id: 'A', name: 'Alice' },
            { id: 'B', name: 'Bob' },
        ];
        const map = createIndexedMap(items, 'id');
        expect(map.size).toBe(2);
        expect(map.get('A')).toEqual({ id: 'A', name: 'Alice' });
        expect(map.get('B')).toEqual({ id: 'B', name: 'Bob' });
    });

    it('should skip null/undefined items and items missing the key', () => {
        const items = [
            { id: 'A', name: 'Alice' },
            null,
            { name: 'NoId' },
            { id: 'C', name: 'Charlie' },
        ];
        const map = createIndexedMap(items, 'id');
        expect(map.size).toBe(2);
        expect(map.has('A')).toBe(true);
        expect(map.has('C')).toBe(true);
    });

    it('should return empty map for empty input', () => {
        const map = createIndexedMap([], 'id');
        expect(map.size).toBe(0);
    });

    it('should keep last item when duplicate keys exist', () => {
        const items = [
            { id: 'A', val: 1 },
            { id: 'A', val: 2 },
        ];
        const map = createIndexedMap(items, 'id');
        expect(map.get('A').val).toBe(2);
    });
});

describe('createStatusMap', () => {
    it('should group items by status into Sets', () => {
        const items = [
            { carNum: 'A001', status: 'filter' },
            { carNum: 'A002', status: 'favorite' },
            { carNum: 'A003', status: 'filter' },
            { carNum: 'A004', status: 'hasDown' },
            { carNum: 'A005', status: 'hasWatch' },
        ];
        const map = createStatusMap(items);
        expect(map[d].size).toBe(2);
        expect(map[d].has('A001')).toBe(true);
        expect(map[d].has('A003')).toBe(true);
        expect(map[h].size).toBe(1);
        expect(map[h].has('A002')).toBe(true);
        expect(map[g].size).toBe(1);
        expect(map[g].has('A004')).toBe(true);
        expect(map[p].size).toBe(1);
        expect(map[p].has('A005')).toBe(true);
    });

    it('should skip null items and items with unknown status', () => {
        const items = [
            { carNum: 'A001', status: 'filter' },
            null,
            { carNum: 'A002', status: 'unknown' },
        ];
        const map = createStatusMap(items);
        expect(map[d].size).toBe(1);
        expect(map[h].size).toBe(0);
    });

    it('should return empty Sets for empty input', () => {
        const map = createStatusMap([]);
        expect(map[d].size).toBe(0);
        expect(map[h].size).toBe(0);
        expect(map[g].size).toBe(0);
        expect(map[p].size).toBe(0);
    });
});

describe('groupDuplicateItems', () => {
    it('should return items that appear more than once', () => {
        const items = [
            { carNum: 'A001' },
            { carNum: 'A002' },
            { carNum: 'A001' },
            { carNum: 'A003' },
            { carNum: 'A002' },
            { carNum: 'A002' },
        ];
        const dupes = groupDuplicateItems(items, 'carNum');
        expect(dupes.length).toBe(2);
        expect(dupes.find(d => d[0] === 'A001')[1]).toBe(2);
        expect(dupes.find(d => d[0] === 'A002')[1]).toBe(3);
    });

    it('should return empty array when no duplicates', () => {
        const items = [
            { carNum: 'A001' },
            { carNum: 'A002' },
        ];
        const dupes = groupDuplicateItems(items, 'carNum');
        expect(dupes.length).toBe(0);
    });

    it('should skip null items and items missing the key', () => {
        const items = [
            { carNum: 'A001' },
            null,
            { other: 'val' },
            { carNum: 'A001' },
        ];
        const dupes = groupDuplicateItems(items, 'carNum');
        expect(dupes.length).toBe(1);
    });
});

describe('dedupeByKey', () => {
    it('should deduplicate items by key, merging later entries', () => {
        const items = [
            { carNum: 'A001', val: 1, extra: 'a' },
            { carNum: 'A002', val: 2 },
            { carNum: 'A001', val: 3, newField: 'b' },
        ];
        const result = dedupeByKey(items, 'carNum');
        expect(result.changed).toBe(true);
        expect(result.list.length).toBe(2);
        expect(result.list[0].carNum).toBe('A001');
        expect(result.list[0].val).toBe(3); // merged from second A001
        expect(result.list[0].extra).toBe('a'); // preserved from first
        expect(result.list[0].newField).toBe('b'); // added from second
        expect(result.list[1].carNum).toBe('A002');
    });

    it('should not change when no duplicates exist', () => {
        const items = [
            { carNum: 'A001', val: 1 },
            { carNum: 'A002', val: 2 },
        ];
        const result = dedupeByKey(items, 'carNum');
        expect(result.changed).toBe(false);
        expect(result.list.length).toBe(2);
    });

    it('should keep items without a key value as-is', () => {
        const items = [
            null,
            { val: 'noKey' },
            { carNum: 'A001', val: 1 },
        ];
        const result = dedupeByKey(items, 'carNum');
        expect(result.changed).toBe(false);
        expect(result.list.length).toBe(3);
    });

    it('should handle empty input', () => {
        const result = dedupeByKey([], 'carNum');
        expect(result.changed).toBe(false);
        expect(result.list.length).toBe(0);
    });
});
