// @ts-check
/** Public, bounded error labels; never display upstream HTML or URLs. @param {any} error */
export function screenshotErrorMessage(error) {
    if (Number(error?.details?.status) >= 500) return "截图来源暂不可用，请稍后重试";
    if (error?.code === "TIMEOUT") return "截图来源响应超时，请稍后重试";
    if (error?.code === "CF_BLOCKED") return "截图来源需要验证，请稍后重试";
    return "缩略图加载失败";
}
