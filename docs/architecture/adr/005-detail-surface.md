# ADR-005：Detail Surface 与 HostAdapter

状态：Accepted

HostedDetailSurface 只能通过 JavDB/JavBus HostAdapter 读取和定位宿主 DOM；Feature/UI 中宿主 selector 为零。OwnedDetailSurface 统一 FC2/123AV 自有布局。关闭、切换和重挂载必须 dispose，旧异步结果不得写入新 root。
