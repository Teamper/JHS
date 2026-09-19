# ADR-012：Browser 与发布门禁

状态：Accepted

Playwright 位于 Node 22+ 独立子项目，不进入根项目依赖或默认本地 check。本地只驱动已安装的 msedge（可切 chrome），不得自动下载；CI ephemeral runner 只安装 Chromium。Harness 以真实 host URL 配合本地 `route.fulfill`，其他网络全部 abort。

从 6.5.0 起，发布门禁由 Vitest、真实浏览器 fixture、视觉回归、启动性能和构建产物一致性检查组成。`check:release` 必须全部通过；外部站点和云服务的在线状态不作为可重复的自动发布门禁。
