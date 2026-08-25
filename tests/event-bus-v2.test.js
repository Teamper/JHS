import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readTestFile(join(import.meta.dirname, "../src/core/event-bus.js"), "utf8");

class FakeBroadcastChannel {
    static channels = [];
    constructor(name) { this.name = name; this.handlers = []; FakeBroadcastChannel.channels.push(this); }
    addEventListener(type, handler) { "message" === type && this.handlers.push(handler); }
    postMessage(data) { FakeBroadcastChannel.channels.filter(channel => channel.name === this.name).forEach(channel => channel.handlers.forEach(handler => handler({ data }))); }
}

function loadBus() {
    const context = vm.createContext({ BroadcastChannel: FakeBroadcastChannel, crypto: { randomUUID: vi.fn().mockReturnValueOnce("tab-a").mockReturnValueOnce("tab-b").mockReturnValue("event-1") }, Date, Math, Map, Set, window: {}, unsafeWindow: {} }), end = source.indexOf("let jhsEventBus");
    vm.runInContext(`${source.slice(0, end)}; globalThis.Bus = JhsEventBus;`, context);
    return context.Bus;
}

describe("precise event bus", () => {
    it("dispatches locally and remotely once without rebroadcast", async () => {
        FakeBroadcastChannel.channels = [];
        const Bus = loadBus(), first = new Bus("test"), second = new Bus("test"), local = vi.fn(), remote = vi.fn();
        first.on("car-state-changed", local), second.on("car-state-changed", remote);
        await first.emit("car-state-changed", { carNums: ["ABC-123"] });
        await Promise.resolve();
        expect(local).toHaveBeenCalledTimes(1);
        expect(remote).toHaveBeenCalledTimes(1);
    });

    it("keeps DOM lifecycle events local when broadcast is false", async () => {
        FakeBroadcastChannel.channels = [];
        const Bus = loadBus(), first = new Bus("test-local"), second = new Bus("test-local"), remote = vi.fn();
        second.on("list-items-added", remote);
        await first.emit("list-items-added", { items: [{}] }, { broadcast: false });
        expect(remote).not.toHaveBeenCalled();
    });

    it("deduplicates repeated remote envelopes and ignores its own origin", async () => {
        FakeBroadcastChannel.channels = [];
        const Bus = loadBus(), bus = new Bus("dedupe"), handler = vi.fn(), event = { eventId: "same", originId: "other", type: "settings-changed", payload: {}, timestamp: Date.now() };
        bus.on("settings-changed", handler);
        await bus._receive(event), await bus._receive(event), await bus._receive({ ...event, eventId: "self", originId: bus.originId });
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("isolates a throwing local listener and still broadcasts to other tabs", async () => {
        FakeBroadcastChannel.channels = [];
        const Bus = loadBus(), first = new Bus("iso-local"), second = new Bus("iso-local");
        const bad = vi.fn(async () => { throw new Error("boom"); }), good = vi.fn(), remote = vi.fn(), errors = [];
        first.errorReporter = (error) => errors.push(error);
        first.on("settings-changed", bad), first.on("settings-changed", good), second.on("settings-changed", remote);
        await first.emit("settings-changed", { source: "legacy" });
        await Promise.resolve();
        expect(bad).toHaveBeenCalledTimes(1);
        expect(good).toHaveBeenCalledTimes(1);
        expect(remote).toHaveBeenCalledTimes(1);
        expect(errors).toHaveLength(1);
    });

    it("isolates throwing remote listeners from each other", async () => {
        FakeBroadcastChannel.channels = [];
        const Bus = loadBus(), first = new Bus("iso-remote"), second = new Bus("iso-remote");
        const bad = vi.fn(async () => { throw new Error("boom"); }), good = vi.fn();
        second.errorReporter = () => {};
        second.on("car-state-changed", bad), second.on("car-state-changed", good);
        await first.emit("car-state-changed", { carNums: [] });
        await Promise.resolve();
        expect(bad).toHaveBeenCalledTimes(1);
        expect(good).toHaveBeenCalledTimes(1);
    });
});
