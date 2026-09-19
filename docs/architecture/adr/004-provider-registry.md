# ADR-004：Provider Registry

状态：Accepted

ProviderRegistry 仅负责注册、能力过滤、优先级、启停、availability 和健康状态。缓存、认证、重试与 fallback 由 MagnetService、ScreenshotService、OfflineService 等业务 Owner 管理，不建立万能 Provider 基类。
