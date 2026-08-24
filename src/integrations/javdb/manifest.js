// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { CACHE, PORT, SERVICE } from "../../contracts/tokens.js";

export default defineIntegration({
    id: "javdb", trustClass: "builtin-public", hosts: ["javdb.com"],
    capabilities: ["movie.search", "movie.detail", "movie.state", "actor.lookup"],
    requires: [PORT.http, SERVICE.urlPolicy], createClient: () => Object.freeze({ id: "javdb" }),
    createAdapter: () => Object.freeze({ contracts: ["MovieRef", "MovieDetail", "Actor"] }), createHostAdapter: null,
    cachePolicy: { "movie.detail": CACHE.externalDetail }, quality: "silver",
});
