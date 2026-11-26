# ADR-009：Storage 与最小迁移

状态：Accepted

6.5 将数据迁至 `data_version=2`，保留 `JAV-JHS`、现有键和可移植备份。设置迁移按实际修改字段保存恢复信息，重新加载时归并旧 `disabledPlugins` ID。

7.0 沿用 `JAV-JHS/appData` 及现有业务键，按顺序执行到 `data_version=4`。StorageService 接收 IndexedDB 或 SQLite 端口。`StorageMutationCoordinator` 负责序列化启动迁移、状态写入、同步和备份导入。启动和导入验证数据版本，未来版本在写入前被拒绝。评分迁移保存一份迁移前的可移植快照。

便携备份由 `PortableBackupService` 读取并验证。原子导入在事务内核对预期键值和更新业务数据，连接凭证、缓存及设备偏好留在平台存储。旧状态日志可在本地恢复后重试。见 [原子状态保存](014-atomic-state-and-sync-computation.md)。
