import { describe, expect, it, vi } from "vitest";
import { ListDomObserver } from "../src/features/list/list-dom-observer.js";

function createScope() {
    let cleanup = null;
    let mutationCallback = null;
    const observer = { disconnect: vi.fn() };
    return {
        scope: {
            assertActive: vi.fn(),
            observe: vi.fn((_root, callback) => {
                mutationCallback = callback;
                return observer;
            }),
            addCleanup: vi.fn((callback) => {
                cleanup = callback;
                return callback;
            }),
            ownTimeout: vi.fn(() => vi.fn()),
        },
        observer,
        getMutationCallback: () => mutationCallback,
        runCleanup: () => cleanup?.(),
    };
}

function createElement({ matches = true, connected = true } = {}) {
    return {
        nodeType: 1,
        isConnected: connected,
        dataset: {},
        matches: vi.fn(() => matches),
        querySelectorAll: vi.fn(() => []),
    };
}

describe("ListDomObserver", () => {
    it("indexes added cards and debounces feature-owned processing", async () => {
        vi.useFakeTimers();
        try {
            const lifecycle = createScope(), item = createElement(), root = { querySelectorAll: vi.fn(() => []) }, pageLocation = new URL("https://javdb.com/"), index = { indexItems: vi.fn(), removeIndexedItems: vi.fn() }, state = { advanceListGeneration: vi.fn(() => "1:0"), captureListRevision: vi.fn(() => "1:0") }, processAddedItems = vi.fn(async () => {}), onPhase = vi.fn(), observer = new ListDomObserver({
                scope: lifecycle.scope,
                selectors: { boxSelector: ".movie-list", itemSelector: ".item" },
                document: { querySelector: vi.fn(() => root) },
                window: { isListPage: true, location: pageLocation },
                location: pageLocation,
                state,
                index,
                processAddedItems,
                onPhase,
            });

            observer.start();
            lifecycle.getMutationCallback()([{ removedNodes: [], addedNodes: [item] }]);

            expect(index.indexItems).toHaveBeenCalledWith([item]);
            expect(state.advanceListGeneration).toHaveBeenCalledOnce();
            expect(onPhase).toHaveBeenCalledWith("dom-added", 1);
            expect(processAddedItems).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(99);
            expect(processAddedItems).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(1);
            expect(processAddedItems).toHaveBeenCalledWith([item], "1:0");
            expect(lifecycle.scope.ownTimeout).toHaveBeenCalledOnce();
        } finally {
            vi.useRealTimers();
        }
    });

    it("tracks nested cards, removes detached index entries, and clears pending work on dispose", async () => {
        vi.useFakeTimers();
        try {
            const lifecycle = createScope(), nested = createElement(), parent = createElement({ matches: false }), removed = createElement(), root = { querySelectorAll: vi.fn(() => []) }, pageLocation = new URL("https://javdb.com/");
            parent.querySelectorAll = vi.fn(() => [nested]);
            const index = { indexItems: vi.fn(), removeIndexedItems: vi.fn() }, state = { advanceListGeneration: vi.fn(() => "1:0"), captureListRevision: vi.fn(() => "1:0") }, processAddedItems = vi.fn(async () => {}), observer = new ListDomObserver({
                scope: lifecycle.scope,
                selectors: { boxSelector: ".movie-list", itemSelector: ".item" },
                document: { querySelector: vi.fn(() => root) },
                window: { isListPage: true, location: pageLocation },
                location: pageLocation,
                state,
                index,
                processAddedItems,
            });

            observer.start();
            lifecycle.getMutationCallback()([{ removedNodes: [removed], addedNodes: [parent] }]);
            expect(index.removeIndexedItems).toHaveBeenCalledWith([removed]);
            expect(index.indexItems).toHaveBeenCalledWith([nested]);
            lifecycle.runCleanup();
            await vi.advanceTimersByTimeAsync(100);

            expect(processAddedItems).not.toHaveBeenCalled();
            expect(observer.observer).toBeNull();
            expect(lifecycle.observer.disconnect).toHaveBeenCalledOnce();
        } finally {
            vi.useRealTimers();
        }
    });

    it("does not observe owned ranking pages", () => {
        const lifecycle = createScope(), pageLocation = new URL("https://javdb.com/advanced_search?handleTop=1"), observer = new ListDomObserver({
            scope: lifecycle.scope,
            selectors: { boxSelector: ".movie-list", itemSelector: ".item" },
            document: { querySelector: vi.fn() },
            window: { isListPage: true, location: pageLocation },
            location: pageLocation,
            state: { advanceListGeneration: vi.fn(), captureListRevision: vi.fn() },
            index: { indexItems: vi.fn(), removeIndexedItems: vi.fn() },
            processAddedItems: vi.fn(),
        });

        expect(observer.start()).toBeNull();
        expect(lifecycle.scope.observe).not.toHaveBeenCalled();
    });
});
