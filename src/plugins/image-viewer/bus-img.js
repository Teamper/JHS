class BusImgPlugin extends BasePlugin {
    getName() {
        return "BusImgPlugin";
    }
    handle() {}
    async getVisibleImageItems(e, t) {
        let n = [];
        const a = document.querySelectorAll(e);
        for (const i of a) {
            if (!utils.isHidden(i)) {
                const e = i.querySelector(t);
                if (!(e instanceof HTMLImageElement)) continue;
                e.style.removeProperty("height");
                let a = e.offsetHeight;
                a > 0 && n.push({
                    element: i,
                    imgElement: e,
                    height: a
                });
            }
        }
        return n;
    }
    async logImageHeightsByRow() {
        if (await storageManager.getSetting("enableVerticalModel", C) === _) return;
        const e = this.getSelector().itemSelector, t = await storageManager.getSetting("containerColumns", 5), n = await this.getVisibleImageItems(e, "img");
        if (0 === n.length) return;
        const a = [];
        for (let i = 0; i < n.length; i++) {
            const e = Math.floor(i / t);
            a[e] || (a[e] = []), a[e].push(n[i]);
        }
        a.forEach(((e, t) => {
            const n = e.map((e => e.height));
            if (n.length < 2) return;
            const a = Math.min(...n), i = Math.max(...n);
            let s = 0;
            i - a > 50 && (s = a, e.forEach((e => {
                if (e.height !== s) {
                    const t = `${s}px`;
                    e.imgElement.style.setProperty("height", t, "important");
                }
            })));
        }));
    }
}
