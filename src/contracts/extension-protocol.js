// @ts-check
import { JhsError, JHS_ERROR_CODES } from "../core/jhs-error.js";
export const CHANNEL = "jhs-extension-v1";

// Chrome messaging uses JSON. Preserve the values used by existing service contracts.
/** @param {any} value @returns {any} */
export function pack(value) {
    if (value === undefined) return { $jhs: "undefined" };
    if (value instanceof Map) return { $jhs: "map", value: pack([...value]) };
    if (value instanceof Set) return { $jhs: "set", value: pack([...value]) };
    if (value instanceof ArrayBuffer) return { $jhs: "bytes", value: Array.from(new Uint8Array(value)) };
    if (ArrayBuffer.isView(value)) return pack(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
    if (Array.isArray(value)) return value.map(pack);
    if (value && typeof value === "object" && Object.hasOwn(value, "$jhs")) return { $jhs: "record", value: Object.entries(value).map(([key, item]) => [key, pack(item)]) };
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item !== "function" && !(item instanceof AbortSignal)).map(([key, item]) => [key, pack(item)]));
    return value;
}

/** @param {any} value @returns {any} */
export function unpack(value) {
    if (Array.isArray(value)) return value.map(unpack);
    if (!value || typeof value !== "object") return value;
    if (value.$jhs === "undefined") return undefined;
    if (value.$jhs === "map") return new Map(unpack(value.value));
    if (value.$jhs === "set") return new Set(unpack(value.value));
    if (value.$jhs === "bytes") return new Uint8Array(value.value).buffer;
    if (value.$jhs === "record") return Object.fromEntries(value.value.map((/** @type {[string, any]} */ pair) => [pair[0], unpack(pair[1])]));
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, unpack(item)]));
}

/** @param {any} error */
export function failure(error) {
    return { ok: false, error: { name: error.name, message: error.message, code: error.code, retryable: error.retryable, details: error.details } };
}

/** @param {any} message */
export function checkMessage(message) {
    if (message?.channel !== CHANNEL || typeof message.id !== "string" || typeof message.method !== "string" || !Array.isArray(message.args)) throw new TypeError("扩展消息格式无效");
}

/** @param {any} response @returns {any} */
export function unwrapResponse(response) {
    if (response?.ok === true) return unpack(response.value);
    const error = response?.error;
    const message = error?.message || "扩展后台连接中断";
    if (JHS_ERROR_CODES.includes(error?.code)) throw new JhsError(error.code, message, { source: "extension", details: error.details, retryable: error.retryable });
    throw Object.assign(new Error(message), error);
}
