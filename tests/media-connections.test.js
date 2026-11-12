// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { createMediaConnections } from "../src/ui/settings/media-connections.js";

let scope;
afterEach(() => { scope?.dispose(); document.body.replaceChildren(); });
const connection = { id: "home", name: "家庭媒体库", address: "https://media.example/", apiKey: "fixture", type: "jellyfin", enabled: true };
function boot(onTest, value = connection) {
    let editor;
    scope = new LifecycleScope("connections:test");
    const root = createMediaConnections({ document, scope, connections: [value], bindDraft: value => { editor = value; }, enabled: false, onSave: vi.fn(), onTest });
    document.body.append(root);
    const click = text => [...root.querySelectorAll("button")].find(node => node.textContent === text).click();
    return { root, click, editor };
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

it("explains a missing server name and focuses the field before any request", () => {
    const onTest = vi.fn();
    const { root, click } = boot(onTest, { ...connection, name: "" });
    click("测试连接");
    expect(root.textContent).toContain("请填写服务器名称");
    expect(onTest).not.toHaveBeenCalled();
    const field = root.querySelector("fieldset input");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(field);
    expect(document.getElementById(field.getAttribute("aria-describedby")).textContent).toBe("请填写服务器名称");
    field.value = "新名称"; field.dispatchEvent(new Event("input", { bubbles: true }));
    expect(field.hasAttribute("aria-invalid")).toBe(false);
});

it("shows the same field-specific validation when the full settings footer submits", () => {
    const { root, editor } = boot(vi.fn(), { ...connection, apiKey: "" });
    expect(() => editor.validate()).toThrow("请填写 API Key");
    expect(root.textContent).toContain("请填写 API Key");
    expect(root.querySelector("input[type=password]").getAttribute("aria-invalid")).toBe("true");
});

it.each([
    [{ code: "AUTH_REQUIRED", details: { status: 403 } }, "HTTP 403"],
    [{ code: "TIMEOUT" }, "连接超时"],
    [{ code: "NETWORK_ERROR" }, "网络请求失败"],
])("retains the specific request failure %j", async (properties, message) => {
    const failure = Object.assign(new Error("upstream-secret"), properties);
    const { root, click } = boot(vi.fn().mockRejectedValue(failure));
    click("测试连接");
    await vi.waitFor(() => expect(root.textContent).toContain(message));
    expect(root.textContent).not.toContain("upstream-secret");
    expect([...root.querySelectorAll("button")].find(node => node.textContent === "测试连接").hasAttribute("aria-busy")).toBe(false);
});
