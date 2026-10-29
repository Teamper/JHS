// @ts-check

import { normalizeCarNum } from "../../core/constants.js";

/** @param {string} value */
function fc2Number(value) { return value.match(/^FC2-?(?:PPV-?)?(\d+)$/)?.[1] || null; }

export function normalize115Keyword(/** @type {unknown} */ carNum) { const normalized = normalizeCarNum(carNum); return normalized ? fc2Number(normalized) || normalized : null; }

/** Compare complete identities locally; a cloud search result alone is not matching evidence.
 * @param {unknown} fileName @param {unknown} carNum
 */
export function matches115FileName(fileName, carNum) {
    const target = normalizeCarNum(carNum);
    if (typeof fileName !== "string" || !target || !/^(?:[A-Z0-9]+-)*[A-Z]*\d+$/.test(target) || /^FC2(?:-?PPV)?$/.test(target)) return false;
    const text = fileName.normalize("NFKC").replace(/[‐‑‒–—―﹘﹣－]/g, "-").toUpperCase().replace(/\.[A-Z0-9]{1,6}$/, "");
    const number = fc2Number(target);
    const separator = "[\\s_-]*";
    const pattern = number ? `FC2${separator}(?:PPV${separator})?${number}` : target.split("-").join(separator);
    const explicit = [...text.matchAll(new RegExp(`(?<![A-Z0-9])${pattern}(?![A-Z0-9])`, "g"))];
    // Remove only complete target occurrences before checking for conflicting identities.
    let evidence = text.replace(new RegExp(`(?<![A-Z0-9])${pattern}(?![A-Z0-9])`, "g"), " ");
    if (!explicit.length) {
        if (!number) return false;
        // Bare FC2 numbers must not be the numeric part of another provider's identity.
        const bare = new RegExp(`(?<![A-Z0-9])${number}(?![A-Z0-9])`, "g");
        if (!bare.test(text)) return false;
        evidence = text;
    }
    const identities = evidence.match(/(?<![A-Z0-9])(?:FC2[\s_-]*(?:PPV[\s_-]*)?\d+|(?:[A-Z][A-Z0-9]{0,9}|\d{1,3}[A-Z]{1,8})[\s_-]*\d+|\d{6}[\s_-]+\d+)(?![A-Z0-9])/g) || [];
    // These compact tokens describe encodings or separate discs, not movie identities.
    if (identities.some(identity => !/^(?:(?:CD|DISC|PART)\d+|[HX]26[45])$/.test(identity))) return false;
    if (number) {
        const numericIds = evidence.match(/(?<![A-Z0-9])\d{5,}(?![A-Z0-9])/g) || [];
        if (numericIds.some(identity => identity !== number)) return false;
    }
    return true;
}
export function format115Size(/** @type {unknown} */ bytes) { const value = Number(bytes) || 0; if (!value) return "0 B"; const units = ["B", "KB", "MB", "GB", "TB"], index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024))); return `${(value / 1024 ** index).toFixed(index ? 2 : 0)} ${units[index]}`; }
/** @param {string} fileName @param {string} carNum @param {{uppercase?: boolean, keepTitle?: boolean, keepSuffix?: boolean, maxLength?: number}} [options] */
export function preview115Rename(fileName, carNum, options = {}) {
    const extension = fileName.match(/\.[^.]+$/)?.[0] || "", tags = fileName.match(/-(?:U|UC|C|4K|8K|H265|HEVC|CN|CHS|CHT)\b/gi) || [];
    let base = options.uppercase === false ? carNum : carNum.toUpperCase();
    if (options.keepTitle) base += ` ${fileName.replace(extension, "").replace(/^.*?\s+/, "")}`;
    if (options.keepSuffix !== false) base += [...new Set(tags.map((tag => tag.toUpperCase())))].join("");
    return `${base.slice(0, options.maxLength || 180)}${extension}`;
}
