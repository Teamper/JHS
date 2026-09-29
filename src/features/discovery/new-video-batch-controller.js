// @ts-check

import { normalizeCarNum } from "../../core/constants.js";

/** Executes new-video batch mutations through the injected StateService. */
export class NewVideoBatchController {
    /** @param {{state: any}} options */
    constructor(options) {
        this.state = options.state;
        this.disposed = false;
    }

    /** @param {"favorite" | "watched" | "downloaded" | "ignore" | "snooze" | "restore" | "remove"} action @param {Array<Record<string, any>>} items */
    async run(action, items) {
        if (this.disposed) throw new DOMException("New-video batch feature is disposed", "AbortError");
        const byCarNum = new Map();
        for (const item of items || []) {
            const carNum = normalizeCarNum(item?.carNum);
            if (carNum && !byCarNum.has(carNum)) byCarNum.set(carNum, { ...item, carNum });
        }
        const records = [...byCarNum.entries()];
        const carNums = records.map(([carNum]) => carNum);
        if (!carNums.length) return { changed: [] };

        if (["favorite", "watched", "downloaded"].includes(action)) {
            const flag = /** @type {"favorite" | "watched" | "downloaded"} */ (action);
            return this.state.patch(carNums, { [flag]: true }, {
                type: "new-video-batch-state",
                records: records.map(([, item]) => ({
                    carNum: item.carNum,
                    url: item.url || `/search?q=${encodeURIComponent(item.carNum)}`,
                    names: item.actressName,
                    publishTime: item.publishTime,
                })),
            });
        }

        if (action === "ignore") return this.state.setNewVideoDecision(carNums, "ignored");
        if (action === "snooze") return this.state.setNewVideoDecision(carNums, "snoozed", new Date(Date.now() + 7 * 864e5).toISOString());
        if (action === "restore") return this.state.setNewVideoDecision(carNums, null);
        if (action === "remove") return this.state.removeFromNewVideoList(carNums, "manual");
        throw new TypeError(`不支持的新作品批量操作: ${action}`);
    }

    dispose() { this.disposed = true; }
}
