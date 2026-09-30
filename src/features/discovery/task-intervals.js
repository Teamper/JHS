// @ts-check

import { parseNumberSetting } from "../../core/feature-helpers.js";

const TASK_INTERVALS = Object.freeze({
    blacklist: { key: "checkBlacklist_intervalTime", fallback: 12 },
    favoriteActress: { key: "checkFavoriteActress_IntervalTime", fallback: 24 },
    newVideo: { key: "checkNewVideo_intervalTime", fallback: 12 },
});

/** @param {"blacklist" | "favoriteActress" | "newVideo"} name */
export function getTaskIntervalDefinition(name) {
    const definition = TASK_INTERVALS[name];
    if (!definition) throw new Error(`未知任务调度: ${name}`);
    return definition;
}

/** @param {"blacklist" | "favoriteActress" | "newVideo"} name @param {unknown} value */
export function parseTaskInterval(name, value) {
    return parseNumberSetting(value, getTaskIntervalDefinition(name).fallback, { min: Number.EPSILON });
}
