const ie = class e {
    constructor() {
        if (new.target === e) throw new Error("HotkeyManager cannot be instantiated.");
    }
    static registerHotkey(e, t, n = null) {
        if (Array.isArray(e)) {
            let a = [];
            return e.forEach((e => {
                if (!this.isHotkeyFormat(e)) throw new Error("快捷键格式错误");
                let i = this.recordHotkey(e, t, n);
                a.push(i);
            })), a;
        }
        if (!this.isHotkeyFormat(e)) throw new Error("快捷键格式错误");
        return this.recordHotkey(e, t, n);
    }
    static recordHotkey(e, t, n) {
        let a = Math.random().toString(36).substr(2);
        return this.registerHotKeyMap.set(a, {
            hotkeyString: e,
            callback: t,
            keyupCallback: n
        }), a;
    }
    static unregisterHotkey(e) {
        this.registerHotKeyMap.has(e) && this.registerHotKeyMap.delete(e);
    }
    static isHotkeyFormat(e) {
        return e.toLowerCase().split("+").map((e => e.trim())).every((e => [ "ctrl", "shift", "alt" ].includes(e) || 1 === e.length));
    }
    static judgeHotkey(e, t) {
        const n = e.toLowerCase().split("+").map((e => e.trim())), a = n.includes("ctrl"), i = n.includes("shift"), s = n.includes("alt"), o = n.find((e => "ctrl" !== e && "shift" !== e && "alt" !== e));
        return (this.isMac ? t.metaKey : t.ctrlKey) === a && t.shiftKey === i && t.altKey === s && t.key.toLowerCase() === o;
    }
};

i(ie, "isMac", 0 === navigator.platform.indexOf("Mac")), i(ie, "registerHotKeyMap", new Map),
i(ie, "handleKeydown", (e => {
    for (const [t, n] of ie.registerHotKeyMap) {
        let t = n.hotkeyString, a = n.callback;
        ie.judgeHotkey(t, e) && a(e);
    }
})), i(ie, "handleKeyup", (e => {
    for (const [t, n] of ie.registerHotKeyMap) {
        let t = n.hotkeyString, a = n.keyupCallback;
        a && (ie.judgeHotkey(t, e) && a(e));
    }
}));

let se = ie;

document.addEventListener("keydown", (e => {
    se.handleKeydown(e);
})), document.addEventListener("keyup", (e => {
    se.handleKeyup(e);
}));

class oe extends X {
    getName() {
        return "JavTrailersPlugin";
    }
    constructor() {
        super(), this.hasBand = !1;
    }
    handle() {
        let e = window.location.href;
        if (!e.includes("handle=1")) return;
        if ($("h1:contains('Page not found')").length) {
            clog.log("番号无法匹配, 跳搜索");
            let t = e.split("?")[0].split("video/")[1].toLowerCase().replace("00", "-");
            return void (window.location.href = "/search/" + encodeURIComponent(t) + window.location.search);
        }
        let t = $(".videos-list .video-link").toArray();
        if (t.length) {
            const n = e.split("?")[0].split("search/")[1].toLowerCase(), a = t.find((e => $(e).find(".vid-title").text().toLowerCase().includes(n)));
            if (a) return void (window.location.href = $(a).attr("href") + window.location.search);
        }
        this.handlePlayJavTrailers(), $("#videoPlayerContainer").on("click", (() => {
            this.handlePlayJavTrailers();
        })), window.addEventListener("message", (e => {
            let t = document.getElementById("vjs_video_3_html5_api");
            t && (t.currentTime += 5);
        }));
        const n = new URLSearchParams(window.location.search), a = n.get("filterHotKey"), i = n.get("favoriteHotKey"), s = n.get("speedVideoHotKey");
        a && se.registerHotkey(a, (() => window.parent.postMessage(a, "*"))), i && se.registerHotkey(i, (() => window.parent.postMessage(i, "*"))),
        s && se.registerHotkey(s, (() => {
            const e = document.getElementById("vjs_video_3_html5_api");
            e && (e.currentTime += 5);
        }));
    }
    handlePlayJavTrailers() {
        this.hasBand || (utils.loopDetector((() => 0 !== $("#vjs_video_3_html5_api").length), (() => {
            setTimeout((() => {
                this.hasBand = !0;
                let e = document.getElementById("vjs_video_3_html5_api");
                clog.debug(e), e.play(), e.currentTime = 5, e.addEventListener("timeupdate", (function() {
                    e.currentTime >= 14 && e.currentTime < 16 && (e.currentTime += 2);
                })), $("#vjs_video_3_html5_api").css({
                    position: "fixed",
                    width: "100vw",
                    height: "100vh",
                    objectFit: "cover",
                    zIndex: "999999999"
                }), $(".vjs-control-bar").css({
                    position: "fixed",
                    bottom: "20px",
                    zIndex: "999999999"
                });
            }), 100);
        })), utils.loopDetector((() => $("#vjs_video_3 canvas").length > 0), (() => {
            0 !== $("#vjs_video_3 canvas").length && $("#vjs_video_3 canvas").css({
                position: "fixed",
                width: "100vw",
                height: "100vh",
                objectFit: "cover",
                top: "0",
                right: "0",
                zIndex: "999999998"
            });
        })));
    }
}
