// @ts-check

import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { PRODUCT_NAMES } from "../../core/product-names.js";

/** @type {{scope: LifecycleScope} | null} */
let loginOwner = null;

/** Open the shared JavDB account dialog for features that need account actions. */
/** @param {{dialog: any, account: any, credential: any, getScope: () => Promise<any>, onSuccess?: () => unknown | Promise<unknown>, ui?: any, notifications?: any, logger?: any}} services */
export function openJavDbLoginDialog({ dialog, account, credential, getScope, onSuccess, ui, notifications, logger }) {
    const ambient = /** @type {any} */ (globalThis);
    const $ = ui?.jquery ?? ambient.$;
    const utils = ui ?? ambient.utils;
    const show = notifications ?? ambient.show;
    const loading = ui?.loading ?? ambient.loading;
    const clog = logger ?? ambient.clog;
    if (loginOwner) return null;
    const scope = new LifecycleScope("javdb-login"), owner = { scope };
    loginOwner = owner;
    scope.addCleanup(() => { if (loginOwner === owner) loginOwner = null; });
    let pending = false, releaseParent = /** @type {(() => void) | undefined} */ (undefined);
    const alive = () => loginOwner === owner && !scope.disposed;
    try {
        return dialog.open({
            type: 1, title: PRODUCT_NAMES.javdb, closeBtn: 1, area: utils.getResponsiveArea(["360px", "auto"]), shadeClose: false,
            content: '<div class="jhs-layout-e32cff7f"><div class="jhs-layout-598afa5a"><input type="text" id="username" name="username" placeholder="用户名或邮箱" class="jhs-field"></div><div class="jhs-layout-da303dcf"><input type="password" id="password" name="password" placeholder="密码" class="jhs-field"></div><button id="loginBtn" class="jhs-btn jhs-layout-c4eb15bf" type="button">登录</button></div>',
            success: (/** @type {Element} */ element, /** @type {number} */ index) => {
                const button = $(element).find("#loginBtn");
                scope.addCleanup(() => button.off(".jhsLogin"));
                button.on("click.jhsLogin", async () => {
                    if (pending || !alive()) return;
                    const username = String($(element).find("#username").val() || ""), password = String($(element).find("#password").val() || "");
                    if (!username || !password) return void show.error("请输入用户名和密码");
                    pending = true;
                    button.prop("disabled", true).attr("aria-busy", "true");
                    const busy = loading();
                    const releaseBusy = scope.addCleanup(() => { try { busy.close(); } catch { /* closed owner */ } });
                    try {
                        try {
                            const parent = await getScope();
                            if (!alive()) return;
                            if (!releaseParent && parent?.addCleanup) releaseParent = parent.addCleanup(() => { if (!scope.disposed) { scope.dispose(); dialog.close(index); } });
                            const result = await account.login("javdb", { username, password }, { scope });
                            if (!alive()) return;
                            if (!result.success) { clog.error("JavDB 登录失败", result.message); return void show.error("登录失败，请检查账号信息"); }
                            if (!credential?.set) throw new Error("凭证服务不可用");
                            await credential.set("jhs_appAuthorization", result.token, { assertActive: () => { if (!alive()) throw new DOMException("登录已取消", "AbortError"); } });
                            if (!alive()) return;
                        } catch (error) {
                            if (!alive()) return;
                            try { clog.error("登录异常:", error); } catch { /* retain the credential error */ }
                            show.error("登录失败，请稍后重试");
                            return;
                        }
                        try { show.ok("已登录"); }
                        catch (error) { try { clog.warn("JavDB 登录已保存，成功提示失败", error); } catch { /* credential is committed */ } }
                        try { dialog.close(index); }
                        catch (error) { try { clog.error("JavDB 登录已保存，弹窗关闭失败", error); } catch { /* continue the requested action */ } }
                        try { await onSuccess?.(); }
                        catch (error) {
                            try { clog.error("JavDB 登录后续操作失败", error); } catch { /* login remains committed */ }
                            try { show.error("已登录，请重试刚才的操作"); } catch { /* login remains committed */ }
                        }
                    } finally {
                        releaseBusy();
                        pending = false;
                        if (alive()) button.prop("disabled", false).removeAttr("aria-busy");
                    }
                });
            },
            end: () => { scope.dispose(); releaseParent?.(); if (loginOwner === owner) loginOwner = null; },
        });
    } catch (error) {
        scope.dispose(); releaseParent?.(); if (loginOwner === owner) loginOwner = null;
        throw error;
    }
}
