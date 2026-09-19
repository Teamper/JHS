# ADR-002：Feature 与 Contribution

状态：Accepted

Feature 表示可激活的用户能力，Contribution 保留旧 Plugin 的独立启停粒度。system Feature 不可禁用。关闭 Contribution 时不得注册其专属 listener、CSS、command 或网络工作，但可复用 Feature 的共享 UI primitive CSS。Command owner 由 manifest 预注册，调用时可懒激活 owner。
