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

class BusPreviewVideoPlugin extends BasePlugin {
    getName() {
        return "BusPreviewVideoPlugin";
    }
    async initCss() {
        return "\n            .bus-preview-modal { position:fixed; inset:0; z-index:var(--jhs-z-modal); display:flex; align-items:center; justify-content:center; visibility:hidden; opacity:0; background:rgba(0,0,0,.95); transition:opacity var(--jhs-motion-base) var(--jhs-ease); }\n            .bus-preview-modal.is-open { visibility:visible; opacity:1; }\n            .bus-preview-modal-content { position:relative; display:flex; max-width:95%; max-height:95%; flex-direction:column; align-items:center; gap:var(--jhs-space-3); }\n            .video-player-wrapper { position:relative; width:80vw; max-width:100%; max-height:85vh; aspect-ratio:16/9; background:#000; }\n            .video-player-wrapper #preview-video { position:absolute; inset:0; }\n        ";
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
        const e = $("#sample-waterfall .sample-box .photo-frame img:first").attr("src"), t = $(`\n            <button type="button" class="jhs-btn preview-video-container sample-box jhs-layout-3b6a3a65">\n                <div class="photo-frame jhs-layout-87db2275">\n                    <img src="${e}" class="video-cover" alt="">\n                    <div class="play-icon jhs-play-overlay">\n                        ▶\n                    </div>\n                </div>\n            </button>`);
        $("#sample-waterfall").prepend(t);
        "yes" === await storageManager.getSetting("enableLoadPreviewVideo", "yes") && fetchDmmPreview(this.getPageInfo().carNum).catch((e => clog.warn("预加载 DMM 失败", e)));
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
        if (n.length > 0) return e.addClass("is-open"), void await safePlay(n[0], {
            context: "JavBus 预览视频",
            notify: !0
        });
        let a = this.getPageInfo().carNum;
        const {sources: i, error: previewError} = await fetchDmmPreview(a);
        i && 0 !== Object.keys(i).length ? (await this.createVideoPlayerAndControls(i, t),
        n = $("#preview-video"), n.length > 0 ? (e.addClass("is-open"), await safePlay(n[0], {
            context: "JavBus 预览视频",
            notify: !0,
            message: "REGION_BLOCKED" === previewError?.code ? previewError.message : "当前视频源无法播放"
        })) : show.error("视频播放器创建失败。")) : show.error("REGION_BLOCKED" === previewError?.code ? previewError.message : "未找到可用的视频源。");
    }
    async createVideoPlayerAndControls(e, t) {
        let n = await storageManager.getSetting("videoQuality");
        n = Z(Object.keys(e), n);
        let a = e[n];
        t.html(`\n            <div class="video-player-wrapper">\n                <video id="preview-video" class="jhs-video-player" controls playsinline>\n                    <source src="${a}" />\n                </video>\n            </div>\n            <div class="jhs-video-toolbar jhs-video-quality-list" role="group" aria-label="视频画质">\n                </div>\n        `);
        const i = $("#preview-video"), s = i.find("source"), o = t.find(".jhs-video-quality-list");
        if (!i.length || !s.length) return;
        const r = i[0], l = localStorage.getItem("jhs_videoMuted");
        r.muted = !l || "yes" === l, i.off("volumechange.jhsVideo").on("volumechange.jhsVideo", (function() {
            localStorage.setItem("jhs_videoMuted", r.muted ? "yes" : "no");
        }));
        let c = "";
        L.forEach((t => {
            let a = e[t.quality];
            if (a) {
                const e = n === t.quality;
                c += `\n                    <button type="button" class="jhs-btn jhs-video-quality-btn${e ? " active" : ""}" \n                            data-quality="${t.quality}"\n                            data-video-src="${a}"\n                            aria-pressed="${e ? "true" : "false"}">\n                        ${t.text}\n                    </button>\n                `;
            }
        })), o.html(c);
        const d = o.find(".jhs-video-quality-btn");
        o.off("click.jhsVideo").on("click.jhsVideo", ".jhs-video-quality-btn", (async e => {
            try {
                const t = $(e.currentTarget);
                if (t.hasClass("active")) return;
                let n = t.attr("data-video-src");
                s.attr("src", n);
                const a = r.currentTime;
                r.load(), r.currentTime = a, await safePlay(r, {
                    context: "JavBus 画质切换",
                    notify: !0
                }) && (d.removeClass("active").attr("aria-pressed", "false"), t.addClass("active").attr("aria-pressed", "true"));
            } catch (t) {
                clog.error("切换画质失败:", t);
            }
        }));
    }
}
