# JHS 7.0 代码职责 Ownership

Ownership 描述的是唯一职责归属，不是人员归属。本表对应 `develop` 当前实现；6.5 冻结决策由 [ADR](adr/README.md) 保留。新增行为必须进入对应 Owner；跨层调用只通过 contracts 中的契约。

| 职责 | Owner |
| --- | --- |
| 应用装配、运行时实例生命周期 | App Composition Root |
| Feature 激活、Contribution 启停、Command owner | FeatureRuntime |
| 旧名称查询与兼容能力连接 | CompatibilityBeanRegistry / `compat/`；业务执行仍由 FeatureRuntime 负责 |
| Movie identity | MovieIdentityService |
| JavDB/JavBus 当前页面 selector 与读取 | 对应 HostAdapter |
| JavDB/JavBus 远程协议与解析 | 对应 Integration |
| Review/Related/Magnet/Screenshot/Offline 业务 | 对应 Service |
| Review/Related 等渲染 | 对应 Panel/View |
| Hosted 详情布局 | HostedDetailSurface |
| FC2/123AV 自有详情布局 | OwnedDetailSurface |
| FC2 工作区加载、打开和资源释放 | Fc2WorkspaceService / FC2 Workspace Feature |
| History 跨页选择 | HistorySelectionModel |
| List 快速筛选键、硬屏蔽判定与匹配规则 | List Filters Feature |
| 外部 URL 信任与 redirect 复验 | ExternalUrlPolicy |
| 请求合并、缓存与取消 | HttpService / CacheService / LifecycleScope |
| 设置 snapshot 与本 runtime 事件 | SettingsService |
| 设置同步语义校验与依赖注入 | SettingsRegistry / `app/settings-catalog.js` / `app/settings-sync-validation.js`；下载及最终合并复用描述符校验，核心模型不依赖设置界面 |
| 双向同步与不可变快照传输、保留和恢复 | WebDavSyncService / WebDAV Sync System Feature |
| 字段版本、删除代、影子和远端应用恢复日志 | WebDavSyncStore / `core/webdav-sync-model.js`；业务锁内落地，成功写入按触及领域补账，完整核对修复遗漏 |
| 已提交远端应用的设置刷新与界面通知 | WebDavSyncStore；StorageMutationCoordinator 的 `afterRelease` 只安排锁外任务，通知成功后按日志标识确认，禁止在业务锁或设置写入队列内等待刷新 |
| 持久化发布期限、清理退避和生命周期 | WebDavSyncStore 保存期限与进度；`services/webdav-sync-scheduling.js` 计算调度；WebDavSyncService 负责网络锁、请求取消及独立清理重试 |
| 同步公共接口、外部快照校验与多页轮询 | `contracts/webdav-sync.d.ts` / `core/webdav-sync-validation.js` / WebDavSyncService；Feature 不访问服务内部依赖，同源共享检查窗口 |
| 手动备份与同步的安全下载 | WebDavClient；逐跳检查目标，跨域后持续匿名，只有全程同源的 404 可判定文件缺失，其他方法继续限制在原目标范围 |
| 跨站加密连接与旧连接候选仲裁 | WebDavSharedProfile / CredentialService / GM 存储 |
| 旧页面偏好的 SettingsService 桥接 | PersonalPreferencesService |
| 响应式 profile 与设置副作用 | ProfileService / Settings Effects Feature |
| 共用弹窗语义、焦点与清理 | DialogService / `core/dialog-shell.js`；已有独立焦点管理的调用者声明焦点所有权 |
| 浮层定位、键盘与锚点生命周期 | OwnedPopover |
| 嵌套界面的宿主页滚动锁 | `core/page-scroll-lock.js`；每个界面释放自身持有的锁 |
| 诊断数据和脱敏导出 | DiagnosticsService |

判断缺陷归属时先确定表中 Owner，再由 Owner 调用下层契约；不得把行为放入“当前碰巧能拿到数据”的 Feature。

多端同步的合并、锁、恢复与保留约束见 [ADR-013](adr/013-webdav-sync-recovery.md)。
