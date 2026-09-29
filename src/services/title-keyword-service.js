// @ts-check

/** Compatibility boundary for the 6.5.1 title-keyword key and cross-tab write lock. */
export class TitleKeywordService {
    /** @param {{saveTitleFilterKeyword: (keyword: string) => Promise<unknown>, getTitleFilterKeyword?: () => Promise<string[]>} | undefined} legacyStorage */
    constructor(legacyStorage) {
        const save = legacyStorage?.saveTitleFilterKeyword;
        const getAll = legacyStorage?.getTitleFilterKeyword;
        /** @type {(keyword: string) => Promise<unknown>} */
        this.add = async (keyword) => {
            if (typeof save !== "function") throw new Error("标题关键词存储兼容服务不可用");
            return save.call(legacyStorage, keyword);
        };
        /** @type {() => Promise<string[]>} */
        this.getAll = async () => {
            if (typeof getAll !== "function") throw new Error("标题关键词读取兼容服务不可用");
            return getAll.call(legacyStorage);
        };
        Object.freeze(this);
    }
}
