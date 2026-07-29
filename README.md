# Compliance Hub Prototype

一个可在本机运行的中英双语 Compliance Hub 对话原型。用户始终从一个 Chat 输入框提问，Master Agent 在后台路由到 Trade Compliance、Product Compliance 和 Ethics & TPDD Agent，并在同一条对话中返回统一答案。

## 当前可验证的能力

- 中英双语界面，以及 Dark / Light 主题切换。
- 单一连续对话入口；最近 6 条消息作为追问上下文。
- 专业 Agent 结果收在统一回答的可展开“分析轨迹”中，不创建多个对话窗口。
- OpenAI-compatible API 配置：API Key、Base URL、Model。
- 规则演示模式：无需 API Key，可针对内置政策、名单和验收场景生成差异化答案；它不是开放式大模型问答。
- 实时模型模式：各专业 Agent 并行分析，Master Agent 再做综合结论。
- 12 个可筛选测试场景，覆盖 Trade、Product、Ethics & TPDD 和跨域协同；场景库只负责填入主对话框。
- 公开来源整合：BIS、OFAC、Trade.gov、SEC、MOFCOM、DOJ、OECD、厂商公开分类页面等。
- 公开来源的状态会区分 `实时获取`、`元数据`、`未获取` 和 `获取失败`；来源失败不等同于“无风险”。
- 独立的数据覆盖页：<http://127.0.0.1:4180/data-sources.html>，展示 Adapter、凭证限制、真实同步状态、记录数、来源版本和错误隔离。
- 统一数据层会保存官方原始快照、SHA-256、标准化记录和同步状态；运行数据保存在 `data/runtime/`，不会提交到 Git。
- 已实现 CSL、OFAC、UN、UK、eCFR Part 734/736/738/740/744/774 与 GLEIF Adapter；SAM.gov 和 Companies House 已实现需要免费 Key 的实时查询 Adapter。
- 中国侧已实现商务部两用物项管制公告、管控名单／关注名单、不可靠实体清单和许可证管理目录 Adapter。
- 名单筛查覆盖所有已同步的受限方来源，不再依赖硬编码的公司别名表。
- 合成内部主数据（产品、BOM、业务伙伴、供应商、交易）用于演示外部名单与内部主数据的碰撞。

## 范围

本 Prototype 只做**出口管制**，覆盖**美国与中国**两个法域：

- Trade Compliance — 受限方筛查（美国 CSL/OFAC/EAR 744，中国管控名单／关注名单／不可靠实体清单）
- Product Compliance — 物项归类与许可判定（美国 ECCN → 管制理由 → Country Chart → License Exception；中国两用物项管制编码 → 许可证管理目录）
- Ethics Compliance-TPDD — 与出口管制相关的第三方尽调（最终用户、UBO、付款路径、规避模式）

不在范围内：产品准入类合规（FCC、CCC、RoHS、能效）；UN／UK／EU 名单仅保留既有实现，不再投入。

## 启动

Dependency 只有 **Node.js 18+**，不需要安装 npm package，也不需要数据库。第一次完整同步会写入本机磁盘；例如本次 CSL 官方 JSON 快照约 33 MB，标准化文件会额外占用空间。

```bash
npm start
```

浏览器打开 <http://127.0.0.1:4180>。

内部主数据是**合成演示数据**，已随仓库提供。需要重新生成（例如调整规模）时：

```bash
npm run seed
```

生成器使用固定随机种子，同一份代码总是产出同一份数据，因此 diff 一定代表真实变化。所有记录都带 `dataClass: "synthetic"`，分类值标记为 `unverified_demo_value`，不能作为任何真实产品或公司的分类依据。

当前机器没有 `.env`，所以页面默认开启“规则演示”。要让 Master Agent 对开放式问题依据当前问题和官方来源实时综合，必须配置一个 OpenAI-compatible 大模型：

1. 点击右上角“模型配置”。
2. 填写 OpenAI-compatible `Base URL`、`Model` 和 `API Key`。
3. 先点“测试连接”，成功后保存。
4. 保存 API Key 后页面会自动关闭“规则演示”，再提交问题。

也可以复制 `.env.example` 为 `.env`，自行填写后使用：

```bash
npm run start:env
```

注意：`npm start` 不读取 `.env`；使用服务器侧配置时必须运行 `npm run start:env`。服务器只通过 `/api/runtime-capabilities` 返回“是否已配置”，不会把 Key 返回给浏览器。

两种模式的边界：

- `grounded-demo`：规则 + 已同步结构化数据 + 实时官方网页，适合当前内置场景和已编码政策。
- `live-model`：问题意图 + 专业 Agent + 结构化名单 + 当前官方网页全文 + 大模型综合，适合开放式追问和不同措辞。
- 无论哪种模式，产品是否受限都需要准确型号/part number、关键技术参数、原产地、目的地、最终用户和最终用途；模型不能替代缺失的交易事实。

`.env` 已被 `.gitignore` 排除。不要把 Key 发到聊天、截图或 Git 中。

## 需要额外购买什么

第一版**没有必须购买的软件依赖**。如果使用演示模式，成本为零。

实时模型模式需要一个兼容 Chat Completions API 的大模型账户及可用额度。可以使用 OpenAI API，也可以使用公司批准的兼容服务或本地兼容模型。不同模型的调用费用和数据处理条款需要由你们自行确认。

目前不需要购买 Dow Jones、LSEG/World-Check、LexisNexis、Dun & Bradstreet 等数据服务，因为 Prototype 只使用公开来源。进入公司增强阶段后，如果要做生产级受限方筛查、UBO/PEP/负面新闻、企业注册信息或持续监控，再评估购买对应数据源。

以下两项不是付费 dependency，但对应来源需要注册免费 Key：

- `SAM_GOV_API_KEY`：SAM.gov Exclusions；个人账户可能只有 10 次/天，具体额度取决于账户角色。
- `COMPANIES_HOUSE_API_KEY`：UK Companies House 实时公司查询。

把 Key 只写在本机 `.env`。`.env.example` 中只有空占位符。

## 部署到 Zeabur

仓库用 `Dockerfile` 定义构建，不依赖 buildpack 自动识别。基础镜像 `node:20-alpine`，启动命令是 exec form 的 `node server.js`（让 node 成为 PID 1 并直接收到 SIGTERM），端口默认 8080、`PORT` 注入时以注入值为准。

之所以显式写 Dockerfile：buildpack 路径出现过"构建成功但容器从未运行、runtime log 完全为空"的情况，这种失败无法诊断——看不出进程有没有起来、绑了哪个端口、为什么退出。

1. Zeabur Dashboard → New Project → Deploy Service → GitHub → 选择 `strangeromo-cloud/compliance_hub`。
2. 在 Variables 里配置：

| 变量 | 值 | 说明 |
|---|---|---|
| `SYNC_ON_BOOT` | `china-dual-use,china-control-entities,china-unreliable-entity,china-licence-catalogue,bis-ear-734,bis-ear-740,bis-ear-744` | 容器启动后台同步。**不要**放 `trade-csl` / `ofac-sls`，它们是几十 MB 全量下载 |
| `COMPLIANCE_HUB_USER_AGENT` | `ComplianceHubPrototype/0.1 <你的邮箱>` | SEC 等政府接口要求可识别的 UA |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` | 你的模型配置 | 配置后页面自动进入实时模型模式，使用者不必再自己填 Key |
| `ACCESS_PASSWORD` | 自定义口令 | **配置了服务器侧 Key 就应该同时配这个**，见下 |

`HOST` 不需要手工配置：进程检测到自己是容器里的 PID 1（或存在 `ZEABUR_SERVICE_ID`）时会自动绑定 `0.0.0.0`，本机运行仍然只绑回环。

3. Networking 里绑定域名。

### 为什么必须显式处理 SIGTERM

容器里应用是 PID 1，而 Linux 内核**不对 PID 1 应用默认信号处理**：没有注册 handler 的 `SIGTERM` 会被直接忽略。结果是平台发停止信号后进程毫无反应，服务永久卡在 `Stopping`，新部署也排不上队。

`server.js` 因此显式注册了 `SIGTERM` / `SIGINT`：关闭监听、断开空闲连接，并设置 5 秒兜底强制退出——一个 keep-alive 连接或正在下载的官方数据源不应该有能力把容器一直挂住。

同理，启动命令不要写成 `HOST=0.0.0.0 node server.js`。这种内联赋值依赖 shell 展开，一旦被 exec-form 直接执行就是 `ENOENT`。

### 部署后必须注意

- **容器文件系统是临时的**：每次重新部署 `data/runtime/` 都会清空，靠 `SYNC_ON_BOOT` 重新拉取。需要持久化就挂一个 Zeabur Volume 到 `data/runtime`。
- **服务器侧配置 `OPENAI_API_KEY` 时必须同时配置 `ACCESS_PASSWORD`**。公开 URL 上任何人都能调用 `/api/assess`，没有口令的话服务器侧的 Key 等于把模型额度对公网开放。设置 `ACCESS_PASSWORD` 后，`/api/assess`、`/api/test-connection` 和 `/api/data-sources/sync` 都需要口令；使用者在页面“模型配置”里填一次，存在浏览器 localStorage，之后不必再输入。
- 不设 `ACCESS_PASSWORD` 时行为不变（完全开放），适合本机运行，不适合公开部署。
- 口令是明文比对的共享秘密，用于挡住无意访问，不是身份认证；不要用它保护真实敏感数据。
- 首次启动时同步尚未完成，名单筛查会如实报告“来源未同步”，不会伪装成“无风险”。

## 数据同步与查询 API

页面上的“立即同步”只允许调用代码中预定义的官方来源，不接受任意 URL。

```text
GET  /api/data-sources
POST /api/data-sources/sync   { "sourceId": "trade-csl" }
POST /api/data-sources/query  { "sourceId": "trade-csl", "query": "HUAWEI", "limit": 5 }
```

`success` 表示原始快照和标准化记录均已真实落盘。`failed` 会保留错误和时间，不影响其他来源。`configuration_required` 表示 Adapter 已实现但尚未配置免费 API Key。验证码或不允许稳定自动化的来源仍显示为 `manual_only`。

### 兜底快照

中国来源在部分海外节点无法访问（例如 Zeabur 曼谷区域）。`data/fallback/` 随仓库提交了四个中国来源的时点副本，本机没有同步结果时自动启用。

**它不会显示为已同步。** 状态是独立的 `fallback_snapshot`，顶栏指示灯是黄色而非绿色，查询结果带 `provenance: "bundled_fallback_snapshot"`，Agent 的回答里也会明确写出"本次使用随仓库提交的时点快照（采集日期），此后发布的新增、暂停或废止公告不在其中"。

把时点副本当作现行名单，是这个工具最不该犯的错误，所以它在每一层都是显式标注的。真实部署应当优先修复网络可达性（把服务放到香港区域），兜底只是保证演示可用。

更新兜底快照：先在能访问的机器上同步，再把 `data/runtime/normalized/china-*.json` 复制进 `data/fallback/` 并补上 `provenance` / `bundledAt` / `note` 字段。

### 中国来源的边界

- 使用商务部及安全与管制局站点自身的公开接口，**不绕过任何验证码**；带验证码的两用物项查询库仍是人工交叉核对入口。
- 管控名单／关注名单公告会解析出中文名、英文名、常用名称、地址和邮编。公告标题声明的实体数量（“将 10 家美国实体……”）被用作解析自检：`extractionComplete` 为 false 时说明抽取不完整，该批记录不能当作完整名单使用。
- 公告之间的暂停、调整、废止关系记录在 `supersedesNotices` 中。**一条措施是否仍然有效必须结合这些关系判断**，不能只看原始公告。
- 两用物项统一清单本身是公告附件 PDF，目前只保存快照与校验和，尚未解析成条目。

## 安全边界

- 页面填写的 API Key 仅放在浏览器 `sessionStorage`，关闭该浏览器会话后消失。
- Key 会发送给本机 Node 服务，用于转发模型请求；服务不记录请求体和 Key，也不写入文件。
- Base URL 和 Model 只保存在浏览器本地。
- 公网页面内容被当作不可信参考文本，并在 Agent prompt 中明确禁止执行网页内指令。
- 本地名单查询只产生 `potential_match_requires_review`，不会自动输出 Confirmed Match、许可判定或交易放行，也不构成法律意见。
- 实体匹配会输出 `likely_false_positive_identity_elements_conflict`（身份要素冲突，疑似误报）或 `strong_potential_match_escalate_for_human_confirmation`（建议升级人工确认）。**两者都不是最终判定**：疑似误报仍需人工用注册证据确认，系统不会自动放行。

## 架构边界

当前采用零依赖的轻量多 Agent orchestration，便于先验证业务价值。接口边界已分开：路由、公开来源检索、专业 Agent、Master synthesis 和 UI。Prototype 成功后，可将编排层替换为 Deep Agents / LangGraph，并接入内部 BOM、customer/vendor master、历史问卷和正式 screening provider。

## 测试

业务验收场景、预期 Agent 和成功标准见 [TEST_SCENARIOS.md](./TEST_SCENARIOS.md)。

```bash
npm test
```
