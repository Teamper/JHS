// @ts-check

/** @template T @typedef {{key?: keyof T | ((record: T) => unknown), order?: string}} SortKey */

/** @param {unknown} value */
function dateValue(value) {
    if (value instanceof Date) return value;
    if (typeof value === "string") {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) return date;
    }
    return value;
}

/** @template T @param {T[]} records @param {SortKey<T>[]} keys @param {boolean} [nullsLast] */
export function genericSort(records, keys, nullsLast = true) {
    if (!Array.isArray(records) || !records.length) return [];
    if (!Array.isArray(keys) || !keys.length) return [...records];
    /** @param {T} record @param {SortKey<T>["key"]} key */
    const read = (record, key) => {
        if (key == null) return record;
        if (typeof key === "function") return key(record);
        return record && typeof record === "object" ? record[key] : undefined;
    };
    /** @type {T[]} */
    const nulls = [];
    /** @type {T[]} */
    const values = [];
    for (const record of records) (keys.some(({ key }) => read(record, key) == null) ? nulls : values).push(record);
    values.sort((left, right) => {
        for (const { key, order } of keys) {
            const a = read(left, key), b = read(right, key);
            const dateA = dateValue(a), dateB = dateValue(b);
            const comparison = dateA instanceof Date && dateB instanceof Date ? dateA.getTime() - dateB.getTime()
                : typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
            if (comparison) return order === "desc" ? -comparison : comparison;
        }
        return 0;
    });
    return nullsLast ? [...values, ...nulls] : [...nulls, ...values];
}
