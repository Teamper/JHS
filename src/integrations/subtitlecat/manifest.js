// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
export default defineIntegration({ id: "subtitlecat", trustClass: "builtin-public", hosts: ["subtitlecat.com"], capabilities: ["subtitle.search"], requires: [PORT.http, SERVICE.urlPolicy], createClient: () => Object.freeze({ id: "subtitlecat" }), createAdapter: () => Object.freeze({ contracts: ["Subtitle"] }), createHostAdapter: null, cachePolicy: "none", quality: "bronze" });
