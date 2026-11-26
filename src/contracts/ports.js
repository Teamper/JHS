// @ts-check

/** @typedef {object} StoragePort
 * @property {(key: string) => Promise<unknown>} get
 * @property {(key: string, value: unknown) => Promise<void>} set
 * @property {(key: string) => Promise<void>} remove
 * @property {() => Promise<string[]>} keys
 * @property {(key: string) => string | null} getLocal
 * @property {(key: string, value: string) => void} setLocal
 * @property {(key: string) => void} removeLocal
 * @property {(key: string, fallback?: unknown) => unknown} getValue
 * @property {(key: string, value: unknown) => void} setValue
 * @property {(key: string) => void} removeValue
 * @property {() => string[]} [listValues]
 * @property {(key: string, callback: () => void) => any} [listenValue]
 * @property {(listener: any) => void} [unlistenValue]
 */

/** Optional fast commit under the shared storage mutation lock. False guarantees
 * that the native capability was unavailable before any write was attempted.
 * @typedef {{commitLockedBatch: (batch: {puts: Record<string, any>, deletes?: string[], signal?: AbortSignal}) => Promise<boolean>}} LockedBatchStoragePort
 */

/** Optional capability: both methods must be present for safe portable import.
 * expected entries distinguish a missing key from an existing null value;
 * implementations compare and write within one native transaction and resolve
 * only after durable commit. Portable export does not require this capability.
 * @typedef {{readAtomicSnapshot: (keys: string[]) => Promise<Record<string, {exists: boolean, value?: any}>>, commitAtomicBatch: (batch: {expected: Record<string, {exists: boolean, value?: any}>, puts: Record<string, any>, deletes: string[], signal?: AbortSignal}) => Promise<void>}} AtomicStoragePort
 */

export {};
