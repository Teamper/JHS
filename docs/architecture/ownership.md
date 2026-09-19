# JHS 6.5 代码职责 Ownership

Ownership 描述的是唯一职责归属，不是人员归属。新增行为必须进入对应 Owner；跨层调用只通过 contracts 中的契约。

| 职责 | Owner |
| --- | --- |
| 应用装配、运行时实例生命周期 | App Composition Root |
| Feature 激活、Contribution 启停、Command owner | FeatureRuntime |
| Movie identity | MovieIdentityService |
| JavDB/JavBus 当前页面 selector 与读取 | 对应 HostAdapter |
| JavDB/JavBus 远程协议与解析 | 对应 Integration |
| Review/Related/Magnet/Screenshot/Offline 业务 | 对应 Service |
| Review/Related 等渲染 | 对应 Panel/View |
| Hosted 详情布局 | HostedDetailSurface |
| FC2/123AV 自有详情布局 | OwnedDetailSurface |
| History 跨页选择 | HistorySelectionModel |
| List 快速筛选键、硬屏蔽判定与匹配规则 | List Filters Feature |
| 外部 URL 信任与 redirect 复验 | ExternalUrlPolicy |
| 请求合并、缓存与取消 | HttpService / CacheService / LifecycleScope |
| 设置 snapshot 与本 runtime 事件 | SettingsService |
| 诊断数据和脱敏导出 | DiagnosticsService |

判断缺陷归属时先确定表中 Owner，再由 Owner 调用下层契约；不得把行为放入“当前碰巧能拿到数据”的 Feature。
