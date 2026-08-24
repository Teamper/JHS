// @ts-check

import { defineIntegration } from "../../contracts/manifests.js";
import { CACHE, PORT, SERVICE } from "../../contracts/tokens.js";

export default defineIntegration({
    id: "javbus", trustClass: "builtin-public", hosts: ["javbus.com"],
    capabilities: ["movie.search", "movie.detail", "movie.images"],
    requires: [PORT.http, SERVICE.urlPolicy], createClient: () => Object.freeze({ id: "javbus" }),
    createAdapter: () => Object.freeze({ contracts: ["MovieRef", "MovieDetail"] }), createHostAdapter: null,
    cachePolicy: { "movie.detail": CACHE.externalDetail }, quality: "silver",
});
