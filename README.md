# JHS

JAV Helper Suite 为 JavDB 和 JavBus 提供作品标记、追新、媒体辅助和备份工具。

## 安装与更新

| 渠道 | 入口 | 适合 |
| --- | --- | --- |
| 正式版 | [安装最新正式版](https://github.com/Teamper/JHS/releases/latest/download/JHS.user.js) | 日常使用 |
| 7.0 候选版 | [安装 RC 通道](https://raw.githubusercontent.com/Teamper/JHS/rc-channel/JHS-7.0.rc.user.js) | 试用 7.0 并反馈问题 |
| 7.0 开发版 | [安装 Dev](https://raw.githubusercontent.com/Teamper/JHS/develop/JHS-7.0.dev.user.js) | 验证 develop 上已交付的改动 |

使用 Tampermonkey 安装，确认安装名称与所选渠道一致。RC 显示为 `JHS RC 7.0`，同系列会跟随 RC 通道更新。Dev 显示为 `JHS Dev 7.0`，从同一入口重新安装可更新。切换渠道前先导出备份，同一站点只启用一个 JHS 脚本。

当前正式版为 6.5.2。此页介绍 `develop` 的 7.0 功能，正式版说明见 [main](https://github.com/Teamper/JHS/tree/main)。查看 [发布说明](https://github.com/Teamper/JHS/releases) 与 [更新记录](CHANGELOG.md)。

## 能做什么

- **整理作品**。独立标记收藏、下载、看过和屏蔽，支持个人评分、历史记录、跨页选择与批量操作。需要明确完整番号才能写入作品状态。规则屏蔽由演员和关键词派生。
- **追踪演员与新作**。同步收藏演员、补齐资料，按演员、番号、状态、类别或身材资料筛选新作。已处理、忽略和暂缓各有对应入口。
- **浏览详情与媒体**。聚合剧照、预告、评论、字幕、翻译和外部来源。JavDB 支持相应榜单、FC2 页面及原站清单操作，入口随页面和登录状态变化。
- **使用云盘与媒体库**。统一离线入口显示已启用且支持所选资源的提供商，115 支持 Magnet 与 ED2K，123 云盘支持 Magnet。7.0 支持配置 Emby 或 Jellyfin 联动。提交、上传和账号操作需要相应服务授权。
- **在小屏操作**。移动浏览器可从悬浮菜单进入筛选、追新、鉴定记录和设置。外部来源的可用性随站点、登录和网络状态变化。

## 数据、备份与升级

从「设置 → 备份与数据」导出或恢复本地数据。7.0 首次升级会按需迁移到数据版本 4，并保存升级前恢复点。返回 6.5.2 时使用升级前的备份，切换到 7.0 正式版时按正式说明手动切换脚本。

WebDAV 的接入、历史恢复和旧备份入口见 [同步与恢复](docs/webdav-sync.md)。备份和同步文件携带可移植数据，登录凭证、服务密钥及设备信任由当前安装管理。跨安装切换后按需连接账号和外部服务。

## 其他入口

- Chrome / Edge 开发扩展及各端构建见 [开发与发布](docs/development.md)。
- 在线 Android / iOS 工程的构建和实测范围见 [移动端](apps/mobile/README.md)。[Android 离线预览](apps/android/README.md) 使用内置样片体验发现、追新与片库。
- 开发协作见 [贡献指南](CONTRIBUTING.md)，安全问题见 [安全政策](SECURITY.md)，一般问题请到 [GitHub Issues](https://github.com/Teamper/JHS/issues)。

请遵守所在地法律与服务规则，仅处理你有权访问的内容。项目采用 [MIT 许可](LICENSE)。
