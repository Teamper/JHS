import { expect, it, vi } from "vitest";
import { ActressInfoService } from "../src/services/actress-info-service.js";
import { CacheService } from "../src/services/cache-service.js";

it("normalizes aliases and caches actress information", async () => {
    const lookup = vi.fn(async name => ({ name }));
    const adapter = { lookup, profileUrl: name => `profile:${name}` };
    const integrations = { list: () => [{ id: "wikipedia" }], getAdapter: () => adapter };
    const service = new ActressInfoService(integrations, new CacheService());
    await expect(service.lookup("三上悠亞")).resolves.toEqual({ name: "三上悠亜" });
    await expect(service.lookup("三上悠亞")).resolves.toEqual({ name: "三上悠亜" });
    expect(lookup).toHaveBeenCalledOnce();
    expect(service.profileUrl("A")).toBe("profile:A");
});
