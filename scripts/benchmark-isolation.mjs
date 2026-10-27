import { execFileSync } from "node:child_process";

/** Do not kill unrelated work. Refuse a contaminated fixed-environment sample. */
export function assertNoConcurrentBenchmarks(read = () => {
    if (process.platform !== "win32") return "[]";
    return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "$ErrorActionPreference='Stop'; $ids=@(Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Where-Object { $_.CommandLine -match 'vitest|playwright.*cli\\.js' } | Select-Object -ExpandProperty ProcessId); ConvertTo-Json -Compress -InputObject $ids"], { encoding: "utf8", windowsHide: true, timeout: 10000 });
}) {
    const ids = JSON.parse(read().trim().replace(/^\uFEFF/, ""));
    if (!Array.isArray(ids) || ids.some(id => !Number.isSafeInteger(id) || id < 1)) throw new Error("无法确认性能检查的独占测试环境");
    if (ids.length) throw new Error(`检测到其他 Vitest/Playwright 测试进程（PID ${ids.join(", ")}），本次性能采样不作为有效门禁；请等待其结束后重试`);
}
