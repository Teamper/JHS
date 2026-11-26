// @ts-check

/** @type {Record<string, string>} */
const fileTypes = {
    txt: "text/plain", html: "text/html", css: "text/css", csv: "text/csv", json: "application/json", xml: "application/xml",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    zip: "application/zip", rar: "application/x-rar-compressed", "7z": "application/x-7z-compressed",
    mp3: "audio/mpeg", wav: "audio/wav", mp4: "video/mp4", webm: "video/webm", ogg: "audio/ogg",
};

/** @param {BlobPart | Blob} data @param {string} filename */
export function downloadFile(data, filename) {
    const type = fileTypes[filename.split(".").at(-1)?.toLowerCase() ?? ""] ?? "application/octet-stream";
    const content = typeof data === "string" && data.startsWith("data:")
        ? Uint8Array.from(atob(data.split(",")[1]), character => character.charCodeAt(0))
        : data;
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 100);
}

/** @param {{info: (message: string) => unknown, error: (message: string) => unknown}} notifications @param {{error?: (...parts: unknown[]) => void}} logger */
export function createClipboardWriter(notifications, logger) {
    /** @param {string} label @param {unknown} value */
    return async (label, value) => {
        const text = String(value ?? "");
        try {
            if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
            await navigator.clipboard.writeText(text);
        } catch (error) {
            const textarea = document.createElement("textarea");
            const previous = /** @type {HTMLElement | null} */ (document.activeElement);
            textarea.value = text;
            textarea.readOnly = true;
            Object.assign(textarea.style, { position: "fixed", opacity: "0" });
            document.body.append(textarea);
            textarea.select();
            try {
                if (!document.execCommand("copy")) throw error;
            } catch (fallbackError) {
                logger.error?.("复制失败:", fallbackError);
                notifications.error("复制失败，请手动复制");
                return false;
            } finally {
                textarea.remove();
                previous?.focus?.();
            }
        }
        notifications.info(label ? `${label}已复制` : "已复制");
        return true;
    };
}
