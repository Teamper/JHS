// @ts-check

const ENCRYPTION_SALT = "x7k9p3";
const CREDENTIAL_PREFIX = "AES:";

async function getEncryptionKey() {
    const encoder = new TextEncoder();
    const material = await crypto.subtle.importKey("raw", encoder.encode(`${ENCRYPTION_SALT}.jhs.v1`), { name: "PBKDF2" }, false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: encoder.encode("jhs-backup"), iterations: 100_000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** @param {ArrayBuffer} buffer */
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer), chunkSize = 0x8000;
    let value = "";
    for (let index = 0; index < bytes.length; index += chunkSize) value += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    return btoa(value);
}

/** @param {string} value */
function base64ToArrayBuffer(value) {
    const decoded = atob(value), bytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index);
    return bytes;
}

/** @param {string} value */
export async function encryptData(value) {
    const key = await getEncryptionKey(), iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv); combined.set(new Uint8Array(encrypted), iv.length);
    return arrayBufferToBase64(combined.buffer);
}

/** @param {string} value */
export async function decryptData(value) {
    const key = await getEncryptionKey(), combined = base64ToArrayBuffer(value), iv = combined.slice(0, 12), data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new TextDecoder().decode(decrypted);
}

/** @param {string} value */
export async function encryptCredential(value) { return value && !value.startsWith(CREDENTIAL_PREFIX) ? CREDENTIAL_PREFIX + await encryptData(value) : value; }
/** @param {string} value */
export async function decryptCredential(value) { return value && value.startsWith(CREDENTIAL_PREFIX) ? decryptData(value.slice(CREDENTIAL_PREFIX.length)) : value; }

/** @param {string} key */
export function hasStoredEncryptedCredential(key) { return Boolean(localStorage.getItem(key)); }

/** @param {string} key @param {string} value */
export async function storeEncryptedCredential(key, value) { localStorage.setItem(key, await encryptData(value)); }

/** @param {string} key */
export function removeStoredEncryptedCredential(key) { localStorage.removeItem(key); }
