// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";

export default defineIntegration({
    id: "host-list", trustClass: "builtin-public", hosts: ["javdb.com", "javbus.com"],
    capabilities: ["host.list.parse"], requires: [], createClient: () => Object.freeze({ id: "host-list" }),
    createAdapter: () => Object.freeze({ contracts: ["MovieRef"] }), createHostAdapter: null,
    cachePolicy: "none", quality: "bronze",
});
