// @ts-check

const LEGACY_ENCRYPTION_SALT = "x7k9p3";
const INSTALL_SECRET_KEY = "jhs_credential_install_secret";
const CREDENTIAL_PREFIX = "AES:";
let sessionSecret = "";

function getInstallationSecret() {
    let secret = globalThis.localStorage?.getItem?.(INSTALL_SECRET_KEY) || sessionSecret;
    if (secret) return secret;
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    secret = arrayBufferToBase64(bytes.buffer), sessionSecret = secret, globalThis.localStorage?.setItem?.(INSTALL_SECRET_KEY, secret);
    return secret;
}

/** @param {string} secret */
async function getEncryptionKey(secret) {
    const encoder = new TextEncoder();
    const material = await crypto.subtle.importKey("raw", encoder.encode(`${secret}.jhs.v1`), { name: "PBKDF2" }, false, ["deriveKey"]);
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
export async function encryptData(value, secret = getInstallationSecret()) {
    const key = await getEncryptionKey(secret), iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv); combined.set(new Uint8Array(encrypted), iv.length);
    return arrayBufferToBase64(combined.buffer);
}

/** @param {string} value */
export async function encryptPortableBackup(value) { return encryptData(value, LEGACY_ENCRYPTION_SALT); }

/** @param {string} value */
export async function decryptData(value, secret = getInstallationSecret()) {
    const combined = base64ToArrayBuffer(value), iv = combined.slice(0, 12), data = combined.slice(12);
    const decrypt = async (/** @type {string} */ candidate) => new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await getEncryptionKey(candidate), data));
    try { return await decrypt(secret); }
    catch (error) {
        if (secret === LEGACY_ENCRYPTION_SALT) throw error;
        return decrypt(LEGACY_ENCRYPTION_SALT);
    }
}

/** @param {string} value */
export async function decryptPortableBackup(value) { return decryptData(value); }

/** @param {string} value */
export async function encryptCredential(value, secret = getInstallationSecret()) { return value && !value.startsWith(CREDENTIAL_PREFIX) ? CREDENTIAL_PREFIX + await encryptData(value, secret) : value; }
/** @param {string} value */
export async function decryptCredential(value, secret = getInstallationSecret()) {
    if (!value || !value.startsWith(CREDENTIAL_PREFIX)) return value;
    try {
        return await decryptData(value.slice(CREDENTIAL_PREFIX.length), secret);
    } catch {
        // 密文解析失败：可能是明文恰好以 "AES:" 开头的历史值，按原文返回而不是抛错
        console?.warn?.("[凭证] 凭证解密失败，按原文返回");
        return value;
    }
}

/** @param {string} key */
export function hasStoredEncryptedCredential(key) { return Boolean(localStorage.getItem(key)); }

/** @param {string} key @param {string} value */
export async function storeEncryptedCredential(key, value) { localStorage.setItem(key, await encryptData(value)); }

/** @param {string} key */
export function removeStoredEncryptedCredential(key) { localStorage.removeItem(key); }
