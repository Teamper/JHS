import { normalizeCarNum } from "../../core/constants.js";

export function normalize115Keyword(carNum) { const normalized = normalizeCarNum(carNum); return normalized?.replace(/^FC2-/i, "") || null; }
export function format115Size(bytes) { const value = Number(bytes) || 0; if (!value) return "0 B"; const units = ["B", "KB", "MB", "GB", "TB"], index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024))); return `${(value / 1024 ** index).toFixed(index ? 2 : 0)} ${units[index]}`; }
export function preview115Rename(fileName, carNum, options = {}) {
    const extension = fileName.match(/\.[^.]+$/)?.[0] || "", tags = fileName.match(/-(?:U|UC|C|4K|8K|H265|HEVC|CN|CHS|CHT)\b/gi) || [];
    let base = options.uppercase === false ? carNum : carNum.toUpperCase();
    if (options.keepTitle) base += ` ${fileName.replace(extension, "").replace(/^.*?\s+/, "")}`;
    if (options.keepSuffix !== false) base += [...new Set(tags.map((tag => tag.toUpperCase())))].join("");
    return `${base.slice(0, options.maxLength || 180)}${extension}`;
}
