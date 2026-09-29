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
    it("serializes every mutation through one stable cross-tab lock", async () => {
        const locks = createFakeLocks(), coordinator = new StorageMutationCoordinator({ lockManager: locks });
        let active = 0, maximum = 0;
        const run = async (value) => coordinator.runExclusive(async () => {
            active++;
            maximum = Math.max(maximum, active);
            await new Promise((resolve) => setTimeout(resolve, 1));
            active--;
            return value;
        });

        await expect(Promise.all([ run("first"), run("second"), run("third") ])).resolves.toEqual([ "first", "second", "third" ]);
        expect(maximum).toBe(1);
        expect(locks.names).toEqual([ STORAGE_MUTATION_LOCK, STORAGE_MUTATION_LOCK, STORAGE_MUTATION_LOCK ]);
    });

    it("keeps the in-page fallback queue usable after a rejected mutation", async () => {
        const coordinator = new StorageMutationCoordinator({ lockManager: null });
        await expect(coordinator.runExclusive(async () => { throw new Error("injected write failure"); })).rejects.toThrow("injected write failure");
        await expect(coordinator.runExclusive(() => "recovered")).resolves.toBe("recovered");
    });
});
