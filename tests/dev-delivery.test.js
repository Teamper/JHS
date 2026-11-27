import { beforeAll, describe, expect, it } from "vitest";
import { readDevIdentity, verifyDevBytes } from "../scripts/check-dev-delivery.mjs";
import { buildUserscript } from "../scripts/build.mjs";
import { createDevTransforms } from "../scripts/dev-metadata.mjs";

describe("Dev delivery identity", () => {
    it("takes the identity from the delivery rather than today's timestamp", () => {
        expect(readDevIdentity('// @version      7.0.0-dev.202610261234\n// @description  JHS 7.0 migration build 50fe94aea60d.dirty\ndocument.documentElement.setAttribute("data-jhs-dev-build", "7.0.0-dev.202610261234|50fe94aea60d.dirty")')).toEqual({ version: "7.0.0-dev.202610261234", buildId: "50fe94aea60d.dirty" });
    });
    it("rejects a missing or mismatched runtime marker", () => {
        expect(() => readDevIdentity('// @version 7.0.0-dev.202610261234\n// @description JHS 7.0 migration build 50fe94aea60d')).toThrow();
    });
});

describe("Dev delivery bytes", () => {
    let candidate;
    beforeAll(async () => {
        candidate = await buildUserscript({ outputPaths: [], ...createDevTransforms("7.0.0-dev.202610261234", "50fe94aea60d.dirty"), packStaticResources: true });
    }, 60000);

    it("detects a changed bundle body even when all identity metadata still matches", () => {
        const { output, analysis } = candidate;
        const changed = output + "\n/* body changed */";
        expect(readDevIdentity(changed)).toEqual(readDevIdentity(output));
        expect(verifyDevBytes(Buffer.from(output), analysis.sha256)).toBe(analysis.sha256);
        expect(() => verifyDevBytes(Buffer.from(changed), analysis.sha256)).toThrow("交付与当前源码不一致");
    });
});
