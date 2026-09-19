# ADR-007：RequestKey 与 Cache

状态：Accepted

RequestKey 包含 provider、method、canonical URL、body hash、response type、cache scope、vary headers hash 与 session scope id。公开 GET 可 public cache/dedupe：L1 为页内内存，L2 为 IndexedDB 中带版本前缀、过期时间和 negative 标记的可丢弃条目，最多保留 500 条且最长 30 天；登录 GET 仅 session 内存范围，认证数据不得落入 L2。修改请求默认不缓存也不通用合并。凭证原值不得进入 key、缓存、日志或 Diagnostics。
