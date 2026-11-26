# JHS 7.0 Feature Matrix

此表按 7.0 的 Feature catalog 列出装配和启动时机。Contribution ID 决定独立启停粒度。FeatureRuntime 在注册时核对各 ID 的归属，启动时将旧 Plugin 名迁移到 Contribution ID。没有贡献的 Feature 可以只提供命令或系统能力。见 [Feature catalog](../../src/features/catalog.js) 和 [ADR](adr/README.md)。

`all` 表示 Feature manifest 未限制该字段；Contribution catalog 仍会进一步限定站点、路由和 Surface。下表按 catalog 顺序列出，修改 manifest 时应同步核对。

`detail.shortcuts` 由 Detail Feature 所有；普通详情与 FC2 工作区在各自实例内挂载共享控制器。Contribution 资格包含列表上的 FC2 弹窗，但不会因此在列表启动整个 Detail Feature。配置 `detailShortcuts` 由 SettingsService 持久化，默认全部留空；设置入口为“列表与详情 → 鉴定快捷键”。

| Feature | Kind | Sites | Routes | Startup | Contributions |
| --- | --- | --- | --- | --- | --- |
| `webdav-sync` | system | javdb, javbus | all | eager | — |
| `settings-effects` | system | all | all | eager | — |
| `settings-entry` | system | javdb, javbus | all | eager | `settings.core` |
| `settings` | system | all | all | on-command | — |
| `diagnostics` | system | all | all | on-command | — |
| `responsive-shell` | system | javdb, javbus | all | idle | `responsive-shell.bottom-bar` |
| `stats` | system | javdb, javbus | all | idle | `stats.dashboard` |
| `enhancement-settings` | system | javdb, javbus | all | on-command | — |
| `translation-tools` | feature | javdb, javbus | all | eager | — |
| `media-library` | feature | javdb, javbus | all | eager | — |
| `personal-ratings` | feature | javdb, javbus | all | eager | — |
| `movie-selection` | feature | javdb, javbus | list | eager | — |
| `movie-lists` | feature | javdb, javbus | all | eager | — |
| `privacy` | feature | javdb, javbus | all | eager | — |
| `subtitle-workspace` | feature | javdb, javbus | list, detail, owned-detail | on-command | — |
| `detail` | feature | javdb, javbus | detail, owned-detail | eager | `detail.javdb-native`, `detail.workspace`, `detail.page-state-actions`, `detail.shortcuts`, `detail.javdb-preview`, `detail.javbus-preview`, `detail.reviews`, `detail.related`, `detail.native-magnets`, `detail.screenshot` |
| `fc2-workspace` | feature | javdb | list, detail, owned-detail | eager | `detail.fc2-owned` |
| `list` | feature | javdb, javbus | list | eager | `list.core`, `list.auto-page`, `detail.fc2-navigation`, `list.fold-category`, `list.actions`, `detail.javbus-images`, `detail.cover-state-actions` |
| `library` | feature | javdb, javbus | all | eager | `library.history`, `library.keyword-filter`, `library.state-actions`, `library.blacklist`, `library.favorite-actresses` |
| `identity` | feature | javdb, javbus | all | eager | `identity.javdb-navigation`, `identity.javbus-navigation`, `identity.image-search`, `detail.javbus-native` |
| `actress-info` | feature | javdb | all | idle | `identity.actress-info` |
| `discovery` | feature | javdb | list | eager | `discovery.hit-show` |
| `ranking` | feature | javdb | list | eager | `discovery.top250` |
| `new-video` | feature | javdb | all | idle | `discovery.new-video` |
| `scheduler` | feature | javdb, javbus | list | idle | `discovery.scheduler` |
| `translation` | feature | javdb, javbus | all | eager | `external-bridge.translation` |
| `external-bridge` | feature | javdb, javbus, 123pan, javtrailers, subtitlecat | all | eager | `external-bridge.offline`, `external-bridge.123pan`, `external-bridge.javtrailers`, `external-bridge.subtitle`, `detail.external-magnets` |
| `fc2-catalog` | feature | javdb | all | idle | `detail.fc2-lookup` |
| `one-one-five` | feature | javdb, javbus | list, detail | idle | `external-bridge.115-match` |
| `external-sites` | feature | javdb, javbus | detail, owned-detail | eager | `detail.external-sites` |
| `compatibility` | feature | javdb, javbus | all | eager | `compatibility.enhancements` |

## Route 与验证矩阵

JavDB 页面先按路径及该页面自己的参数识别语义（`src/core/site-context.js`），再由 HostAdapter 定位宿主 DOM。网页和 API 是读取渠道，不形成新的产品分类。

| 页面 | 原生含义 | JHS 增强边界 |
| --- | --- | --- |
| `/rankings/movies?p=…&t=…` | 有码、无码、欧美、FC2 影片分类的日、周、月榜 | 保留原生类别、周期、排名及链接 |
| `/rankings/playback?p=…&t=…` | 热播的日、周、月及高分、全部条件 | 保留原生列表；不解释为 Movies 的类型参数 |
| `/rankings/top?t=…&page=…` | TOP250 总榜、类别榜、年份榜及分页 | 保留原生排名；字幕磁链只过滤当前已加载卡片 |
| `/search_advanced` | 多条件进阶检索 | 增强检索，不归类为榜单 |
| `/tags/fc2?c10=1` | JavDB FC2 分类片库 | 与 FC2 排行榜区分 |
| `/rankings/actors`、`/rankings/fanza_award` | 演员榜、FANZA 奖项 | 不套用影片榜单处理 |
| `/tags/fc2?c10=1&jhs_source=123av` | 123AV 外部 FC2 片库 | 明示来源，独立于 JavDB 榜单 |

旧 `/advanced_search` 链接在功能挂载前迁到有效页面。旧 TOP250 每页 50 项、原生每页 40 项，迁移按旧页首名次定位；旧字幕参数只保留已加载条目的过滤含义。`movie.rankings()` 作为兼容入口查询 Playback，分类榜与 TOP250 不调用它。榜单算法及高分阈值没有原生说明，不在此定义。

| Surface | HostAdapter route | Release proof | Known boundary |
| --- | --- | --- | --- |
| JavDB List | `list` | Vitest + real-origin Edge/Chromium fixture | 宿主页面可能变化 |
| JavDB Detail | `detail` | Vitest + real-origin Edge/Chromium fixture | 登录态内容可能变化 |
| JavBus List | `list` | Vitest + real-origin Edge/Chromium fixture | 宿主页面可能变化 |
| JavBus Detail | `detail` | Vitest + real-origin Edge/Chromium fixture | 登录态内容可能变化 |
| FC2 Owned Detail | `list` / `detail` / `owned-detail` | Vitest owned-surface contract + browser fixture | 弹窗与独立工作区分别验证；第三方资源可能变化 |
| Compact / landscape | profile-driven | Edge/Chromium fixture viewport matrix | 设备字体和浏览器 UI 可能不同 |

性能与请求预算由 `performance-budget.json` 管理，模块边界由 `npm run check:architecture` 校验。自动检查使用同一个独立 Dev 产物。正式发布验收另行记录登录实站结果和正式构建产物。
