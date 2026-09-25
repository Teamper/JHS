# JHS 6.5 Feature Matrix

本矩阵冻结 Feature 的能力边界；独立启停单位以 Contribution ID 为准。FeatureRuntime 在注册时校验 Feature ID 与 Contribution owner 唯一性，旧 Plugin 名通过 `LEGACY_PLUGIN_CONTRIBUTION_MAP` 迁移。

| Feature | Kind | Sites / route | Startup | Contributions |
| --- | --- | --- | --- | --- |
| `settings` | system | all | on-command | `settings.core` |
| `diagnostics` | system | all | eager | — |
| `responsive-shell` | system | all | eager | `responsive-shell.bottom-bar` |
| `stats` | system | JavDB, JavBus | idle | `stats.dashboard` |
| `detail` | feature | JavDB, JavBus / detail | eager | `detail.javdb-native`, `detail.javbus-native`, `detail.workspace`, `detail.fc2-owned`, `detail.fc2-lookup`, `detail.cover-state-actions`, `detail.page-state-actions`, `detail.javdb-preview`, `detail.javbus-images`, `detail.javbus-preview`, `detail.reviews`, `detail.related`, `detail.native-magnets`, `detail.external-magnets`, `detail.screenshot`, `detail.external-sites` |
| `list` | feature | JavDB, JavBus | eager | `list.core`, `list.auto-page`, `list.fold-category`, `list.actions` |
| `library` | feature | JavDB, JavBus | eager | `library.history`, `library.keyword-filter`, `library.state-actions`, `library.blacklist`, `library.favorite-actresses` |
| `discovery` | feature | JavDB, JavBus | eager | `discovery.hit-show`, `discovery.top250`, `discovery.new-video`, `discovery.scheduler` |
| `external-bridge` | feature | JavDB, JavBus, 123Pan, JavTrailers, SubtitleCat | eager | `external-bridge.translation`, `external-bridge.115-match`, `external-bridge.offline`, `external-bridge.123pan`, `external-bridge.javtrailers`, `external-bridge.subtitle` |
| `identity` | feature | JavDB, JavBus | eager | `identity.javdb-navigation`, `identity.javbus-navigation`, `identity.image-search`, `identity.actress-info` |
| `compatibility` | feature | JavDB, JavBus | eager | `compatibility.enhancements` |

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

旧 `/advanced_search` 链接在插件挂载前迁到有效页面。旧 TOP250 每页 50 项、原生每页 40 项，迁移按旧页首名次定位；旧字幕参数只保留已加载条目的过滤含义。`movie.rankings()` 作为兼容入口查询 Playback，分类榜与 TOP250 不调用它。榜单算法及高分阈值没有原生说明，不在此定义。

| Surface | HostAdapter route | Release proof | Known boundary |
| --- | --- | --- | --- |
| JavDB List | `list` | Vitest + real-origin Edge/Chromium fixture | 宿主页面可能变化 |
| JavDB Detail | `detail` | Vitest + real-origin Edge/Chromium fixture | 登录态内容可能变化 |
| JavBus List | `list` | Vitest + real-origin Edge/Chromium fixture | 宿主页面可能变化 |
| JavBus Detail | `detail` | Vitest + real-origin Edge/Chromium fixture | 登录态内容可能变化 |
| FC2 Owned Detail | `detail` | Vitest owned-surface contract + browser fixture | 第三方资源可能变化 |
| Compact / landscape | profile-driven | Edge/Chromium fixture viewport matrix | 设备字体和浏览器 UI 可能不同 |

性能与请求预算由 `performance-budget.json` 固化；架构债务位置由 `architecture-baseline.json` 固化。发布检查以同一提交上的自动门禁结果和跟踪构建产物为准。
