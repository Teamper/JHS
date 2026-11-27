// @ts-check

import { readStoredActressMeasurements } from "../../core/actress-measurements.js";

import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { escapeHtml } from "../../core/constants.js";
import { normalizeHttpUrl } from "../../core/feature-helpers.js";

/** @typedef {import("./new-video-workspace-service.js").NewVideoWorkspaceService} NewVideoWorkspaceService */
/** @typedef {import("./new-video-workspace-service.js").ActorTarget} ActorTarget */
/** @typedef {import("./new-video-workspace-service.js").JQueryEvent} JQueryEvent */
/** @typedef {import("./new-video-workspace-service.js").ActorRecord} ActorRecord */

/** 工作区关闭或停用时释放重绑弹窗及其在途搜索。 */
/** @param {NewVideoWorkspaceService} owner */
export function closeRebindDialogs(owner) {
    for (const close of [...(owner.rebindDialogClosers ?? [])]) close();
    owner.rebindDialogClosers?.clear();
}

/** @param {string} raw @returns {string} */
export function parseActorIdInput(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";
    if (/^[\w-]+$/u.test(value)) return value;
    const match = value.match(/(?:^|\/)actors\/([\w-]+)(?:[/?#]|$)/u);
    return match?.[1] || "";
}

/** @param {NewVideoWorkspaceService} owner */
export async function resolveActorBaseUrl(owner) {
    const setting = owner.getRuntimeService("settings").snapshot();
    return owner.getRuntimeService("movie")?.externalSiteOrigin?.("javDbBtn", setting) || owner.nvJavDbUrl || owner.document?.location?.origin || "";
}

/** @param {NewVideoWorkspaceService} owner */
export async function applyActorRebind(owner, /** @type {ActorRecord} */ actress, /** @type {ActorTarget} */ target) {
    const baseUrl = await owner.resolveActorBaseUrl();
    const state = owner.runtimeServices.state;
    const fromStarId = String(actress?.starId || "").trim(), toStarId = String(target?.starId || "").trim();
    if (!fromStarId || !toStarId) return null;
    if (!state?.rebindFavoriteActress) throw new Error("当前状态服务不支持重绑演员 ID");
    const result = await state.rebindFavoriteActress({
        fromStarId, toStarId, name: target.name, allName: target.allName, avatar: target.avatar, actressType: target.actressType,
    });
    if (!result?.ok || !result.actress) throw new Error("未找到原演员记录");
    const health = owner.getRuntimeService("sourceHealth");
    health?.clear?.(baseUrl, fromStarId);
    health?.clear?.(baseUrl, toStarId);
    if (owner.isEditorCurrent(owner.editor) && owner.editor.record.starId === fromStarId) {
        // The committed record is a merge of both actors; keeping the stale form open would let
        // its untouched inputs overwrite the merged remark, aliases and pending videos on save.
        owner.closeActressEditor();
    }
    await owner.notifyCommittedNewVideoChange("favorite-actress-rebound");
    owner.notifications.ok(result.merged ? `已合并到现有演员「${result.actress.name}」（${toStarId}）` : `已重新绑定为「${result.actress.name}」（${toStarId}）`);
    if (owner.task?.available()) {
        const task = await owner.task.activate();
        await task?.checkOneNewVideo(result.actress);
    }
    void owner.requestActressProfileBackfill({
        clearStarIds: [fromStarId, toStarId],
        backfillOptions: readStoredActressMeasurements(result.actress) ? null : { starIds: [toStarId], force: true, refresh: true },
    });
    return result.actress;
}

/** @param {NewVideoWorkspaceService} owner */
export async function openRebindActorDialog(owner, /** @type {ActorRecord} */ actress, /** @type {{ownerScope?: LifecycleScope}} */ { ownerScope } = {}) {
    if (owner.disposed || ownerScope?.disposed || !actress?.starId) return null;
    owner.closeRebindDialogs();
    const dialog = owner.getRuntimeService("dialog"), scope = new LifecycleScope("actor-rebind"), safe = (/** @type {unknown} */ value) => escapeHtml(String(value || ""));
    const aliases = [...new Set([actress.name, ...(Array.isArray(actress.allName) ? actress.allName : [])].map(item => String(item || "").trim()).filter(Boolean))];
    const root = owner.jquery(`<div class="jhs-form-dialog jhs-rebind-dialog">
        <p class="jhs-helper-text">当前来源 ID：<code>${safe(actress.starId)}</code>（站方页面 404 时可检索合并后的新演员页，或直接粘贴目标链接 / ID，原新作品与备注将自动迁移或合并）。</p>
        <div class="jhs-form-field">
            <label class="jhs-form-label" for="rebind-actor-query">搜索演员</label>
            <div class="jhs-inline-fields">
                <input id="rebind-actor-query" class="jhs-field" value="${safe(actress.name)}" placeholder="输入演员名或别名">
                <button type="button" id="rebind-actor-search-btn" class="jhs-btn jhs-btn--primary">搜索</button>
            </div>
        </div>
        <div id="rebind-actor-aliases" class="jhs-rebind-aliases" aria-label="快捷别名检索"></div>
        <p id="rebind-actor-status" class="jhs-helper-text" role="status" aria-live="polite"></p>
        <div id="rebind-actor-results" class="jhs-rebind-results"></div>
        <div class="jhs-form-field">
            <label class="jhs-form-label" for="rebind-actor-manual">或直接输入新演员页链接 / starId</label>
            <div class="jhs-inline-fields">
                <input id="rebind-actor-manual" class="jhs-field" placeholder="例如演员页链接、/actors/xxxx 或 xxxx">
                <button type="button" id="rebind-actor-apply-btn" class="jhs-btn jhs-btn--secondary">绑定此 ID</button>
            </div>
        </div>
    </div>`);
    const aliasBox = root.find("#rebind-actor-aliases");
    if (aliases.length) {
        for (const alias of aliases.slice(0, 8)) {
            aliasBox.append(owner.jquery(`<button type="button" class="jhs-btn jhs-btn--ghost jhs-rebind-alias"></button>`).text(alias).attr("data-alias", alias));
        }
    } else aliasBox.hide();
    let binding = false, closed = false;
    /** @type {LifecycleScope | null} */ let activeSearch = null;
    /** @type {number | null} */ let dialogId = null;
    const closeSelf = () => {
        if (closed) return;
        closed = true;
        owner.rebindDialogClosers?.delete(closeSelf);
        activeSearch?.dispose(); scope.dispose(); root.remove();
        if (dialogId != null) dialog.close(dialogId);
    };
    owner.rebindDialogClosers?.add(closeSelf);
    if (ownerScope?.addCleanup) scope.addCleanup(ownerScope.addCleanup(closeSelf));
    const placeholderAvatar = owner.getRuntimeService("actressInfo")?.placeholderUrl?.("javdb") || "";
    const setStatus = (/** @type {string} */ text) => root.find("#rebind-actor-status").text(text);
    const renderCandidates = (/** @type {ActorTarget[]} */ actors) => {
        const box = root.find("#rebind-actor-results").empty();
        for (const candidate of actors) {
            const avatar = normalizeHttpUrl(candidate.avatar, owner.nvJavDbUrl) || placeholderAvatar;
            const typeText = candidate.actressType === "uncensored" ? "无码" : "有码";
            const namesText = Array.isArray(candidate.allName) ? candidate.allName.join("，") : candidate.name;
            const row = owner.jquery(`<div class="jhs-rebind-candidate"></div>`);
            row.append(
                owner.jquery(`<img class="jhs-rebind-candidate__avatar" alt="">`).attr("src", avatar),
                owner.jquery(`<div class="jhs-rebind-candidate__info"></div>`).append(
                    owner.jquery(`<strong class="jhs-rebind-candidate__name"></strong>`).text(candidate.name || candidate.starId),
                    owner.jquery(`<span class="jhs-rebind-candidate__meta"></span>`).text(`ID: ${candidate.starId} · ${typeText} · ${namesText}`)
                ),
                owner.jquery(`<button type="button" class="jhs-btn jhs-btn--secondary">选择并绑定</button>`).attr("data-candidate-id", candidate.starId).on("click", async () => {
                    if (binding || scope.disposed || owner.disposed) return;
                    binding = true;
                    try {
                        await owner.applyActorRebind(actress, candidate);
                        closeSelf();
                    } catch (error) {
                        owner.logger.error("演员重绑失败", error);
                        owner.notifications.error("重新绑定失败，请重试");
                    } finally { binding = false; }
                })
            );
            box.append(row);
        }
    };
    const runSearch = async () => {
        const keyword = String(root.find("#rebind-actor-query").val() || "").trim();
        if (!keyword || scope.disposed) return setStatus("请输入要检索的演员名称");
        activeSearch?.dispose();
        const searchScope = new LifecycleScope("actor-rebind-search");
        activeSearch = searchScope;
        scope.addCleanup(() => searchScope.dispose());
        const button = root.find("#rebind-actor-search-btn").prop("disabled", true).attr("aria-busy", "true");
        setStatus(`正在搜索「${keyword}」…`);
        root.find("#rebind-actor-results").empty();
        try {
            const baseUrl = await owner.resolveActorBaseUrl();
            const res = await owner.getRuntimeService("actressInfo").searchActors("javdb", { keyword, baseUrl }, { scope: searchScope });
            if (scope.disposed || activeSearch !== searchScope) return;
            if (res?.state === "challenge") return setStatus("站方触发了验证页，请先在网页中打开 JavDB 完成验证，或直接在下方粘贴新演员 ID。");
            if (res?.state !== "valid") return setStatus("搜索结果解析失败，请在下方直接粘贴新演员页链接或 starId。");
            const actors = Array.isArray(res.actors) ? res.actors : [];
            if (!actors.length) return setStatus(`未搜到「${keyword}」的可用演员主页，请尝试其他别名或手动输入新 ID。`);
            setStatus(`找到 ${actors.length} 个候选演员，请选择要绑定的目标主页：`);
            renderCandidates(actors);
        } catch (error) {
            if (!scope.disposed && activeSearch === searchScope) {
                owner.logger.error("搜索候选演员失败", error);
                setStatus(/** @type {{code?: string}} */ (error)?.code === "CIRCUIT_OPEN" && /** @type {{message?: string}} */ (error)?.message
                    ? `${/** @type {{message?: string}} */ (error).message}，可稍后重试或直接在下方粘贴新演员页链接 / ID。`
                    : "搜索失败，可切换别名重试或直接在下方粘贴新演员页链接 / ID。");
            }
        } finally {
            if (activeSearch === searchScope) activeSearch = null;
            searchScope.dispose();
            if (!scope.disposed) button.prop("disabled", false).removeAttr("aria-busy");
        }
    };
    root.on("click", "#rebind-actor-search-btn", () => void runSearch());
    root.on("keydown", "#rebind-actor-query", (/** @type {JQueryEvent} */ event) => { if (event.key === "Enter") { event.preventDefault(); void runSearch(); } });
    root.on("click", ".jhs-rebind-alias", (/** @type {JQueryEvent} */ event) => {
        root.find("#rebind-actor-query").val(owner.jquery(event.currentTarget).attr("data-alias") || "");
        void runSearch();
    });
    root.on("click", "#rebind-actor-apply-btn", async () => {
        if (binding || scope.disposed || owner.disposed) return;
        const nextId = parseActorIdInput(String(root.find("#rebind-actor-manual").val() || ""));
        if (!nextId) return setStatus("请输入有效的演员页链接（/actors/xxxx）或 starId");
        binding = true;
        try {
            await owner.applyActorRebind(actress, { starId: nextId });
            closeSelf();
        } catch (error) {
            owner.logger.error("手动重绑演员失败", error);
            owner.notifications.error("重新绑定失败，请重试");
        } finally { binding = false; }
    });
    root.hide().appendTo(owner.document.body);
    dialogId = dialog.open({
        type: 1, title: `重新绑定演员来源：${safe(actress.name)}`, ui: { size: "sm", body: "scroll" }, content: root, btn: ["关闭"],
        success: (/** @type {HTMLElement} */ _layer, /** @type {number} */ id) => {
            dialogId = id;
            owner.utils.setupEscClose?.(id);
            scope.addCleanup(() => owner.utils.releaseEscClose?.(id));
            void runSearch();
        },
        end: () => { closed = true; owner.rebindDialogClosers?.delete(closeSelf); activeSearch?.dispose(); scope.dispose(); root.remove(); },
    });
    return dialogId;
}
