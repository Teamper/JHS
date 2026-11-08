// @ts-check
import { normalizeCarNum, assertMovieStateEligible } from "../core/movie-identity.js";
import { matches115FileName, normalize115Keyword } from "../core/one-one-five-file-identity.js";

/** @typedef {{ accountId: string, carNum: string, stage: number, offset: number, matches: any[] }} MatchContinuation */
/** @typedef {{ matches: any[], complete: boolean, continuation: MatchContinuation | null }} MatchResult */

/** Shared, account-bound matching for cards, details and subtitle destinations. */
export class OneOneFiveMatchService {
    /** @param {any} offline */
    constructor(offline) {
        this.offline = offline;
        /** @type {Map<string, {expires: number, result: MatchResult}>} */ this.cache = new Map();
        this.accountId = "";
        this.generation = 0;
    }

    clear() { this.cache.clear(); this.generation++; }

    /** @param {{carNum?: unknown}} movie @param {{scope?: any, ttlMs?: number, force?: boolean, continuation?: MatchContinuation | null}} [options] @returns {Promise<MatchResult>} */
    async matchMovie(movie, options = {}) {
        assertMovieStateEligible(movie);
        const carNum = /** @type {string} */ (normalizeCarNum(movie.carNum));
        const keyword = /** @type {string} */ (normalize115Keyword(carNum));
        options.scope?.assertActive();
        if (typeof this.offline.searchFilePage !== "function") {
            const files = await this.offline.searchFiles("one115", keyword, options);
            return { matches: files.filter((/** @type {any} */ file) => matches115FileName(file.name, carNum)), complete: true, continuation: null };
        }
        const identity = await this.offline.getAccountIdentity("one115", { scope: options.scope });
        options.scope?.assertActive();
        const accountId = String(identity.accountId);
        if (!accountId) throw new Error("115 账号身份尚未确认");
        if (this.accountId !== accountId) { this.clear(); this.accountId = accountId; }
        const key = `${accountId}:${carNum}`;
        if (options.force) { this.cache.delete(key); this.generation++; }
        const cached = this.cache.get(key);
        if (!options.force && !options.continuation && cached && cached.expires > Date.now()) return structuredClone(cached.result);
        const generation = this.generation;
        const cursor = options.continuation;
        if (cursor && (cursor.accountId !== accountId || cursor.carNum !== carNum)) throw new Error("115 账号或影片已变化，请重新匹配");
        if (cursor && (!Number.isInteger(cursor.stage) || cursor.stage < 0 || cursor.stage > 1 || !Number.isSafeInteger(cursor.offset) || cursor.offset < 0)) throw new TypeError("115 匹配进度无效");
        const tail = carNum.match(/(?:-|^)(\d+)$/)?.[1];
        const keywords = [...new Set([keyword, ...(tail ? [tail.replace(/^0+(?=\d)/, "")] : [])])];
        if (cursor && cursor.stage >= keywords.length) throw new TypeError("115 匹配进度无效");
        let stage = cursor?.stage ?? 0, offset = cursor?.offset ?? 0;
        const matches = new Map((cursor?.matches || []).map(file => [file.fileId || `${file.folderId}:${file.name}`, file]));
        const seenPages = new Set();
        let complete = false;
        for (let pages = 0; pages < 10; pages++) {
            options.scope?.assertActive();
            const page = await this.offline.searchFilePage("one115", keywords[stage], { scope: options.scope, offset, limit: 100, force: options.force });
            options.scope?.assertActive();
            const fingerprint = `${stage}:` + JSON.stringify(page.items.map((/** @type {any} */ file) => file.fileId || `${file.folderId}:${file.name}`));
            if (page.items.length && seenPages.has(fingerprint)) throw new Error("115 返回了重复分页，请稍后重试");
            seenPages.add(fingerprint);
            for (const file of page.items) if (matches115FileName(file.name, carNum)) matches.set(file.fileId || `${file.folderId}:${file.name}`, { ...file, accountId });
            if (page.hasMore) {
                if (!(page.nextOffset > offset)) throw new Error("115 分页未推进");
                offset = page.nextOffset;
            } else if (!matches.size && stage + 1 < keywords.length) {
                stage++; offset = 0;
            } else { complete = true; break; }
        }
        const current = await this.offline.getAccountIdentity("one115", { scope: options.scope });
        options.scope?.assertActive();
        if (String(current.accountId) !== accountId) { this.clear(); throw new Error("115 账号已切换，请重新匹配"); }
        const result = { matches: [...matches.values()], complete, continuation: complete ? null : { accountId, carNum, stage, offset, matches: [...matches.values()] } };
        if (complete && generation === this.generation && this.accountId === accountId) {
            const ttl = Math.min(86_400_000, Math.max(0, options.ttlMs ?? 3_600_000));
            this.cache.set(key, { expires: Date.now() + ttl, result: structuredClone(result) });
            while (this.cache.size > 1000) this.cache.delete(/** @type {string} */ (this.cache.keys().next().value));
        }
        return result;
    }
}
