// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListDiagnosticsService } from "../src/features/list/list-diagnostics-service.js";

afterEach(() => {
    delete globalThis.__jhsBrowserDiagnostics;
});

describe("ListDiagnosticsService", () => {
    it("records list state and derives the item count when omitted", () => {
        document.body.innerHTML = '<div class="movie-list"><div class="item"></div><div class="item"></div></div>';
        globalThis.__jhsBrowserDiagnostics = {};
        const scope = new LifecycleScope("feature:list"), state = { listGeneration: 3, filterRevision: 2, activeQuickFilter: "favorite" }, service = new ListDiagnosticsService({ scope, document, selectors: { itemSelector: ".movie-list .item" }, state });

        service.recordPhase("applyVisibility");

        expect(globalThis.__jhsBrowserDiagnostics.listPhases).toEqual([{ phase: "applyVisibility", generation: 3, filterRevision: 2, activeQuickFilter: "favorite", itemCount: 2 }]);
        scope.dispose();
    });

    it("keeps only the most recent bounded phase samples and stops after disposal", () => {
        globalThis.__jhsBrowserDiagnostics = {};
        const scope = new LifecycleScope("feature:list"), service = new ListDiagnosticsService({ scope, document, selectors: { itemSelector: ".item" }, state: {} });

        for (let index = 0; index < 205; index += 1) service.recordPhase(`phase-${index}`, index);
        expect(globalThis.__jhsBrowserDiagnostics.listPhases).toHaveLength(200);
        expect(globalThis.__jhsBrowserDiagnostics.listPhases[0].phase).toBe("phase-5");
        scope.dispose();
        service.recordPhase("ignored", 0);
        expect(globalThis.__jhsBrowserDiagnostics.listPhases.at(-1).phase).toBe("phase-204");
    });
});
