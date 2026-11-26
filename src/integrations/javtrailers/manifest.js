// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
export default defineIntegration({ id: "javtrailers", trustClass: "builtin-public", hosts: ["javtrailers.com"], capabilities: ["movie.preview"], requires: [], createClient: () => Object.freeze({ id: "javtrailers" }), createAdapter: () => Object.freeze({ contracts: ["MoviePreview"] }), createHostAdapter: null, cachePolicy: "none", quality: "bronze" });
