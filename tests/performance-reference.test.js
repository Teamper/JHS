import { expect, it } from "vitest";
import { summarizePerformanceSamples, assertPerformanceReference, assertReferenceTightens } from "../scripts/performance-reference.mjs";
const reference = { schema: 1, environment: { browser: "fixed" }, metrics: { click: { p50: 100, p95: 200 } } };
it("requires 30 samples and computes P50/P95", () => {
    expect(summarizePerformanceSamples(Array.from({ length: 30 }, (_, index) => index + 1))).toEqual({ p50: 16, p95: 29 });
    expect(() => summarizePerformanceSamples([1])).toThrow();
});
it("rejects a P95 regression even when the median passes", () => {
    expect(() => assertPerformanceReference(reference, { ...reference, metrics: { click: { p50: 100, p95: 221 } } })).toThrow("click/p95");
    expect(() => assertPerformanceReference(reference, { ...reference, metrics: { click: { p50: 109, p95: 219 } } })).not.toThrow();
});
it("requires the sealed environment and rejects a raised or nonfinite reference", () => {
    expect(() => assertPerformanceReference(reference, { ...reference, environment: { browser: "changed" } })).toThrow("环境");
    expect(() => assertPerformanceReference({ ...reference, metrics: { click: { p50: NaN, p95: 200 } } }, reference)).toThrow();
    expect(() => assertPerformanceReference(reference, { ...reference, metrics: {} })).toThrow("场景");
});
it("allows a tighter ceiling but rejects raising a sealed ceiling", () => {
    expect(() => assertReferenceTightens(reference, { ...reference, metrics: { click: { p50: 99, p95: 190 } } })).not.toThrow();
    expect(() => assertReferenceTightens(reference, { ...reference, metrics: { click: { p50: 101, p95: 200 } } })).toThrow("只允许收紧");
});
