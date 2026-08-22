class FilterTitleKeywordPlugin extends BasePlugin {
    getName() {
        return "FilterTitleKeywordPlugin";
    }
    async handle() {
        if (!isDetailPage && !isFc2Page) return;
        if (await storageManager.getSetting("enableTitleSelectFilter", _) !== _) return;
        let e;
        r ? e = ".title strong, .current-title" : l && (e = "h3"), utils.rightClick(document.body, e, (e => {
            const t = window.getSelection().toString();
            if (t) {
                e.preventDefault();
                let n = {
                    clientX: e.clientX,
                    clientY: e.clientY + 80
                };
                utils.q(n, `是否屏蔽标题关键词 ${t}?`, (async () => {
                    await storageManager.saveTitleFilterKeyword(t), await jhsEventBus.emit("filter-rules-changed", { scope: "title-keyword" }), utils.closePage();
                }));
            }
        }));
    }
}
