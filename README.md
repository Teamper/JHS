# JHS

JAV Helper Suite 是面向 JavDB 和 JavBus 的浏览器用户脚本，用于管理作品、追踪演员新作、整理媒体资源和备份数据。

## 安装与更新

| 渠道 | 入口 | 适合 |
| --- | --- | --- |
| 正式版 | [安装最新正式版](https://github.com/Teamper/JHS/releases/latest/download/JHS.user.js) | 日常使用 |
| 7.0 候选版 | [安装 RC 通道](https://raw.githubusercontent.com/Teamper/JHS/rc-channel/JHS-7.0.rc.user.js) | 试用 7.0 并反馈问题 |
| 7.0 开发版 | [安装 Dev](https://raw.githubusercontent.com/Teamper/JHS/develop/JHS-7.0.dev.user.js) | 验证 develop 上已交付的改动 |

使用 Tampermonkey 安装，确认安装名称与所选渠道一致。RC 显示为 `JHS RC 7.0`，同系列会跟随 RC 通道更新。Dev 显示为 `JHS Dev 7.0`，从同一入口重新安装可更新。切换渠道前先导出备份，同一站点只启用一个 JHS 脚本。

当前正式版为 6.5.2，正式版用法见 [main](https://github.com/Teamper/JHS/tree/main)。本页介绍 `develop` 上的 7.0。查看 [自 6.5.2 起的累计变更](CHANGELOG.md#unreleased)、[RC3 相对 RC2 的变更](release-notes/7.0.0-rc.3.md) 和 [已发布版本](https://github.com/Teamper/JHS/releases)。

## 能做什么

- **整理作品**。独立标记收藏、下载、看过和屏蔽，支持详情快捷键、个人评分、鉴定记录、跨页批量操作和 JavDB 清单。需要完整番号才能写入状态，规则屏蔽由演员和关键词派生。
- **追踪演员与新作**。同步收藏演员、补齐资料，按演员、番号、状态、类别或身材资料筛选新作。已处理、忽略和暂缓各有对应入口。
- **浏览详情与媒体**。聚合剧照、长缩略图、预告、评论、磁力和字幕，支持多服务标题翻译、隐私遮罩和适用的 FC2 原站操作。入口随页面、设置和登录状态变化。
- **使用云盘与媒体库**。统一离线入口显示已启用且支持所选资源的提供商，115 支持 Magnet 与 ED2K，123 云盘支持 Magnet。7.0 支持配置 Emby 或 Jellyfin 联动。提交、上传和账号操作需要相应服务授权。
- **使用桌面和移动浏览器**。完整设置统一保存，快捷设置即时生效。小屏可从悬浮菜单进入筛选、追新、鉴定记录和设置。

## 数据、备份与升级

从 6.5.2 升级前，在「设置 → 备份与数据」导出本地备份。7.0 首次读取旧库时按需迁移到数据版本 4，并保存升级前恢复点。返回 6.5.2 时使用升级前的备份。7.0 正式版发布后，按该版本说明手动切换脚本。

WebDAV 的接入、历史恢复和旧备份入口见 [同步与恢复](docs/webdav-sync.md)。备份和同步文件携带可移植数据，登录凭证、服务密钥及设备信任由当前安装管理。跨安装切换后按需连接账号和外部服务。

## 其他入口

- [Chrome / Edge 开发扩展](docs/development.md#扩展开发预览)、[Android / iOS 原生验收工程](apps/mobile/README.md) 和 [Android 离线预览](apps/android/README.md) 各自构建。上方 7.0 RC 安装入口交付网页用户脚本。
- 开发协作见 [贡献指南](CONTRIBUTING.md)，安全问题见 [安全政策](SECURITY.md)，一般问题请到 [GitHub Issues](https://github.com/Teamper/JHS/issues)。

请遵守所在地法律与服务规则，仅处理你有权访问的内容。项目采用 [MIT 许可](LICENSE)。
