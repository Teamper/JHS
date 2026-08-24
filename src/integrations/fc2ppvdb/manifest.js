// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { CACHE, PORT, SERVICE } from "../../contracts/tokens.js";
export default defineIntegration({ id: "fc2ppvdb", trustClass: "builtin-public", hosts: ["fc2ppvdb.com"], capabilities: ["movie.detail", "movie.images"], requires: [PORT.http, SERVICE.urlPolicy], createClient: () => Object.freeze({ id: "fc2ppvdb" }), createAdapter: () => Object.freeze({ contracts: ["MovieDetail"] }), createHostAdapter: null, cachePolicy: { "movie.detail": CACHE.externalDetail }, quality: "silver" });
