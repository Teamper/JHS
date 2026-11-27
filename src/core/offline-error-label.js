// @ts-check

/** User-facing offline errors must exclude request URLs and credentials. @param {unknown} code */
export function offlineErrorLabel(code) {
    if (["AUTH_REQUIRED", "TOKEN_EXPIRED", "TOKEN_MISSING"].includes(String(code))) return "云盘授权已失效，请重新登录";
    if (code === "TIMEOUT") return "云盘响应超时，请先核实任务";
    if (code === "NETWORK_ERROR") return "连接云盘失败，请检查网络";
    if (code === "CIRCUIT_OPEN") return "云盘暂不可用，请稍后重试";
    return "离线提交失败，请检查授权后重试";
}
