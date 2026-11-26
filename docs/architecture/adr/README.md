# JHS Architecture Decision Records

ADR-001 至 ADR-012 记录从 6.5 沿用的架构决策。存储、依赖加载和验证条目附有 7.0 的适用范围。ADR-013 和 ADR-014 记录 WebDAV 同步恢复、原子写入与计算路径。跨端入口与业务模块归属见职责说明。

当前 7.0 能力与路由见 [Feature Matrix](../feature-matrix.md)，代码职责边界见 [Ownership](../ownership.md)。main / develop 的构建与验证差异见 [开发与发布说明](../../development.md)。

1. [模块边界与依赖反转](001-module-boundaries.md)
2. [Feature 与 Contribution](002-feature-contribution.md)
3. [Integration Manifest 与质量等级](003-integration-manifest.md)
4. [Provider Registry](004-provider-registry.md)
5. [Detail Surface 与 HostAdapter](005-detail-surface.md)
6. [Settings 与 Profile](006-settings-profile.md)
7. [RequestKey 与 Cache](007-request-key-cache.md)
8. [Lifecycle 与 Cancellation](008-lifecycle-cancellation.md)
9. [Storage 与最小迁移](009-storage-migration.md)
10. [外部 URL 信任](010-url-trust.md)
11. [Vendor Bridge](011-vendor-bridge.md)
12. [Browser 与发布门禁](012-browser-release-gate.md)
13. [WebDAV 多端同步与恢复](013-webdav-sync-recovery.md)
14. [原子状态保存与同步计算](014-atomic-state-and-sync-computation.md)
