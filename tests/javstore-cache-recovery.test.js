// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import manifest, { createJavStoreAdapter } from "../src/integrations/javstore/manifest.js";
import { createIntegrationRequestFacade } from "../src/app/integration-registry.js";
import { HttpService } from "../src/services/http-service.js";
import { ExternalUrlPolicy } from "../src/services/external-url-policy.js";
import { CacheService } from "../src/services/cache-service.js";

const search = '<main><div class="grid"><a href="/ABC-123-pn.html">ABC-123</a></div></main>';
const detail = url => `<main><a href="https://img.javstore.net/${url}">CLICK HERE!</a></main>`;
function chain(response) {
    const values = new Map(), storage = { get: async key => values.get(key), set: async (key, value) => { values.set(key, value); }, remove: async key => { values.delete(key); }, keys: async () => [...values.keys()] };
    const request = vi.fn(async options => ({ status:200, data:await response(options.url), finalUrl:options.url }));
    const cache = new CacheService({ storage }), http = new HttpService({ request }, new ExternalUrlPolicy(), { cache });
    const facade = createIntegrationRequestFacade(http, manifest);
    return { adapter:createJavStoreAdapter(facade), facade, request, values };
}

it.each(["search", "detail"])("recovers after an empty %s response without keeping it for seven days", async phase => {
    let recovered = false;
    const { adapter, request, values } = chain(url => url.includes("/search?") ? recovered || phase !== "search" ? search : '<main>No results</main>' : recovered ? detail("ABC-123_s.jpg") : '<main>No preview</main>');
    expect(await adapter.getImages({carNum:"ABC-123"})).toEqual([]);
    expect(values.size).toBe(phase === "search" ? 0 : 1);
    recovered = true;
    expect(await adapter.getImages({carNum:"ABC-123"})).toEqual([{url:"https://img.javstore.net/ABC-123_s.jpg",providerId:"javstore"}]);
    expect(request).toHaveBeenCalledTimes(3);
    await adapter.getImages({carNum:"ABC-123"});
    expect(request).toHaveBeenCalledTimes(3);
});

it("explicit retry refreshes cached search and detail while subsequent ordinary reads use the new result", async () => {
    let image = "ABC-123-old.jpg";
    const { adapter, request } = chain(url => url.includes("/search?") ? search : detail(image));
    await adapter.getImages({carNum:"ABC-123"});
    image = "ABC-123-new.jpg";
    expect((await adapter.getImages({carNum:"ABC-123"}, {refreshCache:true}))[0].url).toContain("new.jpg");
    expect(request).toHaveBeenCalledTimes(4);
    expect((await adapter.getImages({carNum:"ABC-123"}))[0].url).toContain("new.jpg");
    expect(request).toHaveBeenCalledTimes(4);
});

it("revalidates invalid HTML persisted by an older build before returning it", async () => {
    let recovered = false;
    const {adapter,facade,request,values} = chain(url => !recovered ? '<main>No results</main>' : url.includes('/search?') ? search : detail("ABC-123_s.jpg"));
    await facade.request({providerId:"javstore",capability:"movie.images",method:"GET",url:adapter.getSearchUrl({carNum:"ABC-123"}),responseType:"text",urlPolicy:{trustClass:"builtin-public",hosts:["javstore.net"]}});
    expect(values.size).toBe(1);
    recovered = true;
    expect((await adapter.getImages({carNum:"ABC-123"}))[0].url).toContain("ABC-123_s.jpg");
    expect(request).toHaveBeenCalledTimes(3);
});
