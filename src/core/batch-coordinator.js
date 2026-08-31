// @ts-check

/**
 * 批量任务的 Single Flight 协调器（模块级单飞）：
 * - 同一时刻只允许一个批量任务（ListPage 收藏/已下载、Blacklist 批量屏蔽共用）。
 * - run 是身份对象：旧任务的 finally 只清自己的 run，绝不误清新任务的 run。
 * - Cancel 只标记 cancelRequested，不释放 activeRun；只有最终 finally 才能 endBatchRun。
 */

/** @typedef {{ id: symbol, cancelRequested: boolean }} BatchRun */

/** @type {BatchRun | null} */
let activeRun = null;

/** 尝试开始一个批量任务；已有任务时返回 null（调用方提示并放弃）。 */
export function tryBeginBatchRun() {
    if (activeRun) return null;
    const run = /** @type {BatchRun} */ ({ id: Symbol("batch-run"), cancelRequested: false });
    activeRun = run;
    return run;
}

/** 判断 run 是否仍是当前活动任务。 @param {BatchRun | null | undefined} run */
export function isActiveBatchRun(run) {
    return activeRun === run;
}

/** 判断该任务是否已被请求取消（不会释放 single-flight 槽位）。 @param {BatchRun | null | undefined} run */
export function isBatchRunCancelled(run) {
    return Boolean(run?.cancelRequested) || !isActiveBatchRun(run);
}

/** 请求取消当前任务；只标记，不释放 activeRun。 @param {BatchRun | null | undefined} run */
export function requestCancelBatchRun(run) {
    if (activeRun === run && run) run.cancelRequested = true;
}

/** 结束任务：只有当前活动任务才能清空，防止旧任务覆盖新任务。 @param {BatchRun | null | undefined} run */
export function endBatchRun(run) {
    if (activeRun === run) activeRun = null;
}

/** 是否已有批量任务在执行。 */
export function isBatchRunActive() {
    return activeRun !== null;
}
