// @ts-check

/** @param {string} category @param {string} id */
function createToken(category, id) {
    return Symbol.for(`jhs.${category}.${id}`);
}

export const PORT = Object.freeze({
    style: createToken("port", "style"),
    host: createToken("port", "host"),
    javdbHost: createToken("port", "javdb-host"),
    javbusHost: createToken("port", "javbus-host"),
});

export const SERVICE = Object.freeze({
    taskExecution: createToken("service", "task-execution"),
    clog: createToken("service", "clog"),
    http: createToken("service", "http"),
    storage: createToken("service", "storage"),
    credential: createToken("service", "credential"),
    dialog: createToken("service", "dialog"),
    settings: createToken("service", "settings"),
    settingsTools: createToken("service", "settings-tools"),
    notifications: createToken("service", "notifications"),
    clipboard: createToken("service", "clipboard"),
    movie: createToken("service", "movie"),
    actressInfo: createToken("service", "actress-info"),
    domUi: createToken("service", "dom-ui"),
    detailContent: createToken("service", "detail-content"),
    magnet: createToken("service", "magnet"),
    screenshot: createToken("service", "screenshot"),
    translation: createToken("service", "translation"),
    subtitle: createToken("service", "subtitle"),
    privacy: createToken("service", "privacy"),
    mediaLibrary: createToken("service", "media-library"),
    javdbLists: createToken("service", "javdb-lists"),
    movieSelection: createToken("service", "movie-selection"),
    account: createToken("service", "account"),
    offline: createToken("service", "offline"),
    keywordRules: createToken("service", "keyword-rules"),
    state: createToken("service", "state"),
    storageMutation: createToken("service", "storage-mutation"),
    busImageLayout: createToken("service", "bus-image-layout"),
    events: createToken("service", "events"),
    profile: createToken("service", "profile"),
});

export const REGISTRY = Object.freeze({
    integration: createToken("registry", "integration"),
});

export const CACHE = Object.freeze({
    externalDetail: "external-detail-v1",
});
