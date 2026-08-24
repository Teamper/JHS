// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
export default defineIntegration({ id: "javtrailers", trustClass: "builtin-public", hosts: ["javtrailers.com"], capabilities: ["movie.preview"], requires: [PORT.http, SERVICE.urlPolicy], createClient: () => Object.freeze({ id: "javtrailers" }), createAdapter: () => Object.freeze({ contracts: ["MoviePreview"] }), createHostAdapter: null, cachePolicy: "none", quality: "bronze" });
