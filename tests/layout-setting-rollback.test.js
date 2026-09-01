import { expect, it } from "vitest";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { SettingsService } from "../src/services/settings-service.js";
import { bindSettingControl } from "../src/ui/settings/setting-binding-controller.js";
import { applyLayoutRangeValue } from "../src/features/system/settings/setting-forms.js";

it("restores layout controls and host DOM when persistence rejects", async () => {
    const dom = new JSDOM('<div id="root"><input id="containerColumns" type="range"><span id="showContainerColumns"></span><input id="containerWidth" type="range"><span id="showContainerWidth"></span></div><div id="list"></div><div id="layout"></div>');
    const jq = jqueryFactory(dom.window), root = jq("#root"), stored = { setting: { containerColumns: 5, containerWidth: 100 } };
    const settings = new SettingsService({ get: async () => stored.setting, set: async () => { throw new Error("storage down"); } });
    const host = { locateListRoot: () => dom.window.document.querySelector("#list"), getListLayoutContainer: () => dom.window.document.querySelector("#layout") };
    await settings.load();
    const columns = bindSettingControl({ root, selector: "#containerColumns", key: "containerColumns", getValue: () => Number(root.find("#containerColumns").val()), setValue: value => applyLayoutRangeValue(root, host, "containerColumns", value), fallback: 5, settings });
    const width = bindSettingControl({ root, selector: "#containerWidth", key: "containerWidth", getValue: () => Number(root.find("#containerWidth").val()) + 70, setValue: value => applyLayoutRangeValue(root, host, "containerWidth", value), fallback: 100, settings });

    applyLayoutRangeValue(root, host, "containerColumns", 8);
    root.find("#containerColumns").trigger("change");
    applyLayoutRangeValue(root, host, "containerWidth", 85);
    root.find("#containerWidth").trigger("change");
    await Promise.all([ columns.flush(), width.flush() ]);

    expect(root.find("#containerColumns").val()).toBe("5");
    expect(root.find("#showContainerColumns").text()).toBe("5");
    expect(host.locateListRoot().style.gridTemplateColumns).toBe("repeat(5, minmax(0, 1fr))");
    expect(root.find("#containerWidth").val()).toBe("30");
    expect(root.find("#showContainerWidth").text()).toBe("100%");
    expect(host.getListLayoutContainer().style.minWidth).toBe("100%");
});
