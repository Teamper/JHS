// @ts-check

/** 共享异步队列：任务串行执行，调用方拿到各自任务的 Promise，内部链恢复失败不阻塞后续任务。 */
export class StorageQueue {
    /** @param {Pick<Console, 'error'>} [logger] */
    constructor(logger = console) {
        this.logger = logger;
        /** @type {Promise<unknown>} */ this.queue = Promise.resolve();
    }
    /** @param {() => unknown | Promise<unknown>} e */
    addTask(e) {
        const task = this.queue.then((() => e()));
        return this.queue = task.catch((e => {
            this.logger.error("执行异步队列任务失败:", e);
        })), task;
    }
    async waitAllFinished() {
        return this.queue;
    }
}
