import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readDevIdentity, verifyDevDelivery } from "../scripts/check-dev-delivery.mjs";
import { buildUserscript, repoRoot } from "../scripts/build.mjs";
import { createDevTransforms } from "../scripts/dev-metadata.mjs";

describe("Dev delivery identity", () => {
    it("takes the identity from the delivery rather than today's timestamp", () => {
        expect(readDevIdentity('// @version      7.0.0-dev.202610261234\n// @description  JHS 7.0 migration build 50fe94aea60d.dirty\ndocument.documentElement.setAttribute("data-jhs-dev-build", "7.0.0-dev.202610261234|50fe94aea60d.dirty")')).toEqual({ version: "7.0.0-dev.202610261234", buildId: "50fe94aea60d.dirty" });
    });
    it("rejects a missing or mismatched runtime marker", () => {
        expect(() => readDevIdentity('// @version 7.0.0-dev.202610261234\n// @description JHS 7.0 migration build 50fe94aea60d')).toThrow();
    });
    it("detects a changed bundle body even when all identity metadata still matches", async () => {
        const { output } = await buildUserscript({ outputPaths: [], ...createDevTransforms("7.0.0-dev.202610261234", "50fe94aea60d.dirty") });
        const parent = resolve(repoRoot, "output"); await mkdir(parent, { recursive: true });
        const folder = await mkdtemp(resolve(parent, "delivery-check-")), file = resolve(folder, "candidate.user.js");
        await writeFile(file, output + "\n/* body changed */");
        await expect(verifyDevDelivery(file)).rejects.toThrow("交付与当前源码不一致");
    }, 15000);
});
