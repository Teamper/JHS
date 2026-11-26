import { byId, collections, tasks } from "@jhs/fixtures";

export const storageKey = "jhs.android.preview.v1";
export const flags = ["favorite", "downloaded", "watched", "blocked"];
const blank = { favorite: false, downloaded: false, watched: false, blocked: false, rating: 0, note: "", updated: 0 };
const blankFollow = "pending";

function seed() {
    return {
        works: {
            1: { favorite: true, rating: 4, note: "适合周末重看", updated: 2 },
            2: { favorite: true, downloaded: true, watched: true, rating: 5, updated: 1 },
            3: { blocked: true, note: "留在片库管理" },
        },
        decisions: { 14: { status: "snoozed" }, 15: { status: "ignored" } },
        members: Object.fromEntries(Object.entries(collections).map(([key, value]) => [key,
            Object.fromEntries(value.members.map(id => [id, true]))])),
        tasks: Object.fromEntries(tasks.map(task => [task.id, { status: task.status, progress: task.progress }])),
        preferences: { theme: "system", mask: false },
        revision: 2,
    };
}

export function createStore(storage) {
    let data = seed();
    try {
        const saved = JSON.parse(storage.getItem(storageKey));
        if (saved?.version === 1) data = saved.data;
    } catch {
        // A missing or unreadable local snapshot starts the offline demo with its bundled fixtures.
    }

    function persist() {
        try {
            storage.setItem(storageKey, JSON.stringify({ version: 1, data }));
        } catch {
            return false;
        }
        return true;
    }

    function record(id) {
        return { ...blank, ...data.works[id] };
    }

    function hasMembership(key, id) {
        return Boolean(data.members[key][id]);
    }

    function inLibrary(id) {
        const value = record(id);
        return flags.some(flag => value[flag]) || value.rating > 0 || Boolean(value.note)
            || Object.keys(collections).some(key => hasMembership(key, id));
    }

    function edit(changes) {
        const undo = [];
        const stamped = new Set();
        for (const { group, id, fields } of changes) {
            const target = data[group][id] ??= {};
            for (const [key, next] of Object.entries(fields)) {
                const previous = target[key];
                if (Object.is(previous, next)) continue;
                target[key] = next;
                undo.push({ target, key, previous, next });
                if (group === "works") stamped.add(id);
                if (group === "members") stamped.add(key);
            }
        }
        for (const id of stamped) {
            const target = data.works[id] ??= {};
            const previous = target.updated;
            const next = ++data.revision;
            target.updated = next;
            undo.push({ target, key: "updated", previous, next });
        }
        return {
            saved: persist(),
            undo: () => {
                for (const { target, key, previous, next } of undo.reverse()) {
                    if (!Object.is(target[key], next)) continue;
                    if (previous === undefined) delete target[key];
                    else target[key] = previous;
                }
                undo.length = 0;
                return persist();
            },
        };
    }

    return {
        record,
        inLibrary,
        hasMembership,
        preferences: () => ({ ...data.preferences }),
        setPreferences(value) {
            Object.assign(data.preferences, value);
            return persist();
        },
        follow(id) { return data.decisions[id]?.status ?? blankFollow; },
        setFollow(id, status) {
            return edit([{ group: "decisions", id: String(id), fields: { status } }]);
        },
        setWorks(ids, fields) {
            return edit([...new Set(ids)].filter(id => byId.has(id)).map(id => ({ group: "works", id, fields })));
        },
        setMembers(key, ids, included) {
            return edit([{ group: "members", id: key, fields: Object.fromEntries(ids.map(id => [id, included])) }]);
        },
        task(id) { return data.tasks[id]; },
        setTask(id, status, progress) {
            Object.assign(data.tasks[id], { status, progress });
            return persist();
        },
        reset() {
            data = seed();
            return persist();
        },
    };
}
