// @ts-check
import { CHANNEL, pack, unpack, unwrapResponse } from "../../contracts/extension-protocol.js";

export class ExtensionClient extends EventTarget {
    constructor(runtime = chrome.runtime) {
        super();
        this.runtime = runtime;
        this.disposed = false;
        /** @type {ReturnType<typeof setTimeout>|null} */ this.reconnectTimer = null;
        this.connect();
    }
    connect() {
        if (!this.runtime.id) { this.disposed = true; this.dispatchEvent(new Event("disconnected")); return; }
        this.port = this.runtime.connect({ name: CHANNEL });
        this.port.onMessage.addListener(message => this.dispatchEvent(new CustomEvent("event", { detail: unpack(message) })));
        this.port.onDisconnect.addListener(() => {
            if (!this.disposed) this.reconnectTimer = setTimeout(() => this.connect(), 250);
        });
    }
    /** @param {string} method @param {any[]} [args] @param {AbortSignal} [signal] @returns {Promise<any>} */
    async call(method, args = [], signal) {
        if (signal?.aborted) throw new DOMException("操作已取消", "AbortError");
        const id = crypto.randomUUID();
        const abort = () => { void this.runtime.sendMessage({ channel: CHANNEL, target: "cancel", id, method: "cancel", args: [] }); };
        signal?.addEventListener("abort", abort, { once: true });
        try {
            const response = await this.runtime.sendMessage({ channel: CHANNEL, target: "background", id, method, args: pack(args) });
            if (signal?.aborted) throw new DOMException("操作已取消", "AbortError");
            return unwrapResponse(response);
        } finally { signal?.removeEventListener("abort", abort); }
    }
    dispose() {
        this.disposed = true;
        if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
        if (this.runtime.id) /** @type {chrome.runtime.Port} */ (this.port).disconnect();
    }
}
