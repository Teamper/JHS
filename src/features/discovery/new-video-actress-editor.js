// @ts-check

import { formatBodyMeasurements } from "../../core/actress-measurements.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { PRODUCT_NAMES } from "../../core/product-names.js";
import { A, _, escapeHtml } from "../../core/constants.js";
import { normalizeHttpUrl } from "../../core/feature-helpers.js";
import { JhsSelect } from "../../core/ui-primitives.js";

import { AVATAR_SOURCE_INDEX_KEY } from "./new-video-preferences.js";

/** @typedef {import("./new-video-workspace-service.js").NewVideoWorkspaceService} NewVideoWorkspaceService */
/** @typedef {import("./new-video-workspace-service.js").EditorChild} EditorChild */
/** @typedef {import("./new-video-workspace-service.js").JQueryEvent} JQueryEvent */
/** @typedef {import("./new-video-workspace-service.js").ActorRecord} ActorRecord */
/** @typedef {import("./new-video-workspace-service.js").ActressEditor} ActressEditor */

/** @returns {editor is ActressEditor}
 * @param {NewVideoWorkspaceService} owner
 */
export function isEditorCurrent(owner, /** @type {ActressEditor | null} */ editor) {
    return !!editor && !owner.disposed && owner.editor === editor && !editor.scope.disposed && editor.generation === owner.editorGeneration && (!editor.mounted || editor.root[0]?.isConnected);
}

/** @param {NewVideoWorkspaceService} owner */
export function closeActressEditor(owner, editor = owner.editor) {
    if (!editor || editor.scope.disposed) return;
    if (owner.editor === editor) { owner.editor = null; owner._editActressRoot = null; owner.editorGeneration++; }
    editor.scope.dispose();
    if (editor.id != null) owner.getRuntimeService("dialog")?.close?.(editor.id);
    if (editor.id == null || !editor.layer?.[0]?.isConnected) editor.root.remove();
}

/** @param {NewVideoWorkspaceService} owner */
export function cancelAvatarSearch(owner, /** @type {ActressEditor | null} */ editor) {
    if (!editor) return;
    editor.searchGeneration++;
    const pending = editor.search; editor.search = null; pending?.scope.dispose();
    editor.avatarChild?.close(); editor.avatarChild = null;
    if (owner.isEditorCurrent(editor)) editor.root.find("#search-avatar-btn").prop("disabled", false).removeAttr("aria-busy");
}

/** @param {NewVideoWorkspaceService} owner */
export function openEditorChild(owner, /** @type {ActressEditor} */ editor, /** @type {Record<string, any>} */ options) {
    if (!owner.isEditorCurrent(editor)) return null;
    const dialog = owner.getRuntimeService("dialog"), scope = new LifecycleScope("actress-editor-child");
    /** @type {EditorChild} */
    const child = { scope, id: null, ended: false, close: () => {
        if (child.ended) return;
        child.ended = true; scope.dispose();
        if (child.id != null) dialog.close(child.id);
        if (child.id == null || !child.root?.[0]?.isConnected) content?.jquery && content.remove();
    } };
    scope.addCleanup(editor.scope.addCleanup(() => child.close()));
    const success = options.success, end = options.end;
    const content = options.type === 1 && options.content?.nodeType ? owner.jquery(options.content) : options.content;
    // Layer 1.0.9 wraps object content in place; a detached jQuery root creates only its shade.
    if (options.type === 1 && content?.jquery) {
        content.hide().appendTo(owner.document.body);
    }
    const id = dialog.open({ ...options, content,
        success: (/** @type {any} */ root, /** @type {number} */ id) => {
            child.id = id;
            child.root = owner.jquery(root);
            if (child.ended || !owner.isEditorCurrent(editor)) return child.close();
            owner.utils.setupEscClose?.(id);
            scope.addCleanup(() => owner.utils.releaseEscClose?.(id));
            const element = owner.jquery(root)[0], observer = new owner.window.MutationObserver(() => { if (!element.isConnected) child.close(); });
            observer.observe(owner.document.body, { childList: true, subtree: true }); scope.ownObserver(observer);
            success?.(root, id, child);
        },
        end: () => {
            child.ended = true; scope.dispose();
            // Keep object content until Layer unwraps it; removing it earlier leaves an empty modal shell.
            if (content?.jquery) content.remove();
            child.root?.remove(); end?.();
        },
    });
    child.id ??= id;
    return child;
}

/** @param {NewVideoWorkspaceService} owner */
export async function editActress(owner, /** @type {ActorRecord} */ record) {
    if (owner.disposed) return;
    if (owner.isEditorCurrent(owner.editor) && owner.editor.record.starId === record.starId) {
        owner.editor.root.find("#edit-actress-name").trigger("focus"); return owner.editor.id;
    }
    owner.closeActressEditor();
    const scope = new LifecycleScope("actress-editor"), generation = ++owner.editorGeneration, safe = (/** @type {unknown} */ value) => escapeHtml(String(value || ""));
    const avatar = normalizeHttpUrl(record.avatar, owner.nvJavDbUrl) || "";
    const allNames = Array.isArray(record.allName) ? record.allName.join("，") : String(record.allName || "");
    const videos = Array.isArray(record.newVideoList) ? record.newVideoList.map(item => typeof item === "string" ? item : item.carNum).join("，") : "";
    const root = owner.jquery(`<div class="jhs-form-dialog">
        <div class="jhs-avatar-editor"><img id="edit-avatar-preview" class="jhs-avatar-editor__preview" src="${safe(avatar)}" alt="演员头像预览">
            <div class="jhs-form-dialog__body"><label class="jhs-form-label" for="edit-actress-avatar">头像链接</label><input id="edit-actress-avatar" class="jhs-field" value="${safe(avatar)}">
                <div class="jhs-toolbar jhs-avatar-editor__actions"><button type="button" id="search-avatar-btn" class="jhs-btn jhs-btn--secondary">搜索头像</button><button type="button" id="select-cdn-btn" class="jhs-btn jhs-btn--secondary">选择 CDN 源</button></div>
            </div></div>
        <div class="jhs-form-field"><label class="jhs-form-label" for="edit-actress-starid">演员来源 ID（JavDB starId）</label><div class="jhs-inline-fields"><input id="edit-actress-starid" class="jhs-field" value="${safe(record.starId)}" readonly><button type="button" id="rebind-actor-id-btn" class="jhs-btn jhs-btn--secondary">搜索重绑 ID</button></div></div>
        <div class="jhs-form-field"><label class="jhs-form-label" for="edit-actress-name">主名称</label><input id="edit-actress-name" class="jhs-field" value="${safe(record.name)}" aria-describedby="edit-actress-error"></div>
        <div class="jhs-form-field"><label class="jhs-form-label" for="edit-actress-allname">所有别名（用逗号分隔）</label><textarea id="edit-actress-allname" class="jhs-textarea">${safe(allNames)}</textarea></div>
        <div class="jhs-form-field"><label class="jhs-form-label" for="actressType">演员类别</label><select id="actressType" class="jhs-select-source"><option value="">未知</option><option value="censored">有码</option><option value="uncensored">无码</option></select></div>
        <div class="jhs-form-field"><label class="jhs-form-label" for="edit-actress-newvideolist">新作品番号（用逗号分隔）</label><textarea id="edit-actress-newvideolist" class="jhs-textarea">${safe(videos)}</textarea></div>
        <div class="jhs-form-field"><label class="jhs-form-label" for="edit-remark">备注</label><textarea id="edit-remark" class="jhs-textarea">${safe(record.remark)}</textarea></div>
        <div class="jhs-form-field"><strong>身材资料</strong><div id="edit-actress-profile">${safe(formatBodyMeasurements(record) || "暂无资料")}</div><button type="button" id="refresh-actress-profile" class="jhs-btn jhs-btn--secondary">重新拉取资料</button></div>
        <p id="edit-actress-error" class="jhs-field-error" role="alert" hidden></p>
    </div>`);
    root.find("#actressType").val(record.actressType || "");
    /** @type {ActressEditor} */
    const editor = { scope, generation, root, record, id: null, search: null, searchGeneration: 0, avatarChild: null, savePending: false };
    owner.editor = editor;
    owner._editActressRoot = root;
    scope.addCleanup(() => { root.find("*").addBack().off(".jhsActressEditor"); for (const select of root.find("select").get()) JhsSelect.instances?.get(select)?.close(); });
    Promise.resolve(owner.getRuntimeService("scope")?.()).then(parent => {
        if (!owner.isEditorCurrent(editor)) return;
        if (parent?.disposed) owner.closeActressEditor(editor);
        else if (parent?.addCleanup) scope.addCleanup(parent.addCleanup(() => owner.closeActressEditor(editor)));
    }).catch(error => { if (owner.isEditorCurrent(editor)) { owner.logger.warn("演员编辑生命周期初始化失败", error); owner.closeActressEditor(editor); } });
    root.on("input.jhsActressEditor", "#edit-actress-avatar", (/** @type {JQueryEvent} */ event) => root.find("#edit-avatar-preview").attr("src", normalizeHttpUrl(owner.jquery(event.currentTarget).val(), owner.nvJavDbUrl) || ""));
    root.on("input.jhsActressEditor", "#edit-actress-name,#edit-actress-allname", () => owner.cancelAvatarSearch(editor));
    root.on("click.jhsActressEditor", "#refresh-actress-profile", async (/** @type {JQueryEvent} */ event) => {
        const button = owner.jquery(event.currentTarget).prop("disabled", true).attr("aria-busy", "true");
        try {
            await owner.requestActressProfileBackfill({ clearStarIds: [record.starId], backfillOptions: { starIds: [record.starId], force: true, refresh: true } });
            const latest = (await owner.getRuntimeService("state").getFavoriteActressList()).find((/** @type {ActorRecord} */ item) => item.starId === record.starId);
            if (owner.isEditorCurrent(editor)) root.find("#edit-actress-profile").text(formatBodyMeasurements(latest) || "暂无资料");
        } catch (error) {
            if (owner.isEditorCurrent(editor)) root.find("#edit-actress-error").text("读取资料失败，请重试").prop("hidden", false);
            owner.logger.error("读取演员资料失败", error);
        } finally { button.prop("disabled", false).removeAttr("aria-busy"); }
    });
    root.on("click.jhsActressEditor", "#search-avatar-btn", () => void owner.searchAvatar(editor));
    root.on("click.jhsActressEditor", "#rebind-actor-id-btn", () => void owner.openRebindActorDialog(record, { ownerScope: editor.scope }));
    root.on("click.jhsActressEditor", "#select-cdn-btn", () => {
        owner.openEditorChild(editor, {
            type: 1, title: `选择 ${PRODUCT_NAMES.cdn} 来源`, ui: { size: "sm", body: "scroll" }, skin: "jhs-confirm-actions",
            content: owner.jquery('<div class="jhs-form-dialog jhs-ui"></div>').append(owner.avatarSources.map((source, index) => owner.jquery('<label class="jhs-option-row"></label>').append(owner.jquery('<input type="radio" name="cdn-source">').val(index).prop("checked", index === owner.avatarSourceIndex), owner.jquery('<span></span>').text(`${source.name}${source.recommended ? "（推荐）" : ""}`)))).append(owner.jquery('<p class="jhs-helper-text"></p>').text("切换后将在下次搜索时使用所选来源。"))[0],
            btn: ["取消", "选择"],
            success: (/** @type {HTMLElement | {0: HTMLElement}} */ layer, /** @type {number} */ id, /** @type {EditorChild} */ child) => { child.root = owner.jquery(layer); },
            btn2: (/** @type {number} */ id) => {
                if (!owner.isEditorCurrent(editor)) return false;
                const value = owner.jquery(`#layui-layer${id}`).find('input[name="cdn-source"]:checked').val(), index = Number(value);
                if (value != null && owner.avatarSources[index] && index !== owner.avatarSourceIndex) {
                    owner.cancelAvatarSearch(editor); owner.avatarSourceIndex = index;
                    owner.getRuntimeService("storage").setLocal(AVATAR_SOURCE_INDEX_KEY, String(index));
                    owner.notifications.ok(`${PRODUCT_NAMES.cdn} 来源已切换`);
                }
                owner.getRuntimeService("dialog").close(id);
            },
        });
    });
    const dialog = owner.getRuntimeService("dialog");
    root.hide().appendTo(owner.document.body);
    const id = dialog.open({
        type: 1, title: `编辑演员：${safe(record.name)}`, ui: { size: "sm", body: "scroll" }, skin: "jhs-confirm-actions", content: root, btn: ["取消", "保存"],
        success: (/** @type {HTMLElement | {0: HTMLElement}} */ layer, /** @type {number} */ id) => {
            editor.id = id;
            editor.mounted = true;
            if (!owner.isEditorCurrent(editor)) return;
            editor.layer = owner.jquery(layer);
            editor.layer.find(".layui-layer-title").attr("data-jhs-privacy-kind", "actor");
            JhsSelect.enhance(layer); owner.utils.setupEscClose?.(id);
            scope.addCleanup(() => owner.utils.releaseEscClose?.(id));
            const observer = new owner.window.MutationObserver(() => { if (!root[0].isConnected) owner.closeActressEditor(editor); });
            observer.observe(owner.document.body, { childList: true, subtree: true }); scope.ownObserver(observer);
        },
        end: () => { editor.id = null; owner.closeActressEditor(editor); root.remove(); editor.layer?.remove(); },
        btn2: async (/** @type {number} */ id) => {
            if (!owner.isEditorCurrent(editor) || editor.savePending || editor.saved) return false;
            const value = (/** @type {string} */ selector) => String(root.find(selector).val() || "").trim(), name = value("#edit-actress-name");
            root.find("#edit-actress-name").attr("aria-invalid", name ? null : "true");
            root.find("#edit-actress-error").prop("hidden", !!name).text(name ? "" : "请输入演员主名称");
            if (!name) { root.find("#edit-actress-name").trigger("focus"); return false; }
            const split = (/** @type {string} */ text) => text.split(/[，,]/).map(item => item.trim()).filter(Boolean);
            const allName = split(value("#edit-actress-allname"));
            const previousAliases = Array.isArray(record.allName) ? record.allName.map(name => String(name || "").trim()).filter(Boolean) : split(String(record.allName || ""));
            const namesChanged = String(record.name || "").trim() !== name || JSON.stringify(previousAliases) !== JSON.stringify(allName);
            const { actressProfile: _ignoredProfile, actressProfileVerifiedUrl: _ignoredVerification, ...editableBase } = record;
            const updated = { ...editableBase, avatar: value("#edit-actress-avatar"), name, allName, newVideoList: split(value("#edit-actress-newvideolist")).map((/** @type {string} */ car) => (Array.isArray(record.newVideoList) ? record.newVideoList.find(item => (typeof item === "string" ? item : item?.carNum) === car) : null) || car), actressType: value("#actressType"), remark: value("#edit-remark") };
            editor.savePending = true; editor.layer?.find(".layui-layer-btn1").attr("aria-disabled", "true");
            try {
                const saved = await owner.getRuntimeService("state").updateFavoriteActress(updated);
                if (saved === false) throw new Error("演员记录已不存在");
                editor.saved = true;
            } catch (error) {
                owner.logger.error("演员信息保存失败", error);
                if (owner.isEditorCurrent(editor)) owner.notifications.error("演员信息保存失败，请重试");
                return false;
            } finally {
                editor.savePending = false;
                if (owner.isEditorCurrent(editor)) editor.layer?.find(".layui-layer-btn1").removeAttr("aria-disabled");
            }
            // The committed change must still invalidate the workspace when the editor closed during its write.
            if (owner.isEditorCurrent(editor)) Object.assign(record, updated);
            if (namesChanged && record.starId) void owner.requestActressProfileBackfill({
                clearStarIds: [record.starId],
                backfillOptions: { starIds: [record.starId], force: true, refresh: true },
            });
            await owner.notifyCommittedNewVideoChange("favorite-actress-edited");
            if (!owner.isEditorCurrent(editor)) return false;
            try { owner.notifications.ok("已更新演员信息"); }
            catch (error) { try { owner.logger.warn("演员信息已更新，但成功提示显示失败", error); } catch { /* A logger failure leaves the completed edit successful. */ } }
            try { dialog.close(id); }
            catch (error) { try { owner.logger.warn("演员信息已更新，但编辑弹窗关闭失败", error); } catch { /* A logger failure leaves the completed edit successful. */ } }
            return false;
        },
    });
    if (owner.isEditorCurrent(editor)) editor.id ??= id;
    return id;
}

/** @param {NewVideoWorkspaceService} owner */
export async function searchAvatar(owner, editor = owner.editor) {
    if (!owner.isEditorCurrent(editor) || editor.search) return;
    const names = [String(editor.root.find("#edit-actress-name").val() || ""), ...String(editor.root.find("#edit-actress-allname").val() || "").split(/[，,]/)].map(name => name.trim()).filter(Boolean);
    if (!names.length) return void owner.notifications.error("请输入演员名称或别名");
    editor.avatarChild?.close(); editor.avatarChild = null;
    const scope = new LifecycleScope("actress-avatar-search"), generation = ++editor.searchGeneration;
    const request = editor.search = { scope, generation };
    scope.addCleanup(editor.scope.addCleanup(() => scope.dispose()));
    const button = editor.root.find("#search-avatar-btn").prop("disabled", true).attr("aria-busy", "true");
    const busy = owner.startLoading?.();
    scope.addCleanup(() => busy?.close?.());
    let urls;
    try {
        const source = owner.avatarSources[owner.avatarSourceIndex];
        urls = source ? await owner.getRuntimeService("actressInfo").searchAvatars([...new Set(names)], source.id, { scope }) : [];
    } catch (error) {
        if (owner.isEditorCurrent(editor) && editor.search === request && !scope.disposed) owner.notifications.error("头像搜索失败，请重试");
        return;
    } finally {
        if (editor.search === request) {
            editor.search = null;
            if (owner.isEditorCurrent(editor)) button.prop("disabled", false).removeAttr("aria-busy");
        }
        scope.dispose();
    }
    if (!owner.isEditorCurrent(editor) || editor.searchGeneration !== generation) return;
    urls = [...new Set((Array.isArray(urls) ? urls : []).map(url => normalizeHttpUrl(url, owner.window.location.href)).filter(url => url !== null))];
    if (!urls.length) return void owner.notifications.error("未找到头像，请检查演员名称");
    owner.openAvatarCandidates(editor, urls, generation);
}

/** @param {NewVideoWorkspaceService} owner */
export function openAvatarCandidates(owner, /** @type {ActressEditor} */ editor, /** @type {string[]} */ urls, /** @type {number} */ generation) {
    const root = owner.jquery('<div id="gfriends-image-list-container" class="jhs-ui"><p id="gfriends-prompt"></p><div id="gfriends-image-list" role="group" aria-label="头像候选"></div></div>');
    root.find("#gfriends-prompt").text(`点击图片即可选择（初始共 ${urls.length} 张）`);
    for (const [index, url] of urls.entries()) root.find("#gfriends-image-list").append(owner.jquery('<button type="button" class="jhs-btn gfriends-image-item-wrapper" aria-pressed="false"></button>').attr({ "data-url": url, "aria-label": `选择第 ${index + 1} 张头像` }).append(owner.jquery('<img class="gfriends-selectable-img" alt="">').attr("src", url), owner.jquery('<span class="gfriends-size-tag">载入中</span>')));
    let failed = 0, selected = false;
    const child = owner.openEditorChild(editor, {
        type: 1, title: `选择演员头像（${urls.length} 张）`, ui: { size: "lg", body: "scroll" }, content: root[0], btn: ["关闭"],
        success: (/** @type {HTMLElement} */ _layer, /** @type {number} */ _id, /** @type {EditorChild} */ child) => {
            const current = () => owner.isEditorCurrent(editor) && !child.scope.disposed && editor.searchGeneration === generation;
            child.scope.addCleanup(() => root.find("*").addBack().off(".jhsAvatarCandidate"));
            root.find(".gfriends-selectable-img").each((/** @type {number} */ _, /** @type {HTMLImageElement} */ image) => {
                const element = owner.jquery(image), wrapper = element.closest(".gfriends-image-item-wrapper");
                element.on("load.jhsAvatarCandidate", () => { if (current()) wrapper.find(".gfriends-size-tag").text(`${image.naturalWidth} x ${image.naturalHeight}`); });
                element.one("error.jhsAvatarCandidate", () => {
                    if (!current()) return;
                    wrapper.remove(); failed++;
                    root.find("#gfriends-prompt").text(`点击图片即可选择（已移除 ${failed} 张错误图片，剩余 ${urls.length - failed} 张）`);
                    if (failed === urls.length) { owner.notifications.error("头像链接已失效，请重新搜索"); child.close(); }
                });
                if (image.complete) element.trigger(image.naturalWidth > 0 ? "load" : "error");
            });
            root.on("click.jhsAvatarCandidate", ".gfriends-image-item-wrapper", (/** @type {JQueryEvent} */ event) => {
                if (!current() || selected) return;
                selected = true;
                const candidate = owner.jquery(event.currentTarget), url = candidate.attr("data-url");
                editor.root.find("#edit-actress-avatar").val(url); editor.root.find("#edit-avatar-preview").attr("src", url);
                root.find(".gfriends-image-item-wrapper").attr("aria-pressed", "false"); candidate.attr("aria-pressed", "true");
                child.scope.ownTimeout(setTimeout(() => { if (current()) child.close(); }, 150));
            });
        },
    });
    editor.avatarChild = child;
}
