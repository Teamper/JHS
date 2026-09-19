import { describe, expect, it } from "vitest";
import { mergePortableSettings, selectPortableSettings } from "../src/core/migration.js";

describe("portable backup credential policy", () => {
    it("excludes installation-local trust and WebDAV credentials without mutating settings", () => {
        const settings = { themeMode: "dark", webDavUrl: "https://dav.example", webDavPassword: "AES:source", trustedLocalOrigins: ["http://127.0.0.1:5244"] };
        expect(selectPortableSettings(settings)).toEqual({ themeMode: "dark" });
        expect(settings).toHaveProperty("webDavPassword", "AES:source");
    });

    it("keeps the destination installation's local fields during restore", () => {
        const imported = { themeMode: "dark", webDavUrl: "https://dav-a.example", webDavPassword: "AES:source", trustedLocalOrigins: ["http://source.local"] };
        expect(mergePortableSettings({ webDavUrl: "https://dav-a.example", webDavPassword: "AES:destination", trustedLocalOrigins: ["http://destination.local"] }, imported)).toEqual({
            themeMode: "dark", webDavUrl: "https://dav-a.example", webDavPassword: "AES:destination", trustedLocalOrigins: ["http://destination.local"],
        });
    });

    it("does not introduce a credential when the destination has none", () => {
        expect(mergePortableSettings({}, { webDavPassword: "AES:source", themeMode: "light" })).toEqual({ themeMode: "light" });
    });
});
