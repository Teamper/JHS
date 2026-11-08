// @ts-check
import { SelectionModel } from "../core/selection-model.js";
import { getMovieStateEligibility, normalizeCarNum } from "../core/movie-identity.js";

export const MOVIE_SELECTION_KEY = "jhs_movie_selection_v1";

/** Per-tab cross-page selections reuse the same selection model as History. */
export class MovieSelectionService extends EventTarget {
    /** @param {{origin: string, read: () => string | null, write: (value: string) => void}} persistence */
    constructor(persistence) {
        super();
        this.persistence = persistence;
        this.model = new SelectionModel(movie => normalizeCarNum(movie.carNum) || "");
        /** @type {Map<string, any>} */ this.records = new Map();
        this.warning = "";
        this.readOnly = false;
        try {
            const raw = persistence.read();
            if (!raw) return;
            const saved = JSON.parse(raw);
            if (saved.schema !== 1 || saved.origin !== persistence.origin || !Array.isArray(saved.records)) throw new Error("跨页选择记录版本或来源无效");
            const records = saved.records.map((/** @type {any} */ movie) => this.normalize(movie));
            if (new Set(records.map((/** @type {any} */ movie) => movie.carNum)).size !== records.length) throw new Error("跨页选择记录包含重复影片");
            this.records = new Map(records.map((/** @type {any} */ movie) => [movie.carNum, movie]));
            this.model.setMany(records, true);
        } catch {
            this.readOnly = true;
            this.warning = "跨页选择记录无法安全读取，已保留记录，请更新 JHS 后重试";
        }
    }
    /** @param {any} movie */
    normalize(movie) {
        if (!getMovieStateEligibility(movie).eligible) throw new Error("影片身份无法核对");
        const carNum = normalizeCarNum(movie.carNum), url = new URL(String(movie.url || ""), this.persistence.origin);
        if (!carNum || !["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("影片链接无效");
        return { carNum, url: `${url.origin}${url.pathname}`, title: String(movie.title || ""), names: String(movie.names || ""), ...(["fc2", "123av"].includes(movie.fc2Source) ? { fc2Source: movie.fc2Source } : {}) };
    }
    /** @param {any} movie */
    has(movie) { return this.model.has(movie); }
    values() { return this.model.values([...this.records.values()]).map(movie => ({ ...movie })); }
    /** @param {any[]} movies @param {boolean} selected */
    setMany(movies, selected) {
        if (this.readOnly) throw new Error(this.warning);
        const records = movies.map(movie => this.normalize(movie));
        for (const record of records) this.records.set(record.carNum, record);
        this.model.setMany(records, selected);
        this.persist();
    }
    /** @param {any} movie @param {boolean} selected */
    set(movie, selected) { this.setMany([movie], selected); }
    clear() {
        if (this.readOnly) throw new Error(this.warning);
        this.model.clear();
        this.records.clear();
        this.persist();
    }
    persist() {
        const selected = this.values();
        this.records = new Map(selected.map(movie => [movie.carNum, movie]));
        try {
            this.persistence.write(JSON.stringify({ schema: 1, origin: this.persistence.origin, records: selected }));
            this.warning = "";
        } catch { this.warning = "当前选择已保留在本页，跨页保存失败，请减少所选数量后重试"; }
        this.dispatchEvent(new CustomEvent("selection.changed", { detail: { count: selected.length, warning: this.warning } }));
    }
}
