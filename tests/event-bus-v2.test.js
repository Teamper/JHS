import { JhsEventBus } from "../src/core/event-bus.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeBroadcastChannel {
    static channels = [];
    constructor(name) { this.name = name; this.handlers = []; FakeBroadcastChannel.channels.push(this); }
    addEventListener(type, handler) { "message" === type && this.handlers.push(handler); }
    postMessage(data) { FakeBroadcastChannel.channels.filter(channel => channel.name === this.name).forEach(channel => channel.handlers.forEach(handler => handler({ data }))); }
}

beforeEach(() => {
    FakeBroadcastChannel.channels = [];
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
});
afterEach(() => vi.unstubAllGlobals());

describe("precise event bus", () => {
    it("dispatches locally and remotely once without rebroadcast", async () => {
        const first = new JhsEventBus("test"), second = new JhsEventBus("test"), local = vi.fn(), remote = vi.fn();
        first.on("car-state-changed", local), second.on("car-state-changed", remote);
        await first.emit("car-state-changed", { carNums: ["ABC-123"] });
        await Promise.resolve();
        expect(local).toHaveBeenCalledTimes(1);
        expect(remote).toHaveBeenCalledTimes(1);
    });

    it("keeps DOM lifecycle events local when broadcast is false", async () => {
        const first = new JhsEventBus("test-local"), second = new JhsEventBus("test-local"), remote = vi.fn();
        second.on("list-items-added", remote);
        await first.emit("list-items-added", { items: [{}] }, { broadcast: false });
        expect(remote).not.toHaveBeenCalled();
    });

    it("deduplicates repeated remote envelopes and ignores its own origin", async () => {
        const bus = new JhsEventBus("dedupe"), handler = vi.fn(), event = { eventId: "same", originId: "other", type: "settings-changed", payload: {}, timestamp: Date.now() };
        bus.on("settings-changed", handler);
        await bus._receive(event), await bus._receive(event), await bus._receive({ ...event, eventId: "self", originId: bus.originId });
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("isolates a throwing local listener and still broadcasts to other tabs", async () => {
        const first = new JhsEventBus("iso-local"), second = new JhsEventBus("iso-local");
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
        const first = new JhsEventBus("iso-remote"), second = new JhsEventBus("iso-remote");
        const bad = vi.fn(async () => { throw new Error("boom"); }), good = vi.fn();
        second.errorReporter = () => {};
        second.on("car-state-changed", bad), second.on("car-state-changed", good);
        await first.emit("car-state-changed", { carNums: [] });
        await Promise.resolve();
        expect(bad).toHaveBeenCalledTimes(1);
        expect(good).toHaveBeenCalledTimes(1);
    });
});
