import { performance } from "node:perf_hooks";

import { StateService } from "../src/core/state-service.js";

const SAMPLES = Math.max(3, Number.parseInt(process.env.JHS_STATE_BENCHMARK_SAMPLES || "10", 10) || 10);
const SIZES = [100, 1_000, 10_000, 50_000];

function byteLength(value) {
    return Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
}

function percentile(values, ratio) {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function createStorage(size) {
    const data = new Map([
        ["car_list", Array.from({ length: size }, (_, index) => ({
            carNum: `BENCH-${String(index).padStart(6, "0")}`,
            url: `https://example.test/v/${index}`,
            names: `Title ${index}`,
            stateFlags: { favorite: false, downloaded: false, watched: false, blocked: false },
            status: "",
        }))],
        ["favorite_actresses", []],
        ["new_video_decisions", {}],
        ["activity_log", { entries: [] }],
    ]);
    const stats = { getCount: 0, setCount: 0, removeCount: 0, readBytes: 0, serializedBytes: 0, writeBytes: 0, journalBytes: 0 };
    const recordRead = async (key) => {
        const value = data.get(key);
        stats.getCount += 1, stats.readBytes += byteLength(value);
        return value;
    };
    const recordWrite = async (key, value) => {
        const bytes = byteLength(value);
        stats.setCount += 1, stats.serializedBytes += bytes;
        if (key === "mutation_journal") stats.journalBytes += bytes;
        else stats.writeBytes += bytes;
        data.set(key, value);
        return value;
    };
    const storage = {
        car_list_key: "car_list", favorite_actresses_key: "favorite_actresses",
        forage: {
            getItem: recordRead,
            setItem: recordWrite,
            removeItem: async (key) => { stats.removeCount += 1, data.delete(key); },
        },
        _setItemAndInvalidate: recordWrite,
        _invalidateCache() {},
        getCar: async (carNum) => (data.get("car_list") || []).find((item) => item.carNum === carNum),
    };
    return { storage, stats };
}

function summarize(values) {
    return { p50Ms: Number(percentile(values, 0.5).toFixed(2)), p95Ms: Number(percentile(values, 0.95).toFixed(2)) };
}

async function benchmarkSize(size) {
    const { storage, stats } = createStorage(size);
    const service = new StateService(storage, { emit: async () => {} });
    const durations = [], samples = [];
    for (let index = 0; index < SAMPLES; index += 1) {
        const carNum = `BENCH-NEW-${size}-${index}`;
        const before = { ...stats };
        const startedAt = performance.now();
        await service.patch(carNum, { favorite: true }, { type: "state-scale-benchmark", record: { carNum, url: `https://example.test/v/${carNum}`, names: "Benchmark" } });
        durations.push(performance.now() - startedAt);
        samples.push({
            readBytes: stats.readBytes - before.readBytes,
            serializedBytes: stats.serializedBytes - before.serializedBytes,
            writeBytes: stats.writeBytes - before.writeBytes,
            journalBytes: stats.journalBytes - before.journalBytes,
            storageOperations: (stats.getCount - before.getCount) + (stats.setCount - before.setCount) + (stats.removeCount - before.removeCount),
        });
    }
    const average = (name) => Number((samples.reduce((sum, sample) => sum + sample[name], 0) / samples.length).toFixed(2));
    return {
        records: size,
        samples: SAMPLES,
        patch: summarize(durations),
        readBytes: average("readBytes"),
        serializedBytes: average("serializedBytes"),
        writeBytes: average("writeBytes"),
        journalBytes: average("journalBytes"),
        storageOperations: average("storageOperations"),
    };
}

globalThis.utils = { getNowStr: () => "2026-08-31 00:00:00" };
globalThis.window = { location: { href: "https://javdb.com/v/benchmark" } };

const results = [];
for (const size of SIZES) results.push(await benchmarkSize(size));
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), samples: SAMPLES, results }, null, 2));
