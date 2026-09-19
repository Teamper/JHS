# ADR-008：Lifecycle 与 Cancellation

状态：Accepted

除 App Root Lifecycle 外，listener、observer、timer 和 request consumer 都必须属于可 dispose 的 LifecycleScope。共享请求使用 consumer 引用计数；scope dispose 后其 consumer 为零，且无其他 live consumer 时才取消底层请求。异步提交前校验 scope 与 mount generation。
