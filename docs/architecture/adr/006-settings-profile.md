# ADR-006：Settings 与 Profile

状态：Accepted

SettingsService 在同一 runtime 内以校验、持久化、原子替换 snapshot、发布 `settings.changed` 的顺序更新。v6.5 不新增跨 Tab 设置热同步，其他 Tab 在下一次加载读取。Profile 为 compact/regular/wide，监听尺寸、方向和 pointer media 变化；底部 UI 使用 safe-area inset。
