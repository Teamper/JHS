# ADR-012：Browser 与发布门禁

状态：Accepted

Playwright 位于 Node 22+ 独立子项目，不进入根项目依赖或默认本地 check。本地只驱动已安装的 msedge（可切 chrome），不得自动下载；CI ephemeral runner 只安装 Chromium。Harness 以真实 host URL 配合本地 `route.fulfill`，其他网络全部 abort。自动 smoke 不替代 Tampermonkey 人工发布 Gate。
