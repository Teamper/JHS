import { describe, expect, it, vi } from "vitest";
import { NewVideoWorkspaceController } from "../src/features/discovery/new-video-workspace-controller.js";

describe("NewVideoWorkspaceController", () => {
    it("counts unique pending titles while excluding watched, ignored, dismissed, and active snoozes", async () => {
        const carMap = new Map([["WATCHED-002", { stateFlags: { watched: true } }]]);
        const actress = { newVideoList: [" ab-001 ", { carNum: "AB-001" }, "WATCHED-002", "IGNORED-003", "DISMISSED-004", "SNOOZED-005", "EXPIRED-006"] };
        const decisions = {
            "IGNORED-003": { action: "ignored" },
            "DISMISSED-004": { action: "dismissed" },
            "SNOOZED-005": { action: "snoozed", until: new Date(Date.now() + 60_000).toISOString() },
            "EXPIRED-006": { action: "snoozed", until: new Date(Date.now() - 60_000).toISOString() },
        };
        const state = {
            getCarMap: vi.fn(async () => carMap),
            getFavoriteActressList: vi.fn(async () => [actress]),
            getNewVideoDecisions: vi.fn(async () => decisions),
        };
        const controller = new NewVideoWorkspaceController({ state, settings: { snapshot: () => ({}) }, movie: {} });

        expect(await controller.getPendingSummary()).toEqual({
            count: 2,
            decisions: expect.objectContaining({ "IGNORED-003": { action: "ignored" } }),
        });
        expect(controller.getPendingNewVideoCount(actress, carMap, decisions)).toBe(2);
        expect(state.getCarMap).toHaveBeenCalledOnce();
        expect(state.getFavoriteActressList).toHaveBeenCalledOnce();
        expect(state.getNewVideoDecisions).toHaveBeenCalledOnce();
    });

    it("loads a single consistent workspace snapshot from injected services", async () => {
        const actresses = [{ starId: "actor-1", newVideoList: ["ABC-001"] }], carMap = new Map([["ABC-001", { stateFlags: {} }]]), settings = { javDbBtn: "https://mirror.example" };
        const state = {
            getFavoriteActressList: vi.fn(async () => actresses),
            getCarMap: vi.fn(async () => carMap),
            getNewVideoDecisions: vi.fn(async () => decisions),
        };
        const settingsService = { snapshot: vi.fn(() => ({ ...settings, checkNewVideo_ruleTime: 720 })) };
        const decisions = { "ABC-001": { action: "pending" } };
        const movie = { externalSiteOrigin: vi.fn(() => "https://mirror.example") };
        const controller = new NewVideoWorkspaceController({ state, settings: settingsService, movie });

        expect(await controller.loadWorkspace()).toEqual({
            actresses, carMap, decisions, ruleTime: 720, javDbUrl: "https://mirror.example",
            items: [expect.objectContaining({ carNum: "ABC-001", starId: "actor-1", decisionState: "pending" })],
        });
        expect(settingsService.snapshot).toHaveBeenCalledOnce();
        expect(movie.externalSiteOrigin).toHaveBeenCalledWith("javDbBtn", expect.objectContaining(settings));
    });

    it("rejects delayed read results once its feature is disposed", async () => {
        let resolveCarMap;
        const state = {
            getCarMap: () => new Promise((resolve) => { resolveCarMap = resolve; }),
            getFavoriteActressList: async () => [],
            getNewVideoDecisions: async () => ({}),
        };
        const controller = new NewVideoWorkspaceController({ state, settings: { snapshot: () => ({}) }, movie: {} });
        const pending = controller.getPendingSummary();
        controller.dispose();
        resolveCarMap(new Map());

        await expect(pending).rejects.toMatchObject({ name: "AbortError" });
        await expect(controller.loadWorkspace()).rejects.toMatchObject({ name: "AbortError" });
    });

    it("aggregates duplicate actress records into one normalized row and keeps legacy state and decision semantics", async () => {
        const actresses = [
            { starId: "actor-1", name: "Actor One", actressType: "uncensored", newVideoList: [{ carNum: " ab-001 ", title: "First", publishTime: "2026-09-20", score: 4, voteCount: 10 }] },
            { starId: "actor-2", name: "Actor Two", actressType: "censored", newVideoList: [{ carNum: "AB-001", title: "VR release", publishTime: "2026-09-21", score: 5, voteCount: 20, isVr: true }] },
        ];
        const carMap = new Map([["AB-001", { stateFlags: { watched: true } }]]);
        const decision = { action: "snoozed", until: new Date(Date.now() + 60_000).toISOString() };
        const decisions = { "AB-001": decision };
        const state = {
            getFavoriteActressList: async () => actresses, getCarMap: async () => carMap,
            getNewVideoDecisions: async () => decisions,
        };
        const controller = new NewVideoWorkspaceController({ state, settings: { snapshot: () => ({}) }, movie: { externalSiteOrigin: () => "https://javdb.com" } });

        const [item] = (await controller.loadWorkspace()).items;
        expect(item).toMatchObject({
            carNum: "AB-001", coverUrl: "", title: "First", publishTime: "2026-09-21", score: 5, voteCount: 20,
            actresses: ["Actor One", "Actor Two"], starIds: ["actor-1", "actor-2"], categories: ["uncensored", "censored"],
            actressName: "Actor One、Actor Two", starId: "actor-1", isVr: true, flags: { watched: true },
            decision, decisionState: "snoozed",
        });
    });
});
