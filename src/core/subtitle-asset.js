// @ts-check

export const SUBTITLE_MAX_BYTES = 5 * 1024 * 1024;
export const SUBTITLE_EXTENSIONS = Object.freeze(["srt", "ass", "ssa", "vtt"]);

/** Decode once while retaining the original upload/download bytes. @param {unknown} data @param {{extension?: unknown, headers?: string}} options */
export function parseSubtitleAsset(data, options) {
    const extension = String(options.extension || "").toLowerCase().replace(/^\./, "");
    if (!SUBTITLE_EXTENSIONS.includes(extension)) throw new TypeError("仅支持 SRT、ASS、SSA、VTT 字幕");
    const length = data instanceof ArrayBuffer || ArrayBuffer.isView(data) ? data.byteLength : 0;
    if (!length || length > SUBTITLE_MAX_BYTES) throw new TypeError("字幕为空或超过 5 MiB 上限");
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data.slice(0))
        : ArrayBuffer.isView(data) ? Uint8Array.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)) : null;
    if (!bytes || !bytes.length || bytes.length > SUBTITLE_MAX_BYTES) throw new TypeError("字幕为空或超过 5 MiB 上限");
    if (/^content-type:\s*[^\r\n]*(?:html|xml|json)/im.test(options.headers || "")) throw new TypeError("下载地址返回了错误页面");
    let encoding = "utf-8", text;
    if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = "utf-16le";
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = "utf-16be";
    try { text = new TextDecoder(encoding, { fatal: true }).decode(bytes); }
    catch {
        if (encoding !== "utf-8") throw new TypeError("字幕编码无效");
        encoding = "gb18030";
        text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
    }
    if (/^\s*(?:<|\{)/.test(text) || text.includes("\0")) throw new TypeError("下载内容不是字幕");
    const valid = extension === "vtt" ? /^\s*WEBVTT(?:\s|$)/.test(text)
        : ["ass", "ssa"].includes(extension) ? /^\s*\[(?:Script Info|Events)\]/im.test(text) && /^Dialogue\s*:/im.test(text)
            : /^\s*(?:\d+\s*\r?\n)?\d{1,2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{3}/.test(text);
    if (!valid) throw new TypeError("字幕格式校验失败");
    return { bytes: /** @type {ArrayBuffer} */ (bytes.buffer), text, encoding, extension, size: bytes.length };
}

/** @param {unknown} name @param {string} extension */
export function subtitleFilename(name, extension) {
    const stem = String(name || "字幕").normalize("NFKC").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/\.(srt|ass|ssa|vtt)$/i, "").replace(/[. ]+$/, "").slice(0, 180);
    return `${stem || "字幕"}.${extension}`;
}
