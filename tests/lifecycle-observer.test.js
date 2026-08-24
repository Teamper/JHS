// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

it("owns, releases and disposes MutationObservers through LifecycleScope", async () => {
    const scope = new LifecycleScope("observer:test"), callback = vi.fn(), target = document.createElement("div");
    const observer = scope.observe(target, callback, { childList: true });
    expect(scope.snapshot().observers).toBe(1);
    target.append(document.createElement("span"));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(callback).toHaveBeenCalledOnce();
    scope.releaseObserver(observer);
    expect(scope.snapshot().observers).toBe(0);
    target.append(document.createElement("span"));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(callback).toHaveBeenCalledOnce();
    scope.dispose();
    expect(scope.snapshot()).toMatchObject({ observers: 0, disposed: true });
});
