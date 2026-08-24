// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { CACHE, PORT, SERVICE } from "../../contracts/tokens.js";

export default defineIntegration({
    id: "av123", trustClass: "builtin-public", hosts: ["123av.com"],
    capabilities: ["movie.search", "movie.detail", "movie.images", "actor.lookup"],
    requires: [PORT.http, SERVICE.urlPolicy], createClient: () => Object.freeze({ id: "av123" }),
    createAdapter: () => Object.freeze({ contracts: ["MovieRef", "MovieDetail"] }), createHostAdapter: null,
    cachePolicy: { "movie.detail": CACHE.externalDetail }, quality: "silver",
});
