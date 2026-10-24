import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import * as scheduling from "../src/core/background-work.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";
afterEach(() => vi.useRealTimers());
function fixture() {
  const document = new EventTarget(); document.hidden = false;
  const window = new EventTarget();
  const scope = new LifecycleScope("test:background");
  const work = new scheduling.BackgroundWork({ document, window, scope });
  return { document, window, scope, work };
}
describe("interaction-first automatic work", () => {
  it("waits for first-ready plus two seconds and resets the quiet window on real input", async () => {
    vi.useFakeTimers(); const a = fixture(); let started = false;
    const pending = a.work.waitForTurn().then(() => { started = true; });
    await vi.advanceTimersByTimeAsync(3000); expect(started).toBe(false);
    a.work.markReady(); await vi.advanceTimersByTimeAsync(1800);
    a.document.dispatchEvent(new Event("mousemove"));
    await vi.advanceTimersByTimeAsync(499); expect(started).toBe(false);
    await vi.advanceTimersByTimeAsync(1); await pending; expect(started).toBe(true);
    a.scope.dispose();
  });
  it("uses elapsed time when the wall clock moves backwards", async () => {
    vi.useFakeTimers(); const a = fixture(); let started = false;
    const pending = a.work.waitForTurn().then(() => { started = true; }).catch(() => {});
    try {
      a.work.markReady();
      vi.setSystemTime(Date.now() - 60000);
      await vi.advanceTimersByTimeAsync(2100);
      expect(started).toBe(true);
    } finally { a.scope.dispose(); await pending; }
  });
  it("does not start a new hidden batch and releases aborted waiters", async () => {
    vi.useFakeTimers(); const a = fixture(); a.work.markReady(); a.document.hidden = true;
    const controller = new AbortController();
    const pending = a.work.waitForTurn({ signal: controller.signal });
    const rejection = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(3000); controller.abort(); await rejection;
    a.document.hidden = false; a.document.dispatchEvent(new Event("visibilitychange"));
    await a.work.waitForTurn(); a.scope.dispose();
  });
  it("lets an explicit request promote only its queued automatic operation", async () => {
    const a = fixture(), controller = new AbortController();
    const pending = a.work.waitForTurn({ signal: controller.signal });
    a.work.expedite(controller.signal);
    await pending;
    a.scope.dispose();
  });
  it("cancels queued work when the owning page is disposed", async () => {
    const a = fixture(); const pending = a.work.waitForTurn();
    const rejection = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    a.scope.dispose(); await rejection;
  });
  it("keeps CPU and lock diagnostics off until explicit capture", () => {
    const d = new DiagnosticsService();
    d.recordComputation("sync.project", { cpuMs: 8, maxSliceMs: 4, steps: 200, yields: 2 });
    expect(d.performanceSnapshot()).toBeNull();
    d.startPerformanceCapture({});
    d.recordComputation("sync.project", { cpuMs: 8, maxSliceMs: 4, steps: 200, yields: 2 });
    d.recordComputation("storage.lock", { waitMs: 12, holdMs: 30 });
    expect(d.performanceSnapshot().computations["sync.project"]).toMatchObject({ calls: 1, cpuMs: 8, maxSliceMs: 4, steps: 200, yields: 2 });
    expect(d.performanceSnapshot().computations["storage.lock"]).toMatchObject({ waitMs: 12, holdMs: 30 });
    d.stopPerformanceCapture();
    d.recordComputation("sync.project", { cpuMs: 100 });
    expect(d.performanceSnapshot().computations["sync.project"].cpuMs).toBe(8);
  });
});
