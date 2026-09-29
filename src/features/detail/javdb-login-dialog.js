// @ts-check

let loginDialogOpen = false;

/** Open the shared JavDB account dialog for features that need account actions. */
/** @param {{dialog: any, account: any, credential: any, getScope: () => Promise<any>, onSuccess?: () => unknown | Promise<unknown>, ui?: any, notifications?: any, logger?: any}} services */
export function openJavDbLoginDialog({ dialog, account, credential, getScope, onSuccess, ui, notifications, logger }) {
    const ambient = /** @type {any} */ (globalThis);
    const $ = ui?.jquery ?? ambient.$;
    const utils = ui ?? ambient.utils;
    const show = notifications ?? ambient.show;
    const loading = ui?.loading ?? ambient.loading;
    const clog = logger ?? ambient.clog;
    if (loginDialogOpen) return null;
    loginDialogOpen = true;
    try {
        return dialog.open({
            type: 1, title: "JavDB", closeBtn: 1, area: utils.getResponsiveArea(["360px", "auto"]), shadeClose: false,
            content: '<div class="jhs-layout-e32cff7f"><div class="jhs-layout-598afa5a"><input type="text" id="username" name="username" placeholder="用户名 | 邮箱" class="jhs-field"></div><div class="jhs-layout-da303dcf"><input type="password" id="password" name="password" placeholder="密码" class="jhs-field"></div><button id="loginBtn" class="jhs-btn jhs-layout-c4eb15bf" type="button">登录</button></div>',
            success: (/** @type {Element} */ element, /** @type {number} */ index) => {
                $(element).find("#loginBtn").on("click", async () => {
                    const username = String($(element).find("#username").val() || ""), password = String($(element).find("#password").val() || "");
                    if (!username || !password) return void show.error("请输入用户名和密码");
                    const busy = loading();
                    try {
                        try {
                            const result = await account.login("javdb", { username, password }, { scope: await getScope() });
                            if (!result.success) return void show.error(result.message);
                            if (!credential?.set) throw new Error("凭证服务不可用");
                            await credential.set("jhs_appAuthorization", result.token);
                        } catch (error) {
                            try { clog.error("登录异常:", error); } catch { /* retain the credential error */ }
                            show.error(error instanceof Error ? error.message : String(error));
                            return;
                        }
                        try { show.ok("登录成功"); }
                        catch (error) { try { clog.warn("JavDB 登录已保存，成功提示失败", error); } catch { /* credential is committed */ } }
                        try { dialog.close(index); }
                        catch (error) { try { clog.error("JavDB 登录已保存，弹窗关闭失败", error); } catch { /* continue the requested action */ } }
                        try { await onSuccess?.(); }
                        catch (error) {
                            try { clog.error("JavDB 登录后续操作失败", error); } catch { /* login remains committed */ }
                            try { show.error("登录成功，但后续操作失败，请重试该操作"); } catch { /* login remains committed */ }
                        }
                    } finally {
                        try { busy.close(); } catch (error) { try { clog.warn("JavDB 登录加载层关闭失败", error); } catch { /* login remains committed */ } }
                    }
                });
            },
            end: () => { loginDialogOpen = false; },
        });
    } catch (error) {
        loginDialogOpen = false;
        throw error;
    }
}
