// @ts-check
import { registerPlugin } from "@capacitor/core";
import { JhsError, JHS_ERROR_CODES } from "../../core/jhs-error.js";

/** @type {any} */ export const android = registerPlugin("JhsAndroid");
/** @type {[string, RegExp][]} */
const sessions = [
    ["javdb", /^(?:javdb\.com)$/], ["one115", /(?:^|\.)115\.com$/], ["pan123", /(?:^|\.)123pan\.com$/],
];
const redirects = new Set([301, 302, 303, 307, 308]);

/** @param {Uint8Array} bytes */
export function toBase64(bytes) {
    let encoded = "";
    for (let i = 0; i < bytes.length; i += 24576) {
        encoded += btoa(String.fromCharCode(...bytes.subarray(i, i + 24576)));
    }
    return encoded;
}

/** @param {string} value */
function fromBase64(value) { return Uint8Array.from(atob(value), char => char.charCodeAt(0)).buffer; }

/** @param {BlobPart | Blob} data @param {string} filename */
export async function saveFile(data, filename, type = "application/octet-stream") {
    const blob = data instanceof Blob ? data : new Blob([data]);
    await android.saveFile({ data: toBase64(new Uint8Array(await blob.arrayBuffer())), filename, type: blob.type || type });
}

export class AndroidHttpAdapter {
    /** @type {Map<string,{signingIn:boolean}>} */ sessionStates = new Map();

    /** @param {{assertAllowed: (url: URL, policy: any) => URL}} redirectPolicy */
    constructor(redirectPolicy) { this.redirectPolicy = redirectPolicy; }

    /** @param {string} site */
    async login(site) {
        if (this.sessionStates.get(site)?.signingIn) throw new JhsError("ABORTED", "登录窗口已打开");
        const state = { signingIn: true };
        this.sessionStates.set(site, state);
        try { return await android.login({ site }); }
        finally { state.signingIn = false; }
    }

    /** @param {Record<string, any>} options */
    async request(options) {
        const id = crypto.randomUUID();
        const { signal, requestOptions = {} } = options;
        let sessionSite = "";
        /** @type {{signingIn:boolean}|undefined} */ let sessionState;
        const abort = () => void android.cancel({ id }).catch(() => {});
        const assertActive = () => {
            if (signal?.aborted) throw new JhsError("ABORTED", "请求已取消");
            if (sessionSite && (sessionState?.signingIn || this.sessionStates.get(sessionSite) !== sessionState)) {
                throw new JhsError("ABORTED", "登录会话已变化");
            }
        };
        assertActive();
        signal?.addEventListener("abort", abort, { once: true });
        try {
            let url = new URL(options.url);
            const useSession = !requestOptions.anonymous && options.cacheScope !== "public" && url.protocol === "https:" && !url.port;
            let session = useSession ? sessions.find(([, host]) => host.test(url.hostname))?.[0] ?? "" : "";
            sessionSite = session;
            sessionState = this.sessionStates.get(sessionSite);
            assertActive();
            const method = options.method ?? "GET";
            let body = options.body;
            const headers = { ...options.headers };
            let binary;
            if (body instanceof FormData) {
                const encoded = new Response(body);
                headers["Content-Type"] = encoded.headers.get("Content-Type");
                binary = toBase64(new Uint8Array(await encoded.arrayBuffer()));
            } else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body) || body instanceof Blob) {
                binary = toBase64(new Uint8Array(await new Blob([/** @type {BlobPart} */ (body)]).arrayBuffer()));
            }
            if (binary != null) body = undefined;
            const permit = await options.beforeSend?.();
            assertActive();
            if (typeof permit === "function") permit();
            options.onDispatch?.();
            for (let hop = 0; ; hop++) {
                assertActive();
                const raw = options.responseType === "arraybuffer";
                const response = await android.request({ id, url: url.href, method, headers, body: body == null ? undefined : String(body),
                    binary, session, raw, timeout: options.timeout, limit: options.maxResponseBytes });
                assertActive();
                if (!redirects.has(response.status) || !response.location || requestOptions.redirect === "manual") {
                    const responseText = raw ? "" : response.body;
                    let data = raw ? fromBase64(response.body) : responseText;
                    if (options.responseType === "json" && responseText) {
                        try { data = JSON.parse(responseText); }
                        catch (error) {
                            if (response.status < 400 && !/^\s*</.test(responseText)) throw new JhsError("PARSE_ERROR", "JSON 响应解析失败", { cause: error });
                        }
                    }
                    return { status: response.status, data, responseText, finalUrl: response.url, responseHeaders: response.headers, transportUsed: "android" };
                }
                if (hop >= 4 || requestOptions.redirect === "error" || !["GET", "HEAD"].includes(method)) {
                    throw new JhsError("INVALID_URL", "请求的跳转未获授权");
                }
                const next = new URL(response.location, url);
                if (next.origin !== url.origin) {
                    const policy = options.urlPolicy ?? { trustClass: "custom-public" };
                    this.redirectPolicy.assertAllowed(next, policy);
                    for (const key of Object.keys(headers)) delete headers[key];
                    session = "";
                }
                url = next;
            }
        } catch (error) {
            assertActive();
            if (error instanceof JhsError) throw error;
            const failure = /** @type {{code?:string,message?:string}} */ (error);
            const code = failure.code && JHS_ERROR_CODES.includes(failure.code) ? failure.code : "NETWORK_ERROR";
            const retryable = navigator.onLine && ["GET", "HEAD"].includes(options.method ?? "GET") && ["NETWORK_ERROR", "TIMEOUT"].includes(code);
            throw new JhsError(code, failure.message || "Android 网络请求失败", { cause: error, retryable });
        } finally {
            signal?.removeEventListener("abort", abort);
        }
    }
}

/** @param {AndroidHttpAdapter} http @param {(url:string) => any} open */
export async function installAndroidPorts(http, open) {
    const values = new Map(Object.entries(await android.values()));
    /** @type {Map<string,[string,Function]>} */ const listeners = new Map();
    /** @param {string} key @param {unknown} value */
    async function set(key, value) {
        const previous = values.get(key);
        await android.setValue({ key, json: value === undefined ? undefined : JSON.stringify(value) });
        if (value === undefined) values.delete(key);
        else values.set(key, value);
        for (const [name, callback] of listeners.values()) if (name === key) callback(key, previous, value, false);
    }
    Object.assign(globalThis, {
        unsafeWindow: window,
        GM_getValue: (/** @type {string} */ key, /** @type {unknown} */ fallback) => values.has(key) ? values.get(key) : fallback,
        GM_setValue: set,
        GM_deleteValue: (/** @type {string} */ key) => set(key, undefined),
        GM_listValues: () => [...values.keys()],
        GM_addValueChangeListener(/** @type {string} */ key, /** @type {Function} */ callback) {
            const listener = crypto.randomUUID();
            listeners.set(listener, [key, callback]);
            return listener;
        },
        GM_removeValueChangeListener: (/** @type {string} */ id) => listeners.delete(id),
        GM_openInTab: open,
        GM_xmlhttpRequest(/** @type {Record<string,any>} */ options) {
            const controller = new AbortController();
            void http.request({ ...options, body: options.data, signal: controller.signal, requestOptions: options }).then(
                result => options.onload?.({ ...result, response: result.data }),
                error => controller.signal.aborted ? options.onabort?.(error) : options.onerror?.(error),
            );
            return { abort: () => controller.abort() };
        },
    });
    return { get: (/** @type {string} */ key) => values.get(key), set };
}
