// @ts-check
import { JhsError } from "../core/jhs-error.js";

/** @typedef {import("../integrations/javdb/web-review.js").ReviewMovie} ReviewMovie */
/** @typedef {import("../integrations/javdb/web-review.js").ReviewAction} ReviewAction */
/** @typedef {import("../integrations/javdb/web-review.js").ReviewStatus} ReviewStatus */
/** @typedef {import("../integrations/javdb/web-review.js").WebReview} WebReview */
/** @typedef {import("../core/lifecycle-scope.js").LifecycleScope} Scope */
/** @typedef {{origin: string, account: {fingerprint: string, label: string}}} WebSession */
/** @typedef {{status: ReviewStatus, score: number | null, hasComment: boolean, scoreRequired: boolean, actions: ReviewAction[]}} ReviewView */
/** @typedef {{outcome: "confirmed" | "pending" | "changed" | "rejected", state?: ReviewView}} ReviewResult */

const targets = /** @type {const} */ ({ want: "want_watch", watch: "watched", unwatch: "unmarked" });

/** Fresh webpage state owns both account actions. Forms and account evidence stay in memory. */
export class JavDbWebReviewService {
    /** @param {{integrations: Pick<import("../app/integration-registry.js").IntegrationRegistry, "getAdapter">, lists: Pick<import("./javdb-list-service.js").JavDbListService, "currentContext" | "access">, locks?: LockManager | null}} dependencies */
    constructor({ integrations, lists, locks = globalThis.navigator?.locks }) {
        this.integrations = integrations;
        this.lists = lists;
        this.locks = locks;
        /** @type {WeakMap<ReviewView, {session: WebSession, movieId: string, signature: string}>} */
        this.evidence = new WeakMap();
        /** @type {Map<string, Promise<ReviewResult>>} */
        this.writes = new Map();
    }

    /** @param {ReviewMovie} movie @param {Scope} scope */
    async current(movie, scope) {
        scope.assertActive();
        const { origin } = this.lists.currentContext();
        const adapter = this.integrations.getAdapter("javdb");
        const [account, review] = await Promise.allSettled([
            this.lists.access(scope),
            adapter.readWebReview(origin, movie, scope),
        ]);
        scope.assertActive();
        if (review.status === "rejected" && review.reason?.code === "AUTH_REQUIRED") throw review.reason;
        if (account.status === "rejected") throw account.reason;
        if (!account.value.account) throw new JhsError("AUTH_REQUIRED", "请登录 JavDB 网页账号");
        if (review.status === "rejected") throw review.reason;
        const latest = await this.lists.access(scope);
        scope.assertActive();
        if (origin !== account.value.origin || origin !== latest.origin || account.value.account.fingerprint !== latest.account?.fingerprint) {
            throw new JhsError("INVALID_RESPONSE", "JavDB 网页账号已变化，请刷新状态");
        }
        const session = { origin, account: account.value.account };
        return { session, review: /** @type {WebReview} */ (review.value) };
    }

    /** @param {WebReview} review */
    signature(review) {
        return JSON.stringify([review.status, review.reviewId, review.score, review.comment, review.scoreRequired, Object.keys(review.actions)]);
    }

    /** @param {ReviewMovie} movie @param {WebSession} session @param {WebReview} review @returns {ReviewView} */
    summarize(movie, session, review) {
        const actions = /** @type {ReviewAction[]} */ (Object.keys(review.actions));
        const view = { status: review.status, score: review.score, hasComment: Boolean(review.comment.trim()), scoreRequired: review.scoreRequired, actions };
        this.evidence.set(view, { session, movieId: movie.movieId, signature: this.signature(review) });
        return view;
    }

    /** @param {ReviewMovie} movie @param {{scope: Scope}} options */
    async read(movie, { scope }) {
        const { session, review } = await this.current(movie, scope);
        return this.summarize(movie, session, review);
    }

    /** @param {ReviewMovie} movie @param {{action: ReviewAction, expected: ReviewView, score?: number}} input @param {{scope: Scope}} options @returns {Promise<ReviewResult>} */
    async update(movie, { action, expected, score }, { scope }) {
        const baseline = this.evidence.get(expected);
        if (!baseline || baseline.movieId !== movie.movieId || !expected.actions.includes(action)) {
            throw new JhsError("INVALID_RESPONSE", "请先刷新 JavDB 观影状态");
        }
        const key = ["jhs_javdb_web_review", baseline.session.origin, baseline.session.account.fingerprint, movie.movieId].join(":");
        const execute = async () => {
            const { session, review } = await this.current(movie, scope);
            const state = this.summarize(movie, session, review);
            const actionRequest = review.actions[action];
            if (session.origin !== baseline.session.origin || session.account.fingerprint !== baseline.session.account.fingerprint
                || this.signature(review) !== baseline.signature || !actionRequest) {
                return /** @type {const} */ ({ outcome: "changed", state });
            }
            if (action === "watch" && score !== undefined && (!Number.isInteger(score) || score < 1 || score > 5)) {
                throw new JhsError("INVALID_RESPONSE", "请选择 1 至 5 分");
            }
            if (action === "watch" && review.scoreRequired && score === undefined && review.score === null) {
                throw new JhsError("INVALID_RESPONSE", "JavDB 要求先选择评分");
            }
            let rejected = false;
            try {
                await this.integrations.getAdapter("javdb").sendWebReview(actionRequest, action === "watch" ? score : undefined, scope);
            } catch (error) {
                scope.assertActive();
                const httpStatus = Number(/** @type {JhsError} */ (error).details?.status);
                rejected = httpStatus >= 400 && httpStatus < 500;
            }

            try {
                const next = await this.current(movie, scope);
                if (session.origin !== next.session.origin || session.account.fingerprint !== next.session.account.fingerprint) return /** @type {const} */ ({ outcome: "pending" });
                const state = this.summarize(movie, next.session, next.review);
                if (next.review.status === targets[action]) return /** @type {const} */ ({ outcome: "confirmed", state });
                return /** @type {const} */ ({ outcome: rejected ? "rejected" : "pending", state });
            } catch {
                scope.assertActive();
                return /** @type {const} */ ({ outcome: "pending" });
            }
        };

        scope.assertActive();
        if (this.locks) return this.locks.request(key, { signal: scope.signal }, execute);
        const pending = this.writes.get(key);
        const operation = pending ? pending.then(execute, execute) : execute();
        this.writes.set(key, operation);
        try { return await operation; }
        finally { if (this.writes.get(key) === operation) this.writes.delete(key); }
    }
}
