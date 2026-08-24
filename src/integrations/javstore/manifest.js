// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { CACHE, PORT, SERVICE } from "../../contracts/tokens.js";

export default defineIntegration({
    id: "javstore", trustClass: "builtin-public", hosts: ["javstore.net"],
    capabilities: ["movie.images"], requires: [PORT.http, SERVICE.urlPolicy],
    createClient: () => Object.freeze({ id: "javstore" }), createAdapter: () => Object.freeze({ contracts: ["Screenshot"] }),
    createHostAdapter: null, cachePolicy: { "movie.images": CACHE.externalDetail }, quality: "silver",
});
