// @ts-check

let loginDialogOpen = false;

/** Open the shared JavDB account dialog for features that need account actions. */
/** @param {{dialog: any, account: any, credential: any, getScope: () => Promise<any>, onSuccess?: () => unknown | Promise<unknown>}} services */
export function openJavDbLoginDialog({ dialog, account, credential, getScope, onSuccess }) {
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
                        const result = await account.login("javdb", { username, password }, { scope: await getScope() });
                        if (!result.success) return void show.error(result.message);
                        if (!credential?.set) throw new Error("凭证服务不可用");
                        await credential.set("jhs_appAuthorization", result.token);
                        show.ok("登录成功");
                        dialog.close(index);
                        await onSuccess?.();
                    } catch (error) {
                        clog.error("登录异常:", error);
                        show.error(error instanceof Error ? error.message : String(error));
                    } finally { busy.close(); }
                });
            },
            end: () => { loginDialogOpen = false; },
        });
    } catch (error) {
        loginDialogOpen = false;
        throw error;
    }
}
