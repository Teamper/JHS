import { describe, it, expect, vi, afterEach } from "vitest";
import { OneTwoThreeOfflinePlugin } from "../src/plugins/one-two-three/offline.js";
import { encryptData } from "../src/core/credential-crypto.js";

function fixture(value, secret) {
    const plugin = new OneTwoThreeOfflinePlugin(), values = new Map([[plugin.tokenKey, value], [`${plugin.tokenKey}_secret`, secret]]);
    plugin.runtimeServices = { storage: { getValue: (key, fallback) => values.get(key) ?? fallback, setValue: (key, value) => values.set(key, value) } };
    return { plugin, values };
}
describe("123 stored token authentication", () => {
    afterEach(() => vi.unstubAllGlobals());
    it("does not let an older authorization sync overwrite the newest source", async () => {
        const {plugin}=fixture("", "key");
        vi.stubGlobal("show",{info:vi.fn()});
        let source="old-token", release;
        plugin.getTokenFrom123Pan=()=>({token:source,source:"authorToken"});
        const read=plugin.getStoredToken.bind(plugin);
        plugin.getStoredToken=()=>new Promise(resolve=>release=resolve);
        const old=plugin.syncTokenOnce();
        source="new-token"; plugin.getStoredToken=read;
        await plugin.syncTokenOnce(); release(""); await old;
        expect(await read()).toBe("new-token");
    });
    it.each(["source", "target", "key", "clear"])("rejects a stale sync when %s changes while reading", async mode => {
        const {plugin,values}=fixture("existing", "key");
        vi.stubGlobal("show",{info:vi.fn()});
        let source="old-token", release;
        plugin.getTokenFrom123Pan=()=>({token:source,source:"authorToken"});
        plugin.getStoredToken=()=>new Promise(resolve=>release=resolve);
        const pending=plugin.syncTokenOnce();
        if(mode==="source") source="";
        if(mode==="target") values.set(plugin.tokenKey,"new-target");
        if(mode==="key") values.set(`${plugin.tokenKey}_secret`,"new-key");
        if(mode==="clear") plugin.clearStoredToken("test");
        const expected=values.get(plugin.tokenKey);
        release("existing"); await pending;
        expect(values.get(plugin.tokenKey)).toBe(expected);
    });
    it("keeps legacy plaintext readable", async () => expect(await fixture("legacy-token", "").plugin.getStoredToken()).toBe("legacy-token"));
    it("decrypts the existing marked format", async () => {
        const value = "AES:" + await encryptData("token", "correct");
        expect(await fixture(value, "correct").plugin.getStoredToken()).toBe("token");
    });
    it.each(["wrong", ""])("rejects marked ciphertext with key %j without deleting its source", async secret => {
        const value = "AES:" + await encryptData("token", "correct"), {plugin, values} = fixture(value, secret);
        expect(await plugin.getStoredToken()).toBe("");
        expect(values.get(plugin.tokenKey)).toBe(value);
    });
    it("rejects damaged ciphertext", async () => expect(await fixture("AES:damaged", "key").plugin.getStoredToken()).toBe(""));
    it.each(["fresh-token", "AES:real-source-token"])("recovers invalid stored authorization through source sync: %s", async token => {
        const {plugin,values}=fixture("AES:damaged", "key"), notify=vi.fn();
        vi.stubGlobal("show",{info:notify});
        plugin.getTokenFrom123Pan=()=>({token,source:"authorToken"});
        await plugin.syncTokenOnce();
        expect(await plugin.getStoredToken()).toBe(token);
        expect(values.get(plugin.tokenKey)).not.toBe(token);
        const encrypted=values.get(plugin.tokenKey);
        await plugin.syncTokenOnce();
        expect(values.get(plugin.tokenKey)).toBe(encrypted);
        expect(notify).toHaveBeenCalledOnce();
        expect(notify.mock.calls[0][0]).not.toContain(token);
    });
});
