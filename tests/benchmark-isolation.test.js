import { expect, it } from "vitest";
import { assertNoConcurrentBenchmarks } from "../scripts/benchmark-isolation.mjs";
it("refuses measurements while other test processes are present", () => {
    expect(() => assertNoConcurrentBenchmarks(() => "[1234,2345]")).toThrow("PID 1234, 2345");
    expect(() => assertNoConcurrentBenchmarks(() => "[]")).not.toThrow();
});
it("fails closed if test isolation cannot be established", () => {
    expect(() => assertNoConcurrentBenchmarks(() => { throw new Error("access denied"); })).toThrow("access denied");
    expect(() => assertNoConcurrentBenchmarks(() => "null")).toThrow("独占测试环境");
});
