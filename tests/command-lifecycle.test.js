// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { CommandRegistry } from "../src/app/command-registry.js";
import { FeatureRuntime } from "../src/app/feature-runtime.js";
import { DependencyContainer } from "../src/app/dependency-container.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";

function fixture(activate, providesCommands = ["owned.open"], startup = "on-command") {
    const commands = new CommandRegistry(), diagnostics = new DiagnosticsService();
    const runtime = new FeatureRuntime({ container: new DependencyContainer(), commands, diagnostics });
    runtime.register({ id: "owned", kind: "feature", disableable: true, sites: [], routes: [], startup, requires: [], contributes: ["owned.surface"], providesCommands, activate });
    return { runtime, commands, diagnostics };
}

describe("command activation ownership", () => {
    it("releases disposed closures and lazily activates exactly one replacement", async () => {
        let count = 0;
        const activate = vi.fn((_deps, { scope }) => ({ commands: { "owned.open": () => ({ instance: count, disposed: scope.disposed }) }, instance: ++count }));
        const { runtime, commands } = fixture(activate);
        await expect(commands.execute("owned.open")).resolves.toEqual({ instance: 1, disposed: false });
        const old = await runtime.activate("owned");
        old.dispose();
        expect(old.scope.disposed).toBe(true);
        const results = await Promise.all([commands.execute("owned.open"), commands.execute("owned.open")]);
        expect(results).toEqual([{ instance: 2, disposed: false }, { instance: 2, disposed: false }]);
        old.dispose();
        await expect(commands.execute("owned.open")).resolves.toEqual({ instance: 2, disposed: false });
        expect(activate).toHaveBeenCalledTimes(2);
        (await runtime.activate("owned")).dispose();
    });

    it("does not let an old release remove a newer registration of the same function", () => {
        const registry = new CommandRegistry(), handler = () => 1;
        registry.registerOwner("owned.open", "owned");
        const releaseOld = registry.registerHandler("owned.open", handler, "owned");
        releaseOld();
        const releaseNew = registry.registerHandler("owned.open", handler, "owned");
        releaseOld();
        expect(registry.handlers.has("owned.open")).toBe(true);
        releaseNew();
        releaseNew();
        expect(registry.handlers.has("owned.open")).toBe(false);
    });

    it.each(["missing", "conflict"])("rolls back partial activation when the second command is %s", async (failure) => {
        const dispose = vi.fn();
        let scope;
        const { runtime, commands } = fixture((_deps, api) => {
            scope = api.scope;
            return { dispose, commands: { "owned.open": () => 1, ...(failure === "conflict" ? { "owned.next": () => 2 } : {}) } };
        }, ["owned.open", "owned.next"]);
        const release = failure === "conflict" ? commands.registerHandler("owned.next", () => "other activation", "owned") : null;
        await expect(runtime.activate("owned")).rejects.toThrow(failure === "conflict" ? "Duplicate command handler" : "did not provide command");
        expect(commands.handlers.has("owned.open")).toBe(false);
        expect(scope.disposed).toBe(true);
        expect(dispose).toHaveBeenCalledOnce();
        expect(runtime.getActiveFeatureIds()).toEqual([]);
        if (release) {
            await expect(commands.execute("owned.next")).resolves.toBe("other activation");
            release();
        }
    });

    it("still releases commands, contribution scopes and bookkeeping when business disposal throws", async () => {
        const { runtime, commands } = fixture(() => ({ commands: { "owned.open": () => 1 }, dispose() { throw new Error("business cleanup"); } }));
        const activation = await runtime.activate("owned");
        const contribution = await runtime.getContributionScope("owned", "owned.surface", "owned.surface");
        expect(() => activation.dispose()).toThrow("business cleanup");
        expect(activation.scope.disposed).toBe(true);
        expect(contribution.disposed).toBe(true);
        expect(commands.handlers.has("owned.open")).toBe(false);
        expect(runtime.getActiveFeatureIds()).toEqual([]);
        expect(() => activation.dispose()).not.toThrow();
        await expect(commands.execute("owned.open")).resolves.toBe(1);
    });

    it("removes successful command activations during failed system startup rollback", async () => {
        const { runtime, commands } = fixture(() => ({ commands: { "owned.open": () => 1 } }), ["owned.open"], "eager");
        runtime.register({ id: "broken", kind: "system", disableable: false, sites: [], routes: [], startup: "eager", requires: [], contributes: [], providesCommands: [], activate() { throw new Error("system failed"); } });
        await expect(runtime.start()).rejects.toThrow("system failed");
        expect(commands.handlers.size).toBe(0);
        expect(runtime.getActiveFeatureIds()).toEqual([]);
    });
});
