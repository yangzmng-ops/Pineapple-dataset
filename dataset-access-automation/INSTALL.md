# Pineapple 数据集申请自动审批

状态：**实现及本地测试已准备；未部署、未连接 Google、未授予任何数据权限、未发送邮件。**
默认 DRY_RUN。规则是用户确认的“学术研究且非商用且不再分发”，不是一份新增数据许可。实际许可文本、条款版本、隐私说明仍需所有者确认。

## 文件

- `Code.gs`：Google Apps Script 适配层，安装、验证、日志、权限、通知与补偿。
- `Core.gs`：可测试的判定及权限/通知状态机。
- `appsscript.json`：V8 清单和显式 OAuth 范围。
- `Core.js`：与 Core.gs 完全相同，供 Node 测试。不要同时复制进 Apps Script。
- `test.js`、`test-code.js`：`node --test test.js test-code.js`，不访问网络、不发邮件、不改权限。
- `docs/`：待上线的 README 片段及上线检查表。

## 所有者最小安装步骤

1. 使用拥有目标 ZIP 的 Google 账户，新建私有 Apps Script 项目。添加 `Code.gs`、`Core.gs`，打开“显示 appsscript.json 清单”并替换其内容。
2. 关联该账户可管理的标准 Google Cloud 项目，启用 **Google Forms API** 和 **Google Drive API**。无需创建 API 密钥或将凭据放进代码。OAuth 同意屏幕使用适合该账户的正式配置；外部应用若长期停留 Testing 可能影响持久运行，须按 Google 控制台要求处理。勿绕过安全警告。
3. 手动运行 `setup()`，亲自审阅并批准 Google 授权。它创建关闭接收且未发布的申请表、私有日志表；通过 Forms API 显式设 `VERIFIED`。输出两个管理链接；ID 保存在 Script Properties 的 CONFIG，勿公开。默认不审批、不发信。若 API 未启用等原因导致半途失败，保留 CONFIG 和已创建资源，先检查已存 ID，**不要删除 CONFIG 盲目重跑**；由维护者修复同一安装，或经确认后清理。
4. 所有者确认实际条款及隐私说明后，在 Script Properties 填入：
   - `APPROVED_TERMS_VERSION`：固定版本标识
   - `APPROVED_TERMS_URL`：申请人能访问的 HTTPS 条款页面
   - `APPROVED_OWNER_EMAIL`：ZIP 所有者 Google 账户邮箱
   - `APPROVED_PRIVACY_NOTICE`：告知收集字段、仅用于申请审批及联系、实际保存期限、联系方式的完整文字；期限和联系方式不能凭空填写
   运行 `configureApprovedTerms()`，再运行 `installDryRunTriggers()`。
5. 在 Forms 编辑器核对收集邮箱为 **Verified**、关闭修改回复及查看回复摘要，核对条款链接/版本。先仅向所有者控制的测试账户开放表单，仍保持 DRY_RUN，完成 docs 中的测试。安装后的触发器以安装者身份执行。测试邮件地址不能来自手填问题。
6. 准备正式启用时，关闭接收，确认目标 ZIP 确为该账户所有、Restricted，且没有群组/域/公开权限；不改动原有单个读者。填入 `ENABLE_CONFIRMATION` = `ENABLE 1gy-sYSPqZZ_yMpRZ_ciyWj58GbsVeiwe`，运行 `enableLive()`。它重新验证许可、所有权、schema、邮箱方式与日志隐私，记录生效时间，消费确认值；**不会替你发布表单**。随后所有者在 Forms UI 明确配置申请人范围、发布、开接收，再替换 GitHub 的申请入口。
7. 使用所有者控制的真实测试 Google 账户执行一次 live 端到端验证，确认可下载、仅 reader、邮件一次。Google 实际环境未通过这一步前，不宣称系统已上线。

每次重新启用只处理其后提交的申请，不补批 dry-run、暂停期或历史申请。改条款必须暂停、关闭接收并复核；建议为实质变更创建新表单以免旧页面同意产生歧义。

## 权限及授权边界

目标 ZIP 硬编码为 `1gy-sYSPqZZ_yMpRZ_ciyWj58GbsVeiwe`，不接受申请人传入文件 ID、权限角色或授权地址。通过 Drive API 明确 `user/reader`、`sendNotificationEmail=false`，再由独立 MailApp 通知状态发确认邮件。不设“任何有链接者可访问”，不共享文件夹或申请日志。

清单包含较宽的 Drive 范围、Forms/Sheets、创建触发器、外部请求及发邮件权限：这需要所有者主动审阅和当次授权。现有 connector 的 `appNotAuthorizedToFile` 并未因此解决；Apps Script 是单独批准的新应用，不能用作绕过拒绝权限的方法。任何 Google 组织外部共享限制都须尊重。实现仅支持个人 My Drive、所有者账户部署；Shared Drive/非owner维护者需要专门适配。

## 规则和人工处理

完整姓名/机构/身份/用途、verified 邮箱、同意条款，且三项为 Yes / No / No 才符合自动条件。未同意或不完整不授权；商业、再分发、不确定及其他用途转人工。用途里常见商用/销售/再分发关键词也保守转人工，因此 “non-commercial” 等可能产生误报；这不是语义审查、学校身份核验或防欺诈保证。其他语言、隐晦说明可能无法识别。需要严格核验真实研究身份时应使用全人工审批。

`Requests` 以 response ID 和 JSON 分别存审核、权限、通知、时间、条款版本和错误。申请详情只存在私有表内，不发布。`Blocks` 中对邮箱填 `REJECTED` 或 `REVOKED` 可阻止未来自动审批；**填表不会撤销已经存在的 Drive 权限**。真正撤销时先暂停、填 Blocks，再在 Drive 撤销（含必要的父级继承检查），最后恢复。仅删除申请日志会破坏防重复/防恢复记录，禁止随意清空。

同一项目用 ScriptLock 串行化。存在同邮箱历史授权/尝试则不再自动授权；不覆盖原有 editor/owner。权限请求结果未知且实际无权限时转人工，防止恢复已撤销权限。邮件 `SENDING/UNCERTAIN` 不自动重发，避免超时后重复通知；管理员核对后单独处理。人工批准、拒绝及重发没有危险的一键脚本，维护者需核实具体申请后在 Google 界面处理。

## 运维与故障

- `pauseLive()`：停止未来自动授权和通知，不撤销现有权限；必要时同时关闭表单。
- 每小时重试仅已记录的 LIVE 合格待处理项；限流/5xx 退避，最多5次后人工；授权失败从不发成功信。
- 发信配额不足只延期通知；已授予权限不重复创建。个人账户当前 MailApp 100收件人/日，Workspace 1500；Google配额可变化。
- 原生触发器错误通知和 Executions 是告警来源。注意 `MANUAL_*`、`NEEDS_OPERATOR`、`UNCERTAIN`、`DUPLICATE_REVIEW` 和长时间 `PENDING_QUOTA`。
- schema/API/日志隐私检查失败时立即停止；极早阶段失败的回复可能只留在 Google Form 本身，恢复后需在 Forms“回复”中人工对账，不得未经核验自动回放历史回复。
- 一次 Sheet 扫描随申请量增长；设计用于低流量研究数据集。单批4分钟截止，持续大规模流量应迁移数据库或 HF gated dataset。
- Apps Script API错误只记状态和 reason，不记录 OAuth token 或原始响应。申请人的自填个人资料应按批准期限保留并清理；去重/拒绝记录的保存也需符合已告知政策。
- Google ACL 外部修改不受此项目的锁控制；进行手工权限维护前暂停，避免竞态。
- 撤销不能收回已下载副本。

## 已验证与未验证

本地25项纯逻辑与VM适配层测试通过，覆盖全部27种三选项组合、必填/邮箱/同意、dry-run、历史记录、正常与重复执行、原有读者、权限/邮件未知结果、配额、撤销和人工状态。适配层mock验证固定目标/reader/无原生通知、跨记录阻止、schema变化、非Verified拒绝及异常解锁。静态 Node 语法检查通过。Google API、OAuth、真实 Forms事件、邮件投递和下载未在真实账户执行；必须完成上线清单。

## 官方依据

- Verified邮箱：https://developers.google.com/workspace/forms/api/reference/rest/v1/forms#EmailCollectionType
- Forms邮箱UI：https://support.google.com/docs/answer/139706?hl=en
- 安装型触发器：https://developers.google.com/apps-script/guides/triggers/installable
- File.getAccess限制：https://developers.google.com/apps-script/reference/drive/file#getAccess(String)
- permissions.create：https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/create
- 配额：https://developers.google.com/apps-script/guides/services/quotas
- 403权限解释：https://developers.google.com/workspace/drive/api/guides/handle-errors#appnotauthorizedtofile
