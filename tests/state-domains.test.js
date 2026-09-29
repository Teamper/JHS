import { describe, expect, it } from "vitest";
import { createStateDomainRegistry, STATE_DOMAIN_NAMES } from "../src/core/state-domains.js";

describe("legacy-compatible state domains", () => {
    it("maps service domains to the 6.5.1 IndexedDB keys", async () => {
        const data = new Map(), storage = {
            car_list_key: "car_list",
            favorite_actresses_key: "favorite_actresses",
            forage: {
                async getItem(key) { return data.get(key); },
                async setItem(key, value) { data.set(key, value); },
            },
        };
        const domains = createStateDomainRegistry(storage);
        await domains.carList.write([ { carNum: "ABC-1" } ]);
        await domains.actresses.write([ { starId: "star-1" } ]);
        await domains.decisions.write({ "ABC-1": { action: "dismissed" } });

        expect(STATE_DOMAIN_NAMES).toEqual([ "carList", "actresses", "decisions", "activity", "offlineHistory" ]);
        expect([...data.keys()]).toEqual([ "car_list", "favorite_actresses", "new_video_decisions" ]);
        expect(await domains.decisions.read()).toEqual({ "ABC-1": { action: "dismissed" } });
    });
});
