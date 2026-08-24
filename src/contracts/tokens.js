// @ts-check

/** @param {string} category @param {string} id */
function createToken(category, id) {
    return Symbol.for(`jhs.${category}.${id}`);
}

export const PORT = Object.freeze({
    navigation: createToken("port", "navigation"),
    http: createToken("port", "http"),
    storage: createToken("port", "storage"),
    dialog: createToken("port", "dialog"),
    style: createToken("port", "style"),
    host: createToken("port", "host"),
});

export const SERVICE = Object.freeze({
    diagnostics: createToken("service", "diagnostics"),
    urlPolicy: createToken("service", "url-policy"),
    navigation: createToken("service", "navigation"),
    http: createToken("service", "http"),
    storage: createToken("service", "storage"),
    webdav: createToken("service", "webdav"),
    dialog: createToken("service", "dialog"),
    settings: createToken("service", "settings"),
    movie: createToken("service", "movie"),
    actressInfo: createToken("service", "actress-info"),
    review: createToken("service", "review"),
    related: createToken("service", "related"),
    magnet: createToken("service", "magnet"),
    screenshot: createToken("service", "screenshot"),
    translation: createToken("service", "translation"),
    subtitle: createToken("service", "subtitle"),
    account: createToken("service", "account"),
    offline: createToken("service", "offline"),
    cache: createToken("service", "cache"),
    state: createToken("service", "state"),
    profile: createToken("service", "profile"),
});

export const REGISTRY = Object.freeze({
    command: createToken("registry", "command"),
    feature: createToken("registry", "feature"),
    provider: createToken("registry", "provider"),
    settings: createToken("registry", "settings"),
    integration: createToken("registry", "integration"),
});

export const CACHE = Object.freeze({
    externalDetail: "external-detail-v1",
});
