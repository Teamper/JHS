/** Standalone WebDAV client for remote backup/restore operations. */
class De {
    constructor(e, t, n) {
        this.davUrl = e.endsWith("/") ? e : e + "/", this.username = t, this.password = n,
        this.folderName = null;
    }
    _getAuthHeaders() {
        return {
            Authorization: `Basic ${btoa(`${this.username}:${this.password}`)}`,
            Depth: "1"
        };
    }
    _sendRequest(e, t, n = {}, a) {
        return new Promise(((i, s) => {
            const o = this.davUrl + t, r = {
                ...this._getAuthHeaders(),
                ...n
            };
            GM_xmlhttpRequest({
                method: e,
                url: o,
                headers: r,
                data: a,
                onload: e => {
                    e.status >= 200 && e.status < 300 ? i(e) : (console.error(e), s(new Error(`请求失败 ${e.status}: ${e.statusText}`)));
                },
                onerror: e => {
                    console.error("请求WebDav发生错误:", e), s(new Error("请求WebDav失败, 请检查服务是否启动, 凭证是否正确"));
                }
            });
        }));
    }
    async _ensureFolder(e) {
        try {
            await this._sendRequest("MKCOL", e);
        } catch (t) {
            if (!/请求失败 (405|409):/.test(t.message)) throw t;
        }
    }
    async backup(e, t, n) {
        await this._ensureFolder(e);
        const a = e + "/" + t;
        await this._sendRequest("PUT", a, {
            "Content-Type": "text/plain"
        }, n);
    }
    async getFileList(e) {
        var t, n, a;
        const i = (await this._sendRequest("PROPFIND", e, {
            "Content-Type": "application/xml"
        }, '<?xml version="1.0"?>\n                <d:propfind xmlns:d="DAV:">\n                    <d:prop>\n                        <d:displayname />\n                        <d:getcontentlength />\n                        <d:creationdate />\n                        <d:getlastmodified />\n                        <d:iscollection />\n                    </d:prop>\n                </d:propfind>\n            ')).responseText, s = (new DOMParser).parseFromString(i, "text/xml").getElementsByTagNameNS("DAV:", "response"), o = [];
        for (let r = 0; r < s.length; r++) {
            if (0 === r) continue;
            let e = s[r];
            const i = e.getElementsByTagNameNS("DAV:", "displayname")[0].textContent, l = (null == (t = e.getElementsByTagNameNS("DAV:", "getcontentlength")[0]) ? void 0 : t.textContent) || "0", c = (null == (n = e.getElementsByTagNameNS("DAV:", "creationdate")[0]) ? void 0 : n.textContent) || (null == (a = e.getElementsByTagNameNS("DAV:", "getlastmodified")[0]) ? void 0 : a.textContent) || "";
            "0" !== l && o.push({
                fileId: i,
                name: i,
                size: Number(l),
                createTime: c
            });
        }
        return o.reverse(), o;
    }
    async deleteFile(e) {
        let t = this.folderName + "/" + encodeURI(e);
        await this._sendRequest("DELETE", t, {
            "Cache-Control": "no-cache"
        });
    }
    async getBackupList(e) {
        return this.folderName = e, await this._ensureFolder(e), this.getFileList(e);
    }
    async getFileContent(e) {
        let t = this.folderName + "/" + e;
        return (await this._sendRequest("GET", t, {
            Accept: "application/octet-stream"
        })).responseText;
    }
}
