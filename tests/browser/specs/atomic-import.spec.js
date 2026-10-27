import { expect, test } from "@playwright/test";
import { build } from "../../../node_modules/esbuild/lib/main.js";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const foragePath = fileURLToPath(new URL("../node_modules/localforage/dist/localforage.min.js", import.meta.url));
const source = await readFile(new URL("../../../src/platform/userscript/indexeddb-storage-adapter.js", import.meta.url), "utf8");
const bundled = await build({ stdin: { contents: source.replaceAll("export ", "") + "\nwindow.atomic = {readAtomicSnapshot, commitAtomicBatch};", loader: "js" }, bundle: true, write: false, format: "iife" });

async function prepare(context, page) {
    await fulfillHostFixtures(context); await page.goto("https://javdb.com/");
    await page.addScriptTag({ path: foragePath });
    await page.addScriptTag({ content: bundled.outputFiles[0].text });
    await page.evaluate(async () => {
        window.forage = localforage.createInstance({ name: "JAV-JHS", storeName: "appData", driver: localforage.INDEXEDDB });
        await forage.setItem("car_list", ["old"]); await forage.setItem("setting", { old: true }); await forage.setItem("data_version", 3);
        window.expected = await atomic.readAtomicSnapshot(forage, ["car_list", "setting", "data_version"]);
    });
}
test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop-wide", "native IDB transaction owns one browser project"));

test("one native transaction commits all domains and survives a legacy localforage reopen", async ({ context, page }) => {
    await prepare(context, page);
    await page.evaluate(() => atomic.commitAtomicBatch(forage, { expected, puts: { car_list: ["new"], setting: { new: true } }, deletes: [] }));
    await page.reload(); await page.addScriptTag({ path: foragePath });
    expect(await page.evaluate(async () => {
        const legacy = localforage.createInstance({ name: "JAV-JHS", storeName: "appData" });
        return Promise.all([legacy.getItem("car_list"), legacy.getItem("setting"), legacy.getItem("data_version")]);
    })).toEqual([["new"], { new: true }, 3]);
});

for (const failAt of [1, 2, 3]) test(`abort queued write ${failAt} leaves the complete old database`, async ({ context, page }) => {
    await prepare(context, page);
    const result = await page.evaluate(async failAt => {
        const put = IDBObjectStore.prototype.put; let writes = 0;
        IDBObjectStore.prototype.put = function (...args) { if (++writes === failAt) throw new DOMException("injected quota failure", "QuotaExceededError"); return put.apply(this, args); };
        try { await atomic.commitAtomicBatch(forage, { expected, puts: { car_list: ["new"], setting: { new: true }, data_version: 3 }, deletes: [] }); return "unexpected"; }
        catch (error) { return error.name; }
        finally { IDBObjectStore.prototype.put = put; }
    }, failAt);
    expect(result).toBe("QuotaExceededError");
    expect(await page.evaluate(() => atomic.readAtomicSnapshot(forage, Object.keys(expected)))).toEqual({ car_list: { exists: true, value: ["old"] }, setting: { exists: true, value: { old: true } }, data_version: { exists: true, value: 3 } });
});

test("another tab changing the baseline aborts without publishing imported domains", async ({ context, page }) => {
    await prepare(context, page);
    const other = await context.newPage(); await other.goto("https://javdb.com/"); await other.addScriptTag({ path: foragePath });
    await other.evaluate(() => localforage.createInstance({ name: "JAV-JHS", storeName: "appData" }).setItem("setting", { otherTab: true }));
    expect(await page.evaluate(async () => { try { await atomic.commitAtomicBatch(forage, { expected, puts: { car_list: ["new"] }, deletes: [] }); } catch (error) { return error.code; } })).toBe("ATOMIC_IMPORT_CONFLICT");
    expect(await page.evaluate(() => forage.getItem("car_list"))).toEqual(["old"]);
});

test("real browser quota failure leaves every business domain unchanged", async ({ context, page }) => {
    const cdp = await context.newCDPSession(page);
    // Set the quota before opening IDB so an earlier transaction cannot reuse
    // a previously granted backend space reservation.
    await cdp.send("Storage.overrideQuotaForOrigin", { origin: "https://javdb.com", quotaSize: 1024 * 1024 });
    try {
        await prepare(context, page);
        expect(await page.evaluate(async () => {
            const bytes = new Uint8Array(4 * 1024 * 1024);
            for (let offset = 0; offset < bytes.length; offset += 65536) crypto.getRandomValues(bytes.subarray(offset, offset + 65536));
            try { await atomic.commitAtomicBatch(forage, { expected, puts: { setting: { new: true }, car_list: [{ bytes }] }, deletes: [] }); return "unexpected"; }
            catch (error) { return error.name; }
        })).toBe("QuotaExceededError");
        expect(await page.evaluate(() => Promise.all([forage.getItem("car_list"), forage.getItem("setting")]))).toEqual([["old"], { old: true }]);
    } finally { await cdp.send("Storage.overrideQuotaForOrigin", { origin: "https://javdb.com" }); }
});

test("unsupported drivers and an already cancelled import never queue business writes", async ({ context, page }) => {
    await prepare(context, page);
    expect(await page.evaluate(async () => {
        try { await atomic.commitAtomicBatch({ ready: async () => {}, driver: () => "localStorageWrapper" }, { expected, puts: { car_list: ["new"] }, deletes: [] }); }
        catch (error) { return error.code; }
    })).toBe("ATOMIC_IMPORT_UNAVAILABLE");
    expect(await page.evaluate(async () => {
        const cancel = new AbortController(); cancel.abort();
        try { await atomic.commitAtomicBatch(forage, { expected, puts: { car_list: ["new"] }, deletes: [], signal: cancel.signal }); }
        catch (error) { return error.name; }
    })).toBe("AbortError");
    expect(await page.evaluate(() => forage.getItem("car_list"))).toEqual(["old"]);
});

test("closing a page during pending writes rolls back for an old-reader tab", async ({ context, page }) => {
    await prepare(context, page);
    await page.evaluate(() => {
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
            const request = put.apply(this, args), store = this;
            request.addEventListener("success", () => { window.writeStarted = true; const hold = () => store.get("car_list").addEventListener("success", hold); hold(); });
            return request;
        };
        void atomic.commitAtomicBatch(forage, { expected, puts: { car_list: ["new"], setting: { new: true } }, deletes: [] }).catch(() => {});
    });
    await expect.poll(() => page.evaluate(() => window.writeStarted)).toBe(true);
    await page.close();
    const reader = await context.newPage(); await reader.goto("https://javdb.com/"); await reader.addScriptTag({ path: foragePath });
    expect(await reader.evaluate(async () => {
        const old = localforage.createInstance({ name: "JAV-JHS", storeName: "appData" });
        return Promise.all([old.getItem("car_list"), old.getItem("setting")]);
    })).toEqual([["old"], { old: true }]);
});

test("partial import produces exactly one pre-import snapshot and rejects a future backup", async ({ context, page }) => {
    await fulfillHostFixtures(context); await page.goto("https://javdb.com/"); await injectUserscriptRuntime(page);
    const result = await page.evaluate(async () => {
        const storage = window.storageManager;
        const backup = await storage.exportData();
        await storage.forage.setItem("car_list", [{ carNum: "OLD-123", url: "/v/old" }]);
        await storage.importData({ data_version: 3, car_list: [] });
        const snapshots = await storage.forage.getItem("snapshots");
        let future;
        try { await storage.importData({ ...backup, data_version: 9999 }); } catch (error) { future = error.message; }
        return { snapshots, future };
    });
    expect(result.snapshots.filter(item => item.type === "auto-import" || item.source === "auto-import")).toHaveLength(1);
    expect(result.future).toBeTruthy();
});

test("an older destination migrates in memory and commits the partial import as one database", async ({ context, page }) => {
    await fulfillHostFixtures(context); await page.goto("https://javdb.com/"); await injectUserscriptRuntime(page);
    const result = await page.evaluate(async () => {
        const storage = window.storageManager;
        await storage.forage.setItem("data_version", 1);
        await storage.forage.setItem("car_list", [{ carNum: "OLD-123", url: "/v/old", status: "favorite" }]);
        await storage.importData({ data_version: 1, blacklist: ["Keep actor"] });
        const legacy = localforage.createInstance({ name: "JAV-JHS", storeName: "appData" });
        return { version: await legacy.getItem("data_version"), cars: await legacy.getItem("car_list"), blacklist: await legacy.getItem("blacklist") };
    });
    expect(result.version).toBe(3);
    expect(result.cars).toHaveLength(1); expect(result.cars[0].carNum).toBe("OLD-123");
    expect(result.blacklist).toEqual(["Keep actor"]);
    const stableSource = await readFile(new URL("../../../JHS.user.js", import.meta.url), "utf8");
    const legacyPage = await context.newPage(); await legacyPage.goto("https://javdb.com/");
    await injectUserscriptRuntime(legacyPage, { userscriptSource: stableSource, preserveStorage: true });
    expect(await legacyPage.evaluate(async () => ({ version: await window.storageManager.getDataVersion(), cars: await window.storageManager.getCarList(), blacklist: await window.storageManager.getBlacklist() }))).toEqual(result);
});
