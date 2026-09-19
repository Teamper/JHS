# ADR-010：外部 URL 信任

状态：Accepted

所有初始 URL 与响应 finalUrl 均由 ExternalUrlPolicy 校验。builtin-public 限 manifest HTTPS host；custom-public 要求 HTTPS 且拒绝 localhost/private literal；user-local 允许 HTTP/HTTPS 与私网，但必须精确授权 scheme+host+port，redirect 不得离开授权 origin。Phase 4 后 Integration 不得绕过此边界。
