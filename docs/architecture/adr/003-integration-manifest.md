# ADR-003：Integration Manifest 与质量等级

状态：Accepted

每个 Integration 必须声明 id、trustClass、hosts、capabilities、requires、cachePolicy、factory 与 quality。Adapter 只返回 normalized contracts，不返回 DOM、jQuery、HTML fragment 或原始响应。Bronze 要求契约 fixture、错误标准化和 HTML 隔离；Silver 另要求适用的 cache/dedupe、AbortSignal、异常响应、fallback 与 Diagnostics。不适用项必须显式为 `none`。
