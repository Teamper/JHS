// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { createMediaConnections } from "../src/ui/settings/media-connections.js";

let scope;
afterEach(() => { scope?.dispose(); document.body.replaceChildren(); });
const connection = { id: "home", name: "家庭媒体库", address: "https://media.example/", apiKey: "fixture", type: "jellyfin", enabled: true };
function boot(onTest) {
    scope = new LifecycleScope("connections:test");
    const root = createMediaConnections({ document, scope, connections: [connection], enabled: false, onSave: vi.fn(), onTest });
    document.body.append(root);
    const click = text => [...root.querySelectorAll("button")].find(node => node.textContent === text).click();
    return { root, click };
}
it("cancels a removed server's connection test and ignores its late response", async () => {
    let testScope, resolve;
    const { root, click } = boot((_connection, owner) => { testScope = owner; return new Promise(done => { resolve = done; }); });
    click("测试连接");
    expect(testScope.disposed).toBe(false);
    click("移除此服务器");
    expect(testScope.disposed).toBe(true);
    expect(testScope.snapshot().listeners).toBe(0);
    resolve({ name: "late" });
    await Promise.resolve();
    expect(root.querySelector("fieldset")).toBeNull();
    expect(root.textContent).not.toContain("late");
});
it("releases every row owner when the manager closes", async () => {
    let testScope, resolve;
    const { root, click } = boot((_connection, owner) => { testScope = owner; return new Promise(done => { resolve = done; }); });
    click("测试连接");
    scope.dispose();
    expect(testScope.disposed).toBe(true);
    resolve({ name: "late" });
    await Promise.resolve();
    expect(root.textContent).not.toContain("连接成功");
});
