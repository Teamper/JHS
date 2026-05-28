# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/).

## [Unreleased]

## [4.0.2] - 2026-05-28

### Changed
- 扩大回归门禁覆盖范围：新增快速筛选、标记状态与隐藏、设置页、演员信息解析 4 个功能范围。
- 补充关键函数签名断言（applyVisibility、filterMovieList、getStatusKey、doFilter）。
- 更新 Roadmap，明确后续版本规划。

## [4.0.1] - 2026-05-28

### Fixed
- 修复列表页关键词屏蔽和演员屏蔽后内容仍然显示的问题：`getStatusKey()` 缺少 keywordFilter/actorFilter 状态映射，`applyVisibility()` 未尊重 `data-hide` 属性。

## [4.0.0] - 2026-05-28

### Changed
- 从单文件（~640KB / 8529 行）重构为模块化工程（50 个源文件）。
- 拆分为 `src/core/`（9 模块）+ `src/plugins/`（39 插件 / 12 目录）+ `src/main.js`（入口）。
- 构建产物仍然是单个 `JHS.user.js`，对终端用户透明。
- 新增 CI/CD：版本一致性、产物字节一致性、回归门禁（39 插件、16 功能范围）。
- 新增统计仪表盘、数据体检、第三方 TTL 缓存、数据版本化迁移。
- 仓库地址迁移到 Yaoser-Archive，CI 自动构建发布。

### Removed
- 移除阿里云盘备份（被 WebDAV 替代）。
- 移除 115 网盘相关功能（离线下载、文件匹配、扫码登录，被 123 云盘替代）。

## [3.8.0] - 2026-05-28

### Added
- 运行时索引（carMap、actressMap、blacklistMap、statusMap），降低大数据量重复扫描。
- 第三方请求 TTL 缓存，覆盖评论、相关清单、影片详情、磁力搜索等。
- 设置页数据体检面板。
- GitHub Actions 元数据和 README 版本一致性校验。

## [3.7.0] - 2026-05-17

### Added
- 123 云盘离线导入。
- 收藏统计仪表盘。
- 列表页快速筛选。
- 演员页批量收藏/标记已下载。

### Fixed
- 修复 3.7.5 ~ 3.7.9 多项交互逻辑和语法错误。

### Security
- 增加 `escapeHtml()` 修复多处 XSS 风险。
- 加密存储敏感凭据。

[Unreleased]: https://github.com/Yaoser-Archive/JHS/compare/v4.0.2...HEAD
[4.0.2]: https://github.com/Yaoser-Archive/JHS/compare/v4.0.1...v4.0.2
[4.0.1]: https://github.com/Yaoser-Archive/JHS/compare/v4.0.0...v4.0.1
[4.0.0]: https://github.com/Yaoser-Archive/JHS/compare/v3.8.0...v4.0.0
[3.8.0]: https://github.com/Yaoser-Archive/JHS/compare/v3.7.0...v3.8.0
[3.7.0]: https://github.com/Yaoser-Archive/JHS/releases/tag/v3.7.0
