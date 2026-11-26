// @ts-check

/** Format UI timestamps in the viewer's local time without changing stored values. @param {unknown} value */
export function formatUiDateTime(value) {
    if (value == null || value === "" || value === 0) return "无";
    if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return "无";
    const input = typeof value === "string" ? value.trim() : value;
    if (input === "") return "无";
    const date = new Date(typeof input === "string" && /^\d+$/.test(input) ? Number(input) : /** @type {string | number} */ (input));
    if (!Number.isFinite(date.getTime()) || date.getTime() === 0) return "无";
    return formatDateParts(date, "-", ":", String(date.getFullYear()).padStart(4, "0"));
}

/** @param {Date} date @param {string} dateSeparator @param {string} timeSeparator @param {string | number} [year] */
function formatDateParts(date, dateSeparator, timeSeparator, year = date.getFullYear()) {
    const pad = (/** @type {number} */ value) => String(value).padStart(2, "0");
    const day = [year, pad(date.getMonth() + 1), pad(date.getDate())].join(dateSeparator);
    const time = [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(timeSeparator);
    return `${day} ${time}`;
}

/** @param {string} [dateSeparator] @param {string} [timeSeparator] @param {string | number | Date | null} [timestamp] */
export function getNowStr(dateSeparator = "-", timeSeparator = ":", timestamp = null) {
    const date = timestamp ? new Date(timestamp) : new Date();
    return Number.isNaN(date.getTime()) ? "" : formatDateParts(date, dateSeparator, timeSeparator);
}

/** @param {unknown} value @param {string} [dateSeparator] @param {string} [timeSeparator] */
export function formatDate(value, dateSeparator = "-", timeSeparator = ":") {
    if (value instanceof Date) return formatDateParts(value, dateSeparator, timeSeparator);
    if (typeof value !== "string") throw new Error("Invalid date input: must be Date object or date string");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error("Invalid date string");
    return formatDateParts(date, dateSeparator, timeSeparator);
}

/** @param {Date} a @param {Date} b */
export function getHourDifference(a, b) {
    return Math.floor(Math.abs(a.getTime() - b.getTime()) / 3_600_000);
}
