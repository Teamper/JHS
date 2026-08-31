// @ts-check

/** 区分正常页面、合法空列表和第三方拦截页。 @param {any} page @param {{boxSelector: string, requestDomItemSelector: string}} selectors */
export function parseHostListPage(page, selectors) {
    const challengeText = page.find("title, body").text();
    const isChallenge = /Just a moment|cf-chl-|Cloudflare/i.test(challengeText);
    const hasContainer = page.find(selectors.boxSelector).length > 0;
    return {
        state: isChallenge ? "challenge" : hasContainer ? "valid" : "invalid",
        items: hasContainer ? page.find(selectors.requestDomItemSelector) : null,
        isEmpty: hasContainer && page.find(selectors.requestDomItemSelector).length === 0,
    };
}
