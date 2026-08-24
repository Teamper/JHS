# ADR-007：RequestKey 与 Cache

状态：Accepted

RequestKey 包含 provider、method、canonical URL、body hash、response type、cache scope、vary headers hash 与 session scope id。公开 GET 可 public cache/dedupe，登录 GET 仅 session 内存范围，修改请求默认不缓存也不通用合并。凭证原值不得进入 key、缓存、日志或 Diagnostics。Cache schema 仅是可丢弃 namespace 版本。
