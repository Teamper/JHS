// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { CACHE, PORT, SERVICE } from "../../contracts/tokens.js";
export default defineIntegration({ id: "dmm", trustClass: "builtin-public", hosts: ["dmm.co.jp"], capabilities: ["movie.preview"], requires: [PORT.http, SERVICE.urlPolicy], createClient: () => Object.freeze({ id: "dmm" }), createAdapter: () => Object.freeze({ contracts: ["MoviePreview"] }), createHostAdapter: null, cachePolicy: { "movie.preview": CACHE.externalDetail }, quality: "silver" });
