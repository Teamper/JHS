// @ts-check

import { inflateSync, strFromU8 } from "fflate";

/** Synchronous, page-local reader for trusted build-time data, never executable code.
 * @param {string} payload @param {number} expectedCount
 * @returns {(index: number) => string}
 */
export function createPackedTextReader(payload, expectedCount) {
    /** @type {string[] | undefined} */
    let texts;
    return (index) => {
        if (!Number.isInteger(index) || index < 0 || index >= expectedCount) throw new RangeError("Invalid static text index");
        if (!texts) {
            try {
                const bytes = Uint8Array.from(atob(payload), character => character.charCodeAt(0));
                const decoded = JSON.parse(strFromU8(inflateSync(bytes)));
                if (!Array.isArray(decoded) || decoded.length !== expectedCount || decoded.some(text => typeof text !== "string")) {
                    throw new TypeError("Invalid static text table");
                }
                texts = decoded;
                payload = "";
            } catch (cause) {
                throw Object.assign(new Error("JHS static text resources could not be decoded"), { code: "STATIC_TEXT_DECODE_FAILED", cause });
            }
        }
        return texts[index];
    };
}
