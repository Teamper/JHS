// @ts-check
/** Public, bounded error labels; never display upstream HTML or URLs. @param {any} error */
export function screenshotErrorMessage(error) {
    if (Number(error?.details?.status) >= 500) return "截图来源暂不可用，请稍后重试";
    if (error?.code === "TIMEOUT") return "截图来源响应超时，请稍后重试";
    if (error?.code === "CF_BLOCKED") return "截图来源需要验证，请稍后重试";
    if (error?.source === "javstore" && error?.code === "INVALID_RESPONSE") {
        if (error.details?.reason === "identity") return "JavStore 已找到候选，但番号核验未通过";
        if (error.details?.reason === "structure") return "JavStore 页面格式暂不支持";
    }
    return "缩略图加载失败";
}
