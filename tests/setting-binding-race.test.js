import { afterEach, describe, expect, it, vi } from "vitest";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { SettingsService } from "../src/services/settings-service.js";
import { bindSettingControl, createLatestSettingWriter } from "../src/ui/settings/setting-binding-controller.js";

function makeJq(html = '<div id="root"></div>') {
    const dom = new JSDOM(html, { url: "https://javdb.com/" });
    const jq = jqueryFactory(dom.window);
    return { dom, jq };
}

function checkboxBinding(jq, root, settings, key = "k", initial = "no") {
    const element = jq('<input type="checkbox" class="mini-switch">').prop("checked", initial === "yes");
    root.append(element);
    return bindSettingControl({
        root,
        selector: "input",
        key,
        getValue: () => element.is(":checked") ? "yes" : "no",
        setValue: (value) => element.prop("checked", value === "yes" || value === true),
        fallback: "no",
        label: key,
        settings,
    });
}

describe("SettingBindingHub race and static control contracts", () => {
    afterEach(() => { vi.unstubAllGlobals(); });

    it("keeps the hub alive with a pending write after the last binding is disposed", async () => {
        const { jq } = makeJq('<div id="a"></div><div id="b"></div>');
        const stored = { setting: { k: "no" } };
        let releaseWrite;
        const settings = new SettingsService({
            get: async () => stored.setting,
            set: async (key, next) => {
                stored.setting = next;
                await new Promise((resolve) => { releaseWrite = resolve; });
            },
        });
        await settings.load();

        const rootA = jq("#a");
        const bindingA = checkboxBinding(jq, rootA, settings);
        rootA.find("input").prop("checked", true).trigger("change");
        expect(settings.snapshot().k).toBe("no");
        bindingA.dispose();
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Reopen a new surface before the pending write commits.
        const rootB = jq("#b");
        const bindingB = checkboxBinding(jq, rootB, settings);
        expect(rootB.find("input").is(":checked")).toBe(true);

        releaseWrite();
        await bindingB.flush();
        expect(settings.snapshot().k).toBe("yes");
        expect(rootB.find("input").is(":checked")).toBe(true);
    });

    it("does not let an older committed state override a newer pending intent", async () => {
        const { jq } = makeJq('<div id="root"></div>');
        const stored = { setting: { k: "no" } };
        let calls = 0;
        let releaseFirst;
        const settings = new SettingsService({
            get: async () => stored.setting,
            set: async (key, next) => {
                calls += 1;
                stored.setting = next;
                if (calls === 1) {
                    await new Promise((resolve) => { releaseFirst = resolve; });
                }
            },
        });
        await settings.load();

        const root = jq("#root");
        const binding = checkboxBinding(jq, root, settings);
        const input = root.find("input");

        input.prop("checked", true).trigger("change"); // A = ON, blocked
        input.prop("checked", false).trigger("change"); // B = OFF, queued behind A
        expect(input.is(":checked")).toBe(false);
        await new Promise((resolve) => setTimeout(resolve, 0));

        releaseFirst(); // A commits now; B is still pending.
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(input.is(":checked")).toBe(false);

        await binding.flush();
        expect(settings.snapshot().k).toBe("no");
        expect(input.is(":checked")).toBe(false);
    });

    it("syncs needClosePage-style static controls across two surfaces", async () => {
        const { jq } = makeJq('<div id="quick"></div><div id="full"></div>');
        const stored = { setting: { needClosePage: "no" } };
        const settings = new SettingsService({
            get: async () => stored.setting,
            set: async (key, next) => { stored.setting = next; },
        });
        await settings.load();

        const quickRoot = jq("#quick");
        const fullRoot = jq("#full");
        const quickBinding = checkboxBinding(jq, quickRoot, settings, "needClosePage", "no");
        const fullBinding = checkboxBinding(jq, fullRoot, settings, "needClosePage", "no");

        fullRoot.find("input").prop("checked", true).trigger("change");
        expect(quickRoot.find("input").is(":checked")).toBe(true);
        await quickBinding.flush();

        quickRoot.find("input").prop("checked", false).trigger("change");
        expect(fullRoot.find("input").is(":checked")).toBe(false);
        await fullBinding.flush();
        expect(settings.snapshot().needClosePage).toBe("no");
    });

    it("rolls back a static control when persistence rejects", async () => {
        const { jq } = makeJq('<div id="root"></div>');
        const stored = { setting: { k: "no" } };
        const settings = new SettingsService({
            get: async () => stored.setting,
            set: async () => { throw new Error("storage down"); },
        });
        await settings.load();

        const root = jq("#root");
        const binding = checkboxBinding(jq, root, settings);
        root.find("input").prop("checked", true).trigger("change");
        await binding.flush();
        expect(root.find("input").is(":checked")).toBe(false);
        expect(settings.snapshot().k).toBe("no");
    });

    it("flush with throwOnFailure reports live persistence failures", async () => {
        const { jq } = makeJq('<div id="root"></div>');
        const stored = { setting: { k: "no" } };
        const settings = new SettingsService({
            get: async () => stored.setting,
            set: async () => { throw new Error("storage down"); },
        });
        await settings.load();

        const root = jq("#root");
        const binding = checkboxBinding(jq, root, settings);
        root.find("input").prop("checked", true).trigger("change");
        await expect(binding.flush({ throwOnFailure: true })).rejects.toThrow("部分实时设置保存失败");
        expect(root.find("input").is(":checked")).toBe(false);
        expect(settings.snapshot().k).toBe("no");
    });

    it("does not let a previous surface's rolled-back failure poison a later full flush", async () => {
        const { jq } = makeJq('<div id="quick"></div><div id="full"></div>');
        const stored = { setting: { k: "no" } };
        const settings = new SettingsService({
            get: async () => stored.setting,
            set: async () => { throw new Error("storage down"); },
        });
        await settings.load();

        const quickRoot = jq("#quick");
        const quickBinding = checkboxBinding(jq, quickRoot, settings);
        quickRoot.find("input").prop("checked", true).trigger("change");
        await quickBinding.flush();
        expect(quickRoot.find("input").is(":checked")).toBe(false);
        quickBinding.dispose();

        const fullRoot = jq("#full");
        const fullBinding = checkboxBinding(jq, fullRoot, settings);
        await expect(fullBinding.flush({ throwOnFailure: true })).resolves.toBeUndefined();
        expect(fullRoot.find("input").is(":checked")).toBe(false);
    });

    it("rolls a failed latest direct action back to the newest committed snapshot", async () => {
        const stored = { setting: { expanded: "no" } };
        let releaseFirst;
        let calls = 0;
        const applied = [];
        const settings = new SettingsService({
            get: async () => stored.setting,
            async set(_key, value) {
                calls += 1;
                if (calls === 1) {
                    await new Promise((resolve) => { releaseFirst = resolve; });
                    stored.setting = value;
                    return;
                }
                throw new Error("storage down");
            },
        });
        await settings.load();
        const write = createLatestSettingWriter({ settings, key: "expanded", fallback: "no", apply: value => applied.push(value) });
        const first = write("yes");
        const second = write("no");
        await new Promise((resolve) => setTimeout(resolve, 0));
        releaseFirst();
        await Promise.all([ first, second ]);

        expect(settings.snapshot().expanded).toBe("yes");
        expect(applied.at(-1)).toBe("yes");
    });
});
