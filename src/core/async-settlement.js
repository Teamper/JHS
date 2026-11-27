// @ts-check

/** Wait for an operation whose failure is already owned by its initiating caller or service.
 * @param {PromiseLike<unknown> | null | undefined} operation
 */
export async function waitForSettlement(operation) {
    await Promise.allSettled([operation]);
}
