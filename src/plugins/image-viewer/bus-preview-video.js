const ENCRYPTION_SALT = "x7k9p3";

async function getEncryptionKey() {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(ENCRYPTION_SALT + ".jhs.v1"), {
        name: "PBKDF2"
    }, false, [ "deriveKey" ]);
    return crypto.subtle.deriveKey({
        name: "PBKDF2",
        salt: enc.encode("jhs-backup"),
        iterations: 1e5,
        hash: "SHA-256"
    }, keyMaterial, {
        name: "AES-GCM",
        length: 256
    }, false, [ "encrypt", "decrypt" ]);
}

function arrayBufferToBase64(e) {
    const t = new Uint8Array(e), n = 0x8000;
    let a = "";
    for (let i = 0; i < t.length; i += n) a += String.fromCharCode.apply(null, t.subarray(i, i + n));
    return btoa(a);
}

function base64ToArrayBuffer(e) {
    const t = atob(e), n = new Uint8Array(t.length);
    for (let a = 0; a < t.length; a++) n[a] = t.charCodeAt(a);
    return n;
}

async function encryptData(e) {
    const t = await getEncryptionKey(), n = crypto.getRandomValues(new Uint8Array(12)), a = new TextEncoder(), i = await crypto.subtle.encrypt({
        name: "AES-GCM",
        iv: n
    }, t, a.encode(e)), s = new Uint8Array(n.length + i.byteLength);
    return s.set(n), s.set(new Uint8Array(i), n.length), arrayBufferToBase64(s);
}

async function decryptData(e) {
    const t = await getEncryptionKey(), n = base64ToArrayBuffer(e), a = n.slice(0, 12), i = n.slice(12), s = await crypto.subtle.decrypt({
        name: "AES-GCM",
        iv: a
    }, t, i);
    return new TextDecoder().decode(s);
}

const CREDENTIAL_PREFIX = "AES:";

async function encryptCredential(e) {
    return e && !e.startsWith(CREDENTIAL_PREFIX) ? CREDENTIAL_PREFIX + await encryptData(e) : e;
}

async function decryptCredential(e) {
    return e && e.startsWith(CREDENTIAL_PREFIX) ? await decryptData(e.slice(CREDENTIAL_PREFIX.length)) : e;
}

class je extends X {
    getName() {
        return "BusPreviewVideoPlugin";
    }
    async initCss() {
        return "\n            /* 弹窗/Modal 样式 */\n            .bus-preview-modal {\n                position: fixed;\n                top: 0;\n                left: 0;\n                width: 100%;\n                height: 100%;\n                background-color: rgba(0, 0, 0, 0.95); \n                /* 关键修改：更新 z-index */\n                z-index: 12345699; \n                display: flex;\n                justify-content: center;\n                align-items: center;\n                opacity: 0; \n                visibility: hidden; \n                transition: opacity 0.2s ease;\n            }\n            .bus-preview-modal.is-open {\n                opacity: 1;\n                visibility: visible;\n            }\n            /* 垂直排列视频和按钮，并居中 */\n            .bus-preview-modal-content {\n                position: relative;\n                max-width: 95%; \n                max-height: 95%;\n                display: flex; \n                flex-direction: column; \n                align-items: center; \n                gap: 15px; \n            }\n            \n            /* 移除 .bus-preview-close-btn 的样式 */\n\n            /* 视频播放器容器 */\n            .video-player-wrapper {\n                /* 关键修改：更新 width 和 max-height */\n                width: 80vw; \n                max-height: 85vh; \n                aspect-ratio: 16 / 9; \n                position: relative; \n                background-color: black; \n                max-width: 100%; \n            }\n            /* 视频元素 */\n            .video-player-wrapper #preview-video {\n                position: absolute; \n                top: 0;\n                left: 0;\n                width: 100%;\n                height: 100%;\n                display: block;\n            }\n\n            /* 画质控制盒 (底部按钮) */\n            .video-control-box {\n                display: flex;\n                flex-direction: row; \n                justify-content: center; \n                flex-wrap: wrap; \n                gap: 10px;\n                padding: 10px 0; \n            }\n\n            /* 按钮样式 (保留) */\n            .video-control-btn {\n                min-width:80px;\n                padding: 6px 12px;\n                background: rgba(255,255,255,0.2);\n                color: white;\n                border: 1px solid rgba(255,255,255,0.5);\n                border-radius: 4px;\n                cursor: pointer;\n                text-align: center;\n                font-size: 14px;\n                transition: background-color 0.2s, border-color 0.2s;\n            }\n            .video-control-btn:hover {\n                background: rgba(255,255,255,0.4);\n            }\n            .video-control-btn.active {\n                background-color: #1890ff; \n                color: white;\n                font-weight: bold;\n                border: 1px solid #096dd9;\n            }\n        ";
    }
    initModal() {
        if (0 === $("#bus-preview-modal").length) {
            $("body").append('\n                <div id="bus-preview-modal" class="bus-preview-modal">\n                    <div class="bus-preview-modal-content">\n                        </div>\n                </div>\n            ');
            const e = $("#bus-preview-modal");
            e.on("click", (e => {
                "bus-preview-modal" === e.target.id && this.closeVideoModal();
            })), $(document).on("keydown", (t => {
                "Escape" === t.key && e.hasClass("is-open") && this.closeVideoModal();
            }));
        }
    }
    closeVideoModal() {
        const e = $("#preview-video");
        e.length > 0 && e[0].pause(), $("#bus-preview-modal").removeClass("is-open");
    }
    async handle() {
        if (!isDetailPage) return;
        this.initModal();
        const e = $("#sample-waterfall .sample-box .photo-frame img:first").attr("src"), t = $(`\n            <a class="preview-video-container sample-box" style="cursor: pointer">\n                <div class="photo-frame" style="position:relative;">\n                    <img src="${e}" class="video-cover" alt="">\n                    <div class="play-icon" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); \n                                color:white; font-size:40px; text-shadow:0 0 10px rgba(0,0,0,0.5);">\n                        ▶\n                    </div>\n                </div>\n            </a>`);
        $("#sample-waterfall").prepend(t);
        "yes" === await storageManager.getSetting("enableLoadPreviewVideo", "yes") && ne(this.getPageInfo().carNum, !1).then();
        let n = !1, a = $(".preview-video-container");
        a.on("click", (async e => {
            if (e.preventDefault(), e.stopPropagation(), n) show.info("正在加载中, 勿重复点击"); else {
                n = !0;
                try {
                    await this.handleVideo();
                } finally {
                    n = !1;
                }
            }
        })), window.location.href.includes("autoPlay=1") && a.trigger("click");
    }
    async handleVideo() {
        const e = $("#bus-preview-modal"), t = e.find(".bus-preview-modal-content");
        let n = $("#preview-video");
        if (n.length > 0) return e.addClass("is-open"), void n[0].play().catch((e => console.warn("尝试播放失败 (可能被浏览器阻止):", e)));
        let a = this.getPageInfo().carNum;
        const i = await ne(a);
        i && 0 !== Object.keys(i).length ? (await this.createVideoPlayerAndControls(i, t),
        n = $("#preview-video"), n.length > 0 ? (e.addClass("is-open"), n[0].play().catch((e => console.warn("尝试播放失败 (可能被浏览器阻止):", e)))) : show.error("视频播放器创建失败。")) : show.error("未找到可用的视频源。");
    }
    async createVideoPlayerAndControls(e, t) {
        let n = await storageManager.getSetting("videoQuality");
        n = Z(Object.keys(e), n);
        let a = e[n];
        t.html(`\n            <div class="video-player-wrapper">\n                <video id="preview-video" controls playsinline>\n                    <source src="${a}" />\n                </video>\n            </div>\n            <div class="video-control-box">\n                </div>\n        `);
        const i = $("#preview-video"), s = i.find("source"), o = t.find(".video-control-box");
        if (!i.length || !s.length) return;
        const r = i[0], l = localStorage.getItem("jhs_videoMuted");
        r.muted = !l || "yes" === l, r.addEventListener("volumechange", (function() {
            localStorage.setItem("jhs_videoMuted", r.muted ? "yes" : "no");
        }));
        let c = "";
        L.forEach((t => {
            let a = e[t.quality];
            if (a) {
                const e = n === t.quality;
                c += `\n                    <button class="video-control-btn${e ? " active" : ""}" \n                            data-quality="${t.quality}"\n                            data-video-src="${a}">\n                        ${t.text}\n                    </button>\n                `;
            }
        })), o.html(c);
        const d = o.find(".video-control-btn");
        o.off("click").on("click", ".video-control-btn", (async e => {
            try {
                const t = $(e.currentTarget);
                if (t.hasClass("active")) return;
                let n = t.attr("data-video-src");
                s.attr("src", n);
                const a = r.currentTime;
                r.load(), r.currentTime = a, await r.play(), d.removeClass("active"), t.addClass("active");
            } catch (t) {
                console.error("切换画质失败:", t);
            }
        }));
    }
}
