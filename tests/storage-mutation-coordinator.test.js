import { describe, expect, it } from "vitest";
import { STORAGE_MUTATION_LOCK, StorageMutationCoordinator } from "../src/core/storage-mutation-coordinator.js";

function createFakeLocks() {
    const queues = new Map();
    return {
        names: [],
        request(name, callback) {
            this.names.push(name);
            const previous = queues.get(name) || Promise.resolve();
            const run = previous.then(callback);
            queues.set(name, run.then(() => undefined, () => undefined));
            return run;
        },
    };
}

describe("StorageMutationCoordinator", () => {
    it("serializes all operations through the versioned cross-tab lock", async () => {
        const locks = createFakeLocks(), coordinator = new StorageMutationCoordinator({ lockManager: locks });
        let active = 0;
        let maximum = 0;
        const run = (value) => coordinator.runExclusive(async () => {
            active++;
            maximum = Math.max(maximum, active);
            await Promise.resolve();
            active--;
            return value;
        });

        await expect(Promise.all([ run("first"), run("second") ])).resolves.toEqual([ "first", "second" ]);
        expect(maximum).toBe(1);
        expect(locks.names).toEqual([ STORAGE_MUTATION_LOCK, STORAGE_MUTATION_LOCK ]);
    });

    it("keeps the fallback queue usable after a failed operation", async () => {
        const coordinator = new StorageMutationCoordinator({ lockManager: null });
        await expect(coordinator.runExclusive(async () => { throw new Error("failed mutation"); })).rejects.toThrow("failed mutation");
        await expect(coordinator.runExclusive(() => "next mutation")).resolves.toBe("next mutation");
    });

    it("serializes concurrent fallback operations in one tab", async () => {
        const coordinator = new StorageMutationCoordinator({ lockManager: null });
        let active = 0, maximum = 0, release;
        const gate = new Promise((resolve) => { release = resolve; });
        const first = coordinator.runExclusive(async () => {
            active += 1, maximum = Math.max(maximum, active);
            await gate;
            active -= 1;
            return "first";
        });
        await Promise.resolve();
        const second = coordinator.runExclusive(async () => {
            active += 1, maximum = Math.max(maximum, active);
            active -= 1;
            return "second";
        });
        expect(active).toBe(1);
        release();
        await expect(Promise.all([ first, second ])).resolves.toEqual([ "first", "second" ]);
        expect(maximum).toBe(1);
    });

});
