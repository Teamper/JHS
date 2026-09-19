# ADR-001：模块边界与依赖反转

状态：Accepted

采用 `contracts Port → platform Adapter → Service → Feature`。Feature、Service 和 Integration 不得 import platform；Composition Root 创建 AppContext 并只按 manifest 的 `requires` 注入冻结后的依赖子集。缺失、重复或未声明依赖立即失败并写入 Diagnostics。完整 AppContext 不进入业务模块。
