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

| Surface | HostAdapter route | Release proof | Known boundary |
| --- | --- | --- | --- |
| JavDB List | `list` | Vitest + real-origin Edge/Chromium fixture | 宿主页面可能变化 |
| JavDB Detail | `detail` | Vitest + real-origin Edge/Chromium fixture | 登录态内容可能变化 |
| JavBus List | `list` | Vitest + real-origin Edge/Chromium fixture | 宿主页面可能变化 |
| JavBus Detail | `detail` | Vitest + real-origin Edge/Chromium fixture | 登录态内容可能变化 |
| FC2 Owned Detail | `detail` | Vitest owned-surface contract + browser fixture | 第三方资源可能变化 |
| Compact / landscape | profile-driven | Edge/Chromium fixture viewport matrix | 设备字体和浏览器 UI 可能不同 |

性能与请求预算由 `performance-budget.json` 固化；架构债务位置由 `architecture-baseline.json` 固化。发布检查以同一提交上的自动门禁结果和跟踪构建产物为准。
