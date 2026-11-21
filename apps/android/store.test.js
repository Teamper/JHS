import assert from "node:assert/strict";
import { test } from "node:test";
import { actors, byId, works } from "./fixtures.js";
import { createStore } from "./store.js";

function device() {
    const data = new Map();
    return { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
}

test("样本以作品 ID 定位并保留完整番号", () => {
    assert.equal(works.length, 40);
    assert.equal(actors.length, 8);
    assert.equal(new Set(works.map(work => work.carNum)).size, 40);
    assert.equal(byId.size, 40);
    assert(works.some(work => work.actors.length > 1 && work.origins));
    assert(works.some(work => !work.cover));
});

test("四态、评分、备注和追新决定独立保留", () => {
    const storage = device();
    const store = createStore(storage);
    store.setWorks(["0"], { favorite: true, downloaded: true, watched: true, blocked: true, rating: 3, note: "测试备注" });
    assert.equal(store.follow("0"), "pending");
    store.setFollow("0", "done");
    store.setPreferences({ theme: "dark", mask: true });
    const restarted = createStore(storage);
    assert.equal(restarted.follow("0"), "done");
    assert(restarted.inLibrary("0"));
    assert.deepEqual(restarted.record("0"), store.record("0"));
    assert.deepEqual(restarted.preferences(), { theme: "dark", mask: true });
});

test("批量撤销保留后来修改的独立字段", () => {
    const store = createStore(device());
    const receipt = store.setWorks(["0", "1", "1"], { watched: true });
    store.setWorks(["1"], { note: "批量操作之后编辑" });
    assert.equal(receipt.undo(), true);
    assert.equal(store.record("0").watched, false);
    assert.equal(store.record("1").watched, false);
    assert.equal(store.record("1").note, "批量操作之后编辑");
    assert.equal(store.record("1").favorite, true);
});

test("清单与追新可以独立恢复", () => {
    const store = createStore(device());
    const member = store.setMembers("empty", ["7"], true);
    assert(store.inLibrary("7"));
    const follow = store.setFollow("14", "pending");
    assert.equal(store.follow("14"), "pending");
    follow.undo();
    assert.equal(store.follow("14"), "snoozed");
    member.undo();
    assert.equal(store.inLibrary("7"), false);
});
