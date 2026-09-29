import { describe, it, expect, vi, afterEach } from "vitest";
import { Pan123CredentialService } from "../src/services/pan123-credential-service.js";
import { encryptData } from "../src/core/credential-crypto.js";

function fixture(value, secret) {
    const values = new Map();
    const service = new Pan123CredentialService({
        getLocal: () => null,
        getValue: (key, fallback) => values.get(key) ?? fallback,
        setValue: (key, value) => values.set(key, value),
    }, { info: vi.fn(), debug: vi.fn() }, { window: { location: { hostname: "javdb.com" } }, document: { cookie: "" }, crypto: globalThis.crypto });
    values.set(service.tokenKey, value);
    values.set(`${service.tokenKey}_secret`, secret);
    return { service, values };
}
describe("123 stored token authentication", () => {
    afterEach(() => vi.unstubAllGlobals());
    it("does not let an older authorization sync overwrite the newest source", async () => {
        const {service}=fixture("", "key");
        let source="old-token", release;
        service.getTokenFrom123Pan=()=>({token:source,source:"authorToken"});
        const read=service.getStoredToken.bind(service);
        service.getStoredToken=()=>new Promise(resolve=>release=resolve);
        const old=service.syncTokenOnce();
        source="new-token"; service.getStoredToken=read;
        await service.syncTokenOnce(); release(""); await old;
        expect(await read()).toBe("new-token");
    });
    it.each(["source", "target", "key", "clear"])("rejects a stale sync when %s changes while reading", async mode => {
        const {service,values}=fixture("existing", "key");
        let source="old-token", release;
        service.getTokenFrom123Pan=()=>({token:source,source:"authorToken"});
        service.getStoredToken=()=>new Promise(resolve=>release=resolve);
        const pending=service.syncTokenOnce();
        if(mode==="source") source="";
        if(mode==="target") values.set(service.tokenKey,"new-target");
        if(mode==="key") values.set(`${service.tokenKey}_secret`,"new-key");
        if(mode==="clear") service.clearStoredToken("test");
        const expected=values.get(service.tokenKey);
        release("existing"); await pending;
        expect(values.get(service.tokenKey)).toBe(expected);
    });
    it("keeps legacy plaintext readable", async () => expect(await fixture("legacy-token", "").service.getStoredToken()).toBe("legacy-token"));
    it("decrypts the existing marked format", async () => {
        const value = "AES:" + await encryptData("token", "correct");
        expect(await fixture(value, "correct").service.getStoredToken()).toBe("token");
    });
    it.each(["wrong", ""])("rejects marked ciphertext with key %j without deleting its source", async secret => {
        const value = "AES:" + await encryptData("token", "correct"), {service, values} = fixture(value, secret);
        expect(await service.getStoredToken()).toBe("");
        expect(values.get(service.tokenKey)).toBe(value);
    });
    it("rejects damaged ciphertext", async () => expect(await fixture("AES:damaged", "key").service.getStoredToken()).toBe(""));
    it.each(["fresh-token", "AES:real-source-token"])("recovers invalid stored authorization through source sync: %s", async token => {
        const {service,values}=fixture("AES:damaged", "key"), notify=service.notifications.info;
        service.getTokenFrom123Pan=()=>({token,source:"authorToken"});
        await service.syncTokenOnce();
        expect(await service.getStoredToken()).toBe(token);
        expect(values.get(service.tokenKey)).not.toBe(token);
        const encrypted=values.get(service.tokenKey);
        await service.syncTokenOnce();
        expect(values.get(service.tokenKey)).toBe(encrypted);
        expect(notify).toHaveBeenCalledOnce();
        expect(notify.mock.calls[0][0]).not.toContain(token);
    });
});
