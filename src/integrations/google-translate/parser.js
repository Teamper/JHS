// @ts-check

/** @param {unknown} payload */
export function parseGoogleTranslation(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new TypeError("Translation response is invalid");
    const translation = /** @type {{translation?: unknown}} */ (payload).translation;
    if (typeof translation !== "string" || !translation.trim()) throw new TypeError("Translation text is missing");
    return translation;
}
