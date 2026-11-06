import { test, expect } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

for (const blocked of [false, true]) test(`sync computation worker and lifecycle blocked=${blocked}`, async ({ context, page }, info) => {
    test.skip(info.project.name !== "desktop-wide");
    await fulfillHostFixtures(context); await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page, { settingOverrides: { autoPage: "no", enableCheckBlacklist: "no", enableCheckFavoriteActress: "no", enableCheckNewVideo: "no" } });
    const result = await page.evaluate(async blocked => {
        const runner = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("webdavSync").deps.computation;
        const original = window.Worker;
        let created = 0, terminated = 0;
        window.Worker = class extends original {
            constructor(...args) {
                created++;
                if (blocked) throw new DOMException("fixture blocked", "SecurityError");
                super(...args);
            }
            terminate() { terminated++; return super.terminate(); }
        };
        try {
            const payload = { data: { car_list: [{ carNum: "WORKER-123", stateFlags: { favorite: true } }] }, frontiers: {} };
            const value = await runner.run("project", payload);
            const text = await runner.run("stringify", value);
            const parsed = await runner.run("parse", text);
            const model = { records: parsed, frontiers: {} }, eligible = [];
            const proof = { proofKey: "fixture-revision", model: structuredClone(model), verifiedModel: model, data: structuredClone(payload.data), verifiedData: payload.data, eligible: [], verifiedEligible: eligible };
            const verified = await runner.run("verified", proof);
            proof.data.car_list[0].stateFlags.favorite = false;
            const changedData = await runner.run("verified", proof);
            proof.data = structuredClone(payload.data);
            proof.proofKey = "new-fixture-revision";
            proof.model.records.extra = {};
            const changedModel = await runner.run("verified", proof);
            const usedWorker = !runner.disabled;
            runner.dispose();
            let aborted = false;
            try { await runner.run("parse", "1"); } catch (error) { aborted = error.name === "AbortError"; }
            return { created, terminated, keys: Object.keys(parsed), aborted, usedWorker, verified, changedData, changedModel };
        } finally { window.Worker = original; }
    }, blocked);
    expect(result).toMatchObject({ created: 1, terminated: blocked ? 0 : 1, aborted: true, usedWorker: !blocked, verified: true, changedData: false, changedModel: false });
    expect(result.keys).toContain("car_list/WORKER-123");
});
