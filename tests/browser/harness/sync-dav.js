import { createServer } from "node:http";

// A real isolated HTTP DAV store; GM bindings model one userscript installation
// shared across origins, while separate BrowserContexts have independent GM data.
export async function isolatedDav() {
    const files = new Map(), requests = [], queuedUploads = [], heldUploads = new Set();
    const folder = "/dav/" + encodeURIComponent("JHS-同步");
    const server = createServer(async (req, res) => {
        const pathname = new URL(req.url, "http://localhost").pathname;
        const name = decodeURIComponent(pathname.split("/").at(-1));
        requests.push({ method: req.method, name });
        if (req.headers.authorization !== "Basic " + Buffer.from("synthetic:synthetic-password").toString("base64")) { res.writeHead(401).end(); return; }
        if (req.method === "MKCOL") { res.writeHead(405).end(); return; }
        if (req.method === "PROPFIND" && pathname.replace(/\/$/, "") === folder) {
            const entry = (href, type) => `<d:response><d:href>${href}</d:href><d:propstat><d:prop><d:resourcetype>${type}</d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`;
            res.writeHead(207, { "Content-Type": "application/xml" }).end(`<d:multistatus xmlns:d="DAV:">${entry(folder + "/", "<d:collection/>")}${[...files.keys()].map(key => entry(folder + "/" + key, "")).join("")}</d:multistatus>`); return;
        }
        if (!pathname.startsWith(folder + "/")) { res.writeHead(404).end(); return; }
        if (req.method === "PUT") {
            let body = ""; for await (const chunk of req) body += chunk;
            const held = queuedUploads.shift();
            if (held) { held.received({ name, body }); await held.wait; }
            if (files.has(name) && files.get(name) !== body) { res.writeHead(409).end(); return; }
            files.set(name, body); res.writeHead(201).end(); return;
        }
        if (req.method === "DELETE") { files.delete(name); res.writeHead(204).end(); return; }
        if (req.method === "GET" && files.has(name)) { res.writeHead(200, { "Content-Type": "text/plain" }).end(files.get(name)); return; }
        res.writeHead(404).end();
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${server.address().port}/dav`;
    const holdNextPut = () => {
        let release, received;
        const wait = new Promise(resolve => { release = resolve; }), arrival = new Promise(resolve => { received = resolve; });
        const held = { wait, received, release() { release(); heldUploads.delete(held); } };
        queuedUploads.push(held); heldUploads.add(held);
        return { received: arrival, release: held.release };
    };
    return { files, requests, url, holdNextPut, close: () => new Promise(resolve => {
        for (const held of heldUploads) held.release();
        server.closeAllConnections(); server.close(resolve);
    }) };
}

export async function sharedUserscriptInstallation(context, dav) {
    const gm = new Map();
    await context.exposeBinding("__syncGm", async ({ page }, key, value) => {
        gm.set(key, value);
        await Promise.all(context.pages().filter(other => other !== page).map(other => other.evaluate(({ key, value }) => window.__syncGmChanged?.(key, value), { key, value }).catch(() => {})));
    });
    await context.exposeBinding("__syncHttp", async (_source, options) => {
        if (!options.url.startsWith(dav.url + "/")) return { status: 500, responseText: "Only isolated DAV is allowed" };
        const response = await fetch(options.url, { method: options.method, headers: options.headers, body: options.data, redirect: "manual" });
        return { status: response.status, responseText: await response.text(), responseHeaders: [...response.headers].map(([key, value]) => `${key}: ${value}`).join("\r\n"), finalUrl: options.url };
    });
    return async page => {
        await page.evaluate(initial => {
            const values = new Map(initial), listeners = new Map(); let next = 0;
            window.__syncGmChanged = (key, value) => { values.set(key, value); for (const [id, record] of listeners) if (record.key === key) record.fn(key, undefined, value, true); };
            window.GM_getValue = (key, fallback) => values.has(key) ? structuredClone(values.get(key)) : fallback;
            window.GM_setValue = (key, value) => { values.set(key, structuredClone(value)); return window.__syncGm(key, value); };
            window.GM_listValues = () => [...values.keys()];
            window.GM_addValueChangeListener = (key, fn) => { listeners.set(++next, { key, fn }); return next; };
            window.GM_removeValueChangeListener = id => listeners.delete(id);
            const original = window.GM_xmlhttpRequest;
            window.GM_xmlhttpRequest = options => {
                if (!options.url.startsWith("http://127.0.0.1:")) return original(options);
                let aborted = false;
                window.__syncHttp({ url: options.url, method: options.method, headers: options.headers, data: options.data }).then(response => { if (!aborted) options.onload?.(response); }, () => { if (!aborted) options.onerror?.({ error: "DAV test connection failed" }); });
                return { abort() { aborted = true; options.onabort?.(); } };
            };
        }, [...gm]);
    };
}
