import { afterEach, describe, expect, it, vi } from "vitest";
import { extensionFetch } from "../src/platform/extension/network.js";
import { ExternalUrlPolicy } from "../src/services/external-url-policy.js";

const origin = "http://127.0.0.1:8123";
const initiator = "chrome-extension://test-extension";

function setup() {
    const listeners = new Set();
    const transport = vi.fn(async () => ({ type: "opaqueredirect", status: 0, headers: new Headers() }));
    vi.stubGlobal("fetch", transport);
    vi.stubGlobal("navigator", { locks: { request: (_key, _options, callback) => callback() } });
    vi.stubGlobal("chrome", {
        runtime: { getURL: () => `${initiator}/` },
        permissions: { contains: async () => true },
        webRequest: { onHeadersReceived: {
            addListener: listener => listeners.add(listener),
            removeListener: listener => listeners.delete(listener),
        } },
    });
    const signalOwner = new AbortController();
    const policy = new ExternalUrlPolicy({ localOrigins: [origin] });
    const request = extensionFetch({
        url: `${origin}/redirect`, redirect: "manual",
        urlPolicy: { trustClass: "user-local", expectedOrigin: origin },
    }, signalOwner.signal, policy);
    return { listeners, transport, request, signalOwner };
}

describe("extension redirect metadata", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("returns the real redirect status and Location when headers arrive after fetch", async () => {
        const { listeners, transport, request } = setup();
        await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce());
        await new Promise(resolve => setImmediate(resolve));
        expect(listeners.size).toBe(1);
        for (const listener of listeners) listener({ initiator, statusCode: 302, responseHeaders: [{ name: "Location", value: "/bytes" }] });
        await expect(request).resolves.toMatchObject({ status: 302, responseHeaders: "Location: /bytes" });
        expect(listeners.size).toBe(0);
    });

    it("removes the header listener when the redirected request is cancelled", async () => {
        const { listeners, transport, request, signalOwner } = setup();
        const rejected = expect(request).rejects.toMatchObject({ name: "AbortError" });
        await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce());
        await new Promise(resolve => setImmediate(resolve));
        expect(listeners.size).toBe(1);
        signalOwner.abort();
        await rejected;
        expect(listeners.size).toBe(0);
    });
});
