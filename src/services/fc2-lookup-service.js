// @ts-check

/** Shared FC2/123AV data capability used by list and owned-detail surfaces. */
export class Fc2LookupService {
    /** @param {{movie?: any, scope?: any}} [options] */
    constructor(options = {}) {
        this.movie = options.movie ?? null;
        this.scope = options.scope ?? null;
        this.lifecycleScope = null;
    }

    /** @param {{scope?: any}} [options] */
    async getLifecycleScope(options = {}) {
        if (options.scope) return options.scope;
        if (this.lifecycleScope) return this.lifecycleScope;
        return this.lifecycleScope = typeof this.scope === "function" ? await this.scope() : this.scope;
    }

    /** @param {string} carNum @param {{scope?: any}} [options] */
    async resolveMovieId(carNum, options = {}) {
        const scope = await this.getLifecycleScope(options);
        return (await this.movie.resolve({ carNum }, { scope }))?.movieId || null;
    }

    /** @param {string} carNum @param {string} url @param {{scope?: any}} [options] */
    async getVideoInfo(carNum, url, options = {}) {
        const scope = await this.getLifecycleScope(options);
        const detail = await this.movie.detail({ carNum, url, providerId: "av123" }, { scope });
        return { title: detail?.title || "", publishDate: detail?.releaseDate || "", moviePoster: null };
    }

    /** @param {string} carNum @param {{scope?: any}} [options] */
    async getPeople(carNum, options = {}) {
        const scope = await this.getLifecycleScope(options);
        return this.movie.people("fc2ppvdb", { carNum }, { scope });
    }

    /** @param {string} carNum @param {{scope?: any}} [options] */
    async getImages(carNum, options = {}) {
        const scope = await this.getLifecycleScope(options);
        return (await this.movie.images("fc2content", { carNum }, { scope })).map((/** @type {{url: string}} */ item) => item.url);
    }
}
