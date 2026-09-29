// @ts-check

/** Transitional facade for still-migrating callers; it owns no lifecycle or product behavior. */
export class BlacklistCompatibilityBean {
    /** @param {{executeCommand: (command: string, ...args: any[]) => Promise<any>, getSubjectInfo: () => any, batchAllVideos: (name: string, options?: any) => Promise<any>}} options */
    constructor(options) {
        this.executeCommand = options.executeCommand;
        this.getSubjectInfo = options.getSubjectInfo;
        this.batchAllVideos = options.batchAllVideos;
    }

    getName() { return "BlacklistPlugin"; }
    getActressPageInfo() { return this.getSubjectInfo(); }
    openBlacklistDialog() { return this.executeCommand("library.blacklist.open"); }
    /** @param {any} event */
    addBlacklist(event) { return this.executeCommand("library.blacklist.add", event); }
    /** @param {any} page @param {string} name @param {string} starId @param {string} site */
    parseBlacklistFilterInfo(page, name, starId, site) { return this.executeCommand("library.blacklist.parse", page, name, starId, site); }
    /** @param {any} page @param {string} name @param {string} starId @param {string} site */
    parseAndSaveFilterInfo(page, name, starId, site) { return this.executeCommand("library.blacklist.parse-and-save", page, name, starId, site); }
    /** @param {string} name @param {string} starId @param {any} page @param {string} site */
    filterActorVideo(name, starId, page, site) { return this.executeCommand("library.blacklist.scan-pages", name, starId, page, site); }
    resetBtnTip() { return this.executeCommand("library.blacklist.reset-tooltip"); }
    /** @param {string} name @param {any} [options] */
    filterAllVideo(name, options) { return this.batchAllVideos(name, options); }
}
