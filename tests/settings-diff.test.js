import { describe, expect, it, vi } from "vitest";
import { SettingsService } from "../src/services/settings-service.js";

function createStorage(initial = {}) {
    const value = { setting: { ...initial } };
    return {
        async get(key) { return value[key]; },
        async set(key, next) { value[key] = next; },
        read() { return value.setting; },
    };
}

function collectEvents(service) {
    const events = [];
    service.addEventListener("settings.changed", (event) => events.push(event.detail));
    return events;
}

describe("SettingsService actual-change diff", () => {
    it("does not emit settings.changed when a patch rewrites the same value", async () => {
        const storage = createStorage({ autoPage: "yes" });
        const service = new SettingsService(storage);
        await service.load();
        const events = collectEvents(service);
        await service.set("autoPage", "yes");
        expect(events).toEqual([]);
        expect(storage.read().autoPage).toBe("yes");
    });

    it("emits only the actually changed names for a multi-key patch", async () => {
        const storage = createStorage({ a: 1, b: 2 });
        const service = new SettingsService(storage);
        await service.load();
        const events = collectEvents(service);
        await service.patch({ a: 1, b: 9, c: 3 });
        expect(events).toHaveLength(1);
        expect(events[0].names).toEqual(["b", "c"]);
        expect(events[0].name).toBeNull();
    });

    it("emits a single-key event with name and value", async () => {
        const storage = createStorage({});
        const service = new SettingsService(storage);
        await service.load();
        const events = collectEvents(service);
        await service.set("themeMode", "dark");
        expect(events).toHaveLength(1);
        expect(events[0].name).toBe("themeMode");
        expect(events[0].value).toBe("dark");
    });

    it("replace reports keys removed from the stored object", async () => {
        const storage = createStorage({ keep: 1, drop: 2 });
        const service = new SettingsService(storage);
        await service.load();
        const events = collectEvents(service);
        await service.replace({ keep: 1 });
        expect(events).toHaveLength(1);
        expect(events[0].names).toEqual(["drop"]);
    });

    it("refresh() fires for a deleted key and for additions", async () => {
        const storage = createStorage({ x: 1 });
        const service = new SettingsService(storage);
        await service.load();
        const events = collectEvents(service);
        delete storage.read().x;
        storage.read().y = 2;
        await service.refresh();
        expect(events).toHaveLength(1);
        expect([...events[0].names].sort()).toEqual(["x", "y"]);
    });

    it("refresh() stays silent when nothing changed", async () => {
        const storage = createStorage({ x: 1 });
        const service = new SettingsService(storage);
        await service.load();
        const events = collectEvents(service);
        await service.refresh();
        expect(events).toEqual([]);
    });

    it("still validates every submitted value before enqueue", async () => {
        const storage = createStorage({});
        const service = new SettingsService(storage, { validators: { themeMode: (value) => ["light", "dark"].includes(value) } });
        await service.load();
        await expect(service.set("themeMode", "neon")).rejects.toThrow(/Invalid setting/);
        await service.set("themeMode", "dark");
        expect(storage.read().themeMode).toBe("dark");
    });

    it("afterPersist receives actual changed names", async () => {
        const storage = createStorage({ a: 1 });
        const afterPersist = vi.fn(async () => {});
        const service = new SettingsService(storage, { afterPersist });
        await service.load();
        await service.patch({ a: 1, b: 2 });
        expect(afterPersist).toHaveBeenCalledTimes(1);
        expect(afterPersist.mock.calls[0][1]).toEqual(["b"]);
    });
});

describe("SettingsService transaction primitive", () => {
    it("update() merges onto a fresh base and reports true union diff including deletes", async () => {
        const storage = createStorage({ a: 1, b: 2, c: 3 });
        const service = new SettingsService(storage);
        await service.load();
        const events = collectEvents(service);
        const snapshot = await service.update((draft) => {
            draft.b = 9;
            delete draft.c;
        });
        expect(snapshot).toEqual({ a: 1, b: 9 });
        expect(storage.read()).toEqual({ a: 1, b: 9 });
        expect(events).toHaveLength(1);
        expect([...events[0].names].sort()).toEqual(["b", "c"]);
    });

    it("unset() deletes legacy keys and emits real diff", async () => {
        const storage = createStorage({ enableScreenSvg: "yes", keep: 1 });
        const service = new SettingsService(storage);
        await service.load();
        const events = collectEvents(service);
        await service.unset("enableScreenSvg");
        expect(service.snapshot()).toEqual({ keep: 1 });
        expect(events).toHaveLength(1);
        expect(events[0].names).toEqual(["enableScreenSvg"]);
    });

    it("afterPersist rejection does not reject the commit and does not break the chain", async () => {
        const storage = createStorage({ a: 1 });
        const afterPersist = vi.fn(async () => { throw new Error("broadcast failed"); });
        const service = new SettingsService(storage, { afterPersist });
        await service.load();
        const events = collectEvents(service);
        await expect(service.set("a", 2)).resolves.toBeTruthy();
        expect(service.snapshot().a).toBe(2);
        expect(storage.read().a).toBe(2);
        expect(events).toHaveLength(1);
        await expect(service.set("b", 3)).resolves.toBeTruthy();
        expect(service.snapshot().b).toBe(3);
    });

    it("waitForIdle() waits for queued writes", async () => {
        const storage = createStorage({ a: 1 });
        const service = new SettingsService(storage);
        await service.load();
        const pending = service.set("a", 2);
        await service.waitForIdle();
        await expect(pending).resolves.toBeTruthy();
        expect(service.snapshot().a).toBe(2);
    });
});
