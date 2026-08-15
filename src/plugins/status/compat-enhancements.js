class CompatibilityEnhancementsPlugin extends BasePlugin {
    getName() { return "CompatibilityEnhancementsPlugin"; }
    async handle() {
        await this.decorateActresses();
        $(document).off("actress-state-changed.jhsActress").on("actress-state-changed.jhsActress", (async () => { $(".jhs-actress-state-container").remove(); await this.decorateActresses(); }));
        if (isDetailPage) await this.addRemoveRecord();
        this.linkCommentImages();
    }
    async addRemoveRecord() {
        const carNum = this.getPageInfo().carNum; if (!carNum) return;
        if (!(await storageManager.getCarList()).some((item => item.carNum === carNum))) return;
        const button = $('<button type="button" class="jhs-btn jhs-btn--danger jhs-remove-car">移除记录</button>');
        $(".jhs-detail-btn-row,.movie-info-container,.container .info").first().append(button);
        button.on("click", (event => utils.q(event, `确定移除 ${carNum} 的鉴定记录？`, (async () => { await storageManager.removeCar(carNum); button.remove(); this.getBean("ListPagePlugin")?.showCarNumBox?.(carNum); show.ok("鉴定记录已移除"); }))));
    }
    async decorateActresses() {
        const favorites = new Set((await storageManager.getFavoriteActressList()).map((item => String(item.starId))));
        const blacklist = new Set((await storageManager.getBlacklist()).map((item => String(item.starId || item.id))));
        this.decorateCurrentActressProfile(favorites, blacklist);
        this.decorateActressCards(favorites, blacklist);
    }
    decorateCurrentActressProfile(favorites, blacklist) {
        const match = window.location.pathname.match(/^\/(?:actors|star)\/([^/?#]+)\/?$/); if (!match) return;
        const host = $(".actor-section-name,.star-name,h1.title").first(); if (!host.length) return;
        this.renderActressState(host, decodeURIComponent(match[1]), favorites, blacklist, "jhs-actress-profile-state");
    }
    decorateActressCards(favorites, blacklist) {
        $(".actor-box a[href], .actress-card a[href], [data-actress-card] a[href]").each(((index, element) => {
            const identity = getActressIdentityFromLink(element); if (!identity) return;
            const card = $(element).closest(".actor-box,.actress-card,[data-actress-card]");
            this.renderActressState(card, identity.starId, favorites, blacklist, "jhs-actress-card-state");
        }));
    }
    renderActressState(host, starId, favorites, blacklist, className) {
        if (host.children(".jhs-actress-state-container").length) return;
        const container = $(`<span class="jhs-actress-state-container ${className}"></span>`);
        favorites.has(starId) && container.append('<span class="jhs-badge jhs-badge--fav">已关注</span>');
        blacklist.has(starId) && container.append('<span class="jhs-badge jhs-badge--danger">已拉黑</span>');
        container.children().length && host.append(container);
    }
    linkCommentImages() {
        const images = $(".preview-images img,#sample-waterfall img,.movie-gallery img"); if (!images.length) return;
        $(".review-content").each(((index, element) => this.linkCommentImageTextNodes(element, images.length)));
        $(document).off("click.jhsCommentImage", ".jhs-comment-image-link").on("click.jhsCommentImage", ".jhs-comment-image-link", (event => { event.preventDefault(); const image = images.eq(Number($(event.currentTarget).data("image-index"))); image.length && showImageViewer(image[0]); }));
    }
    linkCommentImageTextNodes(element, imageCount) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT), nodes = [];
        while (walker.nextNode()) if (!$(walker.currentNode.parentElement).closest("a,button,code,pre,textarea,.jhs-comment-image-link").length && /(?:图|圖片|图片)\s*[一二三四五六七八九十\d]+/i.test(walker.currentNode.nodeValue || "")) nodes.push(walker.currentNode);
        nodes.forEach((textNode => {
            const text = textNode.nodeValue || "", pattern = /(?:图|圖片|图片)\s*([一二三四五六七八九十\d]+)/gi, fragment = document.createDocumentFragment();
            let cursor = 0, match;
            while ((match = pattern.exec(text))) {
                match.index > cursor && fragment.append(document.createTextNode(text.slice(cursor, match.index)));
                const chinese = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }, index = (chinese[match[1]] || Number(match[1])) - 1;
                if (index >= 0 && index < imageCount) { const link = document.createElement("a"); link.href = "#"; link.className = "jhs-comment-image-link"; link.dataset.imageIndex = String(index); link.textContent = match[0]; fragment.append(link); } else fragment.append(document.createTextNode(match[0]));
                cursor = match.index + match[0].length;
            }
            cursor < text.length && fragment.append(document.createTextNode(text.slice(cursor)));
            textNode.replaceWith(fragment);
        }));
    }
}

function getActressIdentityFromLink(element) {
    const link = $(element);
    if (link.closest('.toolbar,.tabs,.buttons,.pagination,.filter,.filters,nav,header,[role="tablist"]').length) return null;
    const url = new URL(link.attr("href"), window.location.href);
    if (url.search || url.hash) return null;
    const match = url.pathname.match(/^\/(?:actors|star)\/([^/]+)\/?$/);
    return match ? { starId: decodeURIComponent(match[1]), url: url.href } : null;
}
