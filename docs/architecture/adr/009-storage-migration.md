# ADR-009：Storage 与最小迁移

状态：Accepted

保留 `JAV-JHS`、既有 key 与 `data_version=2`。Settings migration 只 journal 被修改字段的 previous value，失败时局部恢复；未修改领域不做 DB snapshot。新备份不导出 Cache，旧 Cache 可导入后直接失效。disabledPlugins 写新 Contribution ID，同时保留未知 legacy 值。
