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

需要 **Node.js 24+**，不需要安装任何 npm package，也不需要外部数据库——存储用的是 Node 内置的 `node:sqlite`，所以仍然是零依赖、无构建步骤。（Node 24 这个下限就是 `node:sqlite` 带来的；低版本会在启动时直接报 `ERR_UNKNOWN_BUILTIN_MODULE`。用 nvm 的话 `nvm use 24`。）

所有落盘的东西都在一个文件里：`data/runtime/hub.db`。第一次完整同步会把官方原始文件和标准化记录都写进去，例如 CSL 官方 JSON 快照约 33 MB。

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

只有一种运行方式：`live-model` —— 问题意图 + 专业 Agent + 结构化名单 + 当前官方网页全文 + 大模型综合。

以前还有一个 `grounded-demo`（规则模式），在没有模型可用时用内置模板凑出待补项。它已经删掉了：那些模板读起来像是对你这个问题的分析，实际不是，而一个把样板当分析呈现的合规工具，比一个明说“跑不了”的工具更危险。**没有配置模型时，系统直接拒答。**

需要注意的是，删掉模板并不能替你补上事实：产品是否受限仍然需要准确型号 / part number、关键技术参数、原产地、目的地、最终用户和最终用途。模型不能替代缺失的交易事实。

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
| `SYNC_ON_BOOT` | 见下方完整值 | 容器启动后在后台依次同步。**不要**放 `trade-csl` / `ofac-sls` / `un-consolidated` / `uk-sanctions`，它们是几十 MB 全量下载；也不要放 `doj-eccp`（它没有 sync adapter，只是引用页面） |
| `SYNC_INTERVAL_HOURS` | 例如 `12`，默认关闭 | 定时把 28 个可快照的源刷一遍，不用人去点。空着或非正数就不启用 |
| `COMPLIANCE_HUB_USER_AGENT` | `ComplianceHubPrototype/0.1 <你的邮箱>` | SEC 等政府接口要求可识别的 UA |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` | 你的模型配置 | 使用者不必再自己填 Key。**没有可用模型时系统直接拒答**，不存在退回模板的模式 |
| `ACCESS_PASSWORD` | 例如 `compliance-hub` | **配置了服务器侧 Key 就必须配这个**；默认为空，为空时实时模型停用，见下 |

`HOST` 不需要手工配置：进程检测到自己是容器里的 PID 1（或存在 `ZEABUR_SERVICE_ID`）时会自动绑定 `0.0.0.0`，本机运行仍然只绑回环。

3. Networking 里绑定域名。

顺序是有意排的，boot sync 是顺序执行的：**可达的排在必然超时的前面**，所以一次中国来源的超时不会推迟任何本来能成功的源；可达的里面，分析路径逐步引用的条文最先，其次分类与目的地，再次受限方名单，各组内小的先——服务启动后越早可用越好。

`SYNC_ON_BOOT` 的推荐完整值——覆盖分析路径引用的全部官方流程条文，以及中国侧四个源：

```
bis-ear,bis-ear-732,bis-ear-734,bis-ear-740,bis-ear-744,bis-country-chart,bis-ccl,nvidia-export,amd-export,us-federal-register,us-uflpa,us-dod-1260h,sec-edgar,ofac-ownership,cninfo,jp-meti-eul,tw-shtc,eu-fsf,jp-export-control,china-licence-catalogue,china-unreliable-entity,china-dual-use,china-control-entities,china-export-licence-goods,china-control-list
```

`sec-edgar` 同步的**不是持股数据**，是 SEC 的注册发行人索引（约 10,400 家公司的 CIK、代码、EDGAR 备案名，780 KB，秒级）。它的作用是把交易方名称解析成 CIK；真正的持股比例在审查时按案件实时拉取 Schedule 13D/G（每次约 3–20 个请求）。不同步它，所有权穿透就只能回到「请用户自己填股权结构」。

`ofac-ownership` 是 50 MB 的 FollowTheMoney 实体图，解析后只留 5,047 条所有权边。放在美国来源末尾：它比条文类的源大一个量级，但比 `trade-csl` 小，且解析后写入的记录很少。

**id 是 `bis-ear`，不是 `bis-ear-736`**——Part 736（十项一般禁令）在注册表里的 id 就叫 `bis-ear`，写成 `bis-ear-736` 会得到 `Unknown data source.`，那一条根本不会同步。

美国来源排在前面是有意的：同步是顺序执行的，而部分部署所在的网络到不了 MOFCOM 的主机（`211.88.32.x` 会 ETIMEDOUT）。让能拉到的源先落地，够不到的排在最后失败，可用状态就不必等在几个连接超时后面。

每个 eCFR part 约 10–15 秒、67 KB–2 MB，全部跑完约两分钟。**同步在后台进行，服务器立即可用**：期间中国来源走兜底快照，美国条文的 ⛁ 跳源按钮在对应源同步完成后生效。

`trade-csl` 和 `ofac-sls` 请在「数据覆盖」页按需手动同步——它们分别约 33 MB 和 45 MB。

**不要设置 `PORT` 或 `HOST`**：进程自己判断（容器内 PID 1 → 绑 `0.0.0.0`，端口以平台注入值优先、缺省 8080）。手工设错 `PORT` 会导致启动崩溃循环。

### 健康检查

镜像里声明了 `HEALTHCHECK`，探针打 `/health`。它在监听建立后立刻返回成功——**不等 boot sync 完成**，这是有意的：服务在同步期间就可用，每个数据源的状态会如实报告为「未同步 / 兜底快照」，而不是让整个服务显得没就绪。编排器据此判断何时可以把流量切过来，切换窗口因此尽可能短。

如果 Zeabur 控制台里有健康检查路径的设置项，填 `/health` 即可。

### 为什么必须显式处理 SIGTERM

容器里应用是 PID 1，而 Linux 内核**不对 PID 1 应用默认信号处理**：没有注册 handler 的 `SIGTERM` 会被直接忽略。结果是平台发停止信号后进程毫无反应，服务永久卡在 `Stopping`，新部署也排不上队。

`server.js` 因此显式注册了 `SIGTERM` / `SIGINT`：关闭监听、断开空闲连接，并设置 5 秒兜底强制退出——一个 keep-alive 连接或正在下载的官方数据源不应该有能力把容器一直挂住。

同理，启动命令不要写成 `HOST=0.0.0.0 node server.js`。这种内联赋值依赖 shell 展开，一旦被 exec-form 直接执行就是 `ENOENT`。

### 换模型供应商（香港区域必须这么做）

Zeabur 香港区域连不上大多数 AI 模型服务（OpenAI、Anthropic、Gemini），但**能连中国大陆的官方来源**——这正好和当前区域相反。要两头都通，就得把模型换成香港可达的 OpenAI 兼容端点。

应用本身不绑定任何供应商：它只调 `${baseUrl}/chat/completions`，标准 Chat Completions 协议。改三个环境变量即可，**代码不用动**：

```
OPENAI_BASE_URL=https://<网关>/v1
OPENAI_MODEL=<模型名>
OPENAI_API_KEY=<该网关签发的令牌>
```

**最后一行是安全要点，不是措辞问题。** 服务器会把 `OPENAI_API_KEY` 放在 `Authorization` 头里发给 `OPENAI_BASE_URL` 指向的主机。所以这个 key 必须是**那个主机自己签发的**——把 OpenAI 的 key 配上、同时把 base URL 指向第三方网关，等于主动把 OpenAI 的 key 交给那个网关。（正因如此，服务器侧配置了 key 时会**完全忽略**客户端传来的 baseUrl，否则任何浏览器都能把服务器的 key 送到任意主机。）

另外要清楚：**提交的合规问题正文会经过这个网关**——公司名、交易结构、最终用户都在里面。选网关时按处理这类内容的标准来判断。

上线前先验证，别让部署去发现问题：

```bash
OPENAI_API_KEY=... npm run check-model -- --base https://<网关>/v1 --model <模型名>
```

它走的是应用真实的两条调用路径（普通 JSON 调用 + 流式调用），并报告：

- 认证是否通过，401 会直接说明「这个 key 不是该主机签发的」
- 流式是真流式，还是供应商用普通响应体应付了 `stream: true`（后者不算坏——`llm.js` 会按普通响应读——但回答会一次性整块出现，演示前值得知道）
- 供应商拒绝了哪些参数。`response_format: json_object` 被拒时会警告：此后只能靠提示词要求 JSON，话多的模型失败率会上升，优先选支持它的

密钥只从环境变量读，不接受命令行参数——那会写进 shell 历史和进程列表。

### 换成自托管模型（开源权重）

和上一节是同一条路：应用只调 `${baseUrl}/chat/completions`，所以任何 OpenAI 兼容的本地服务都能接。区别在于**为什么值得这么做**。

输入框下面现在写着「请勿输入商业秘密或未公开交易数据」。这句话之所以必须在，是因为问题正文要发到外部端点。而一个不能喂真实交易的合规工具，永远只能发挥一部分价值——**这是自托管的主要理由，不是省钱。**

用 vLLM 起服务（TGI、llama.cpp 的 server 同理，只要暴露 OpenAI 兼容接口）：

```bash
vllm serve NousResearch/Hermes-4-70B --host 0.0.0.0 --port 8000 --served-model-name hermes
```

然后三个环境变量：

```
OPENAI_BASE_URL=http://<内网地址>:8000/v1
OPENAI_MODEL=hermes
OPENAI_API_KEY=local-none
```

`OPENAI_API_KEY` 不能留空——服务器会无条件带上 `Authorization` 头，vLLM 默认不校验，填任意占位串即可。若用 `--api-key` 起了服务，就填那个值。

接通后先验，用的是应用真实的两条调用路径：

```bash
OPENAI_API_KEY=local-none npm run check-model -- --base http://<内网地址>:8000/v1 --model hermes
```

三件事要看清楚：

**`response_format` 可能被拒。** 较老的 vLLM 和 TGI 会对它返回 400。这不影响运行——`llm.js` 检测到之后会去掉该参数重试，并按模型记住，只付一次失败请求的代价——但此后只能靠提示词要求 JSON，话多的模型失败率会上升。能选支持它的版本就选。

**推理模式会带 `<think>` 块。** Hermes 4 这类模型会先写思路再给答案，思路里几乎必然出现花括号（因为它在谈 JSON）。`extractJson` 会剥掉推理块、并用配平花括号的方式取第一个完整对象——这一条是接入时踩出来的，不是设计出来的，`test/local-model.test.js` 里有回归。

**流式是不是真流式。** 有些部署会把 `stream: true` 当普通请求处理，回答一次性整块出现。不算坏（照样能读），但演示前值得知道。

自托管之后，「请勿输入商业秘密」那句话要不要改，是一个需要显式做的决定——它是写死的界面文案，不会因为端点变了就自动消失。改之前先确认：模型服务确实在内网、没有出网回传、日志里不落问题正文。

### 构建必须用 Node 24

`node:sqlite` 是 Node 24 才有的内置模块。三处都声明了这件事，**任何一处被绕过都会导致启动即崩溃**：

| 声明位置 | 内容 |
|---|---|
| `Dockerfile` | `FROM node:24-alpine` |
| `.node-version` / `.nvmrc` | `24` — zbpack 先看这两个文件，再看 `package.json`，优先级最高 |
| `package.json` | `"engines": { "node": "24.x" }` |
| `zbpack.json` | `{"dockerfile": {"path": "Dockerfile"}}` — 键是嵌套的，写成 `dockerfile_path` 是无效键，会被忽略 |

曾经出现过的现象：构建跑在 Node 20 上，容器反复重启，日志里只有 `Error [ERR_UNKNOWN_BUILTIN_MODULE]: No such built-in module: node:sqlite` ——这是模块加载器抛的，程序一行都没执行，所以什么也没说明。现在启动时会先检查版本并打印需要哪个版本、哪几处声明过，然后退出。

`engines.node` 一度写成 `">=24"`。zbpack 文档给的例子是确定版本号（`"18.1.0"`），范围写法没有解析成功，于是回落到了旧版本。写成 `"24.x"`。

本机开发同理：`nvm use 24`。

### 部署后必须注意

### 挂 Volume，否则每次重新部署都从零开始

容器文件系统是临时的。`data/runtime/` 在每次重新部署时清空，而这个目录里放着**两样都会丢**的东西：

| 丢的东西 | 后果 |
|---|---|
| 已同步的数据源快照 | `SYNC_ON_BOOT` 里的会自动重拉；**不在里面的不会**——手动同步过的 `trade-csl`（约 33 MB）、`ofac-sls`、`un-consolidated`、`uk-sanctions` 会回到「未同步」，得重新点一次 |
| 会话历史记录 | 全部消失，左栏历史记录清空，无法找回 |

**换成数据库并不能替代这一步。** `hub.db` 也在 `data/runtime/` 下，跟原来的 JSON 一样会被重新部署清空——决定数据活不活的是盘挂在哪，不是存成什么格式。程序会自己判断并说出来：容器里检测到数据库和代码在同一个 overlay 上时，启动日志写 `CLEARED ON REDEPLOY`，左栏历史下方也会出现一行提示。

在 Zeabur 给服务加一个 Volume：

| 字段 | 填 |
|---|---|
| Volume ID | `data`（只是标识，字母数字短横线；**不要事后改**，改 ID 等于换了一个空 Volume） |
| Mount Directory | `/app/data/runtime`（必须绝对路径；Dockerfile 里 `WORKDIR /app`） |

挂载会清空该目录在镜像中的内容——这里本来就是空的（`data/runtime` 在 `.dockerignore` 和 `.gitignore` 里），兜底快照在 `data/fallback`，不受影响。

挂好后看部署日志应出现 `Store: /app/data/runtime/hub.db (mounted_volume)`；如果写的是 `container_overlay — CLEARED ON REDEPLOY`，说明路径没对上。

挂上之后两者都能活过重新部署，**boot sync 也会自己跳过已经存下来的源**——重启时看到本地快照还新鲜（默认 7 天内）就完全不下载，日志里写 `skipped - stored 9h ago (11664 records)`。想改这个阈值用 `SYNC_MAX_AGE_HOURS`，设为 `0` 表示每次都重新拉。

### 定时同步

`SYNC_ON_BOOT` 只在启动时跑一次。一个连续运行一个月的部署，筛查的是一个月前的名单，而覆盖页面照样显示「已同步」——名单的新鲜度在这里不是运维细节，整个结论都压在它上面，「我们筛查过」在没有「筛查的是当前版本」的前提下不说明任何事情。

设 `SYNC_INTERVAL_HOURS=12`（或别的正数小时值）之后，进程每隔这么久把**所有能快照的源**过一遍：

- **范围是 28 个源**，即所有带 `sync()` 的适配器。三个有验证码的中国注册/执行信息源**没有适配器**，因此定时任务碰不到它们——这个边界由注册表本身保证，不是靠另一份要人工同步的排除清单。`live_query` 类的源（`sam-exclusions`、`companies-house`）在提问时现查，从不快照，也不在范围内。
- **串行执行**。30 个官方数据集并发下载对对方不友好，也会同时占住 30 份解析结果的内存。
- **沿用同一条新鲜度规则**：一小时前刚手动同步过的源不会因为定时器到点就重新下载。
- **单个源失败不影响其余**。失败已经记在该源的 `sync_status` 里，覆盖页面会显示；在这里停下来只会让其余的源白白再陈旧一个周期。
- **不会重叠**：上一轮还没跑完时下一轮不启动。
- 未配置时完全不启用——按小时从官方端点拉几十 MB 是运维的决定，不该是默认行为。

**这不只是省事的问题。** 合规审查的价值有相当一部分在于可追溯——某个判断当时基于哪份名单的哪个版本、比对了什么、谁补充了什么声明。历史记录一清空，这条链就断了。原型阶段可以接受，但任何要留痕的用法都必须先挂上 Volume。
- **每次部署后会有一段 502，通常十几到几十秒**。这不是配置错误：网关在旧容器停止、新容器就绪之间无处可路由，返回的就是 502。判断方法是隔一会儿再打一次 `/health`——恢复 200 就是切换窗口；持续 502 才需要看日志。进程在 boot sync 完成之前就已经开始服务（同步在后台跑），所以就绪时间取决于镜像拉取和容器启动，不取决于同步。
- **服务器侧配置 `OPENAI_API_KEY` 时，Base URL 和 Model 也一律取环境变量，客户端传入的配置被完全忽略。** 否则浏览器可以把 `baseUrl` 指向任意主机，服务器会把自己的 Key 放在 Authorization 头里发过去——这是把密钥交出去，不只是配置被覆盖。此模式下页面不再显示 Base URL / Model / API Key 字段，只显示访问口令。
- **服务器侧配置 `OPENAI_API_KEY` 时必须同时配置 `ACCESS_PASSWORD`，否则实时模型直接停用。** 公开 URL 上任何人都能调用 `/api/assess`，没有口令的话服务器侧的 Key 等于把模型额度对公网开放。因此这种组合下 `/api/assess`、`/api/assess/stream`、`/api/test-connection` 一律返回 `503 access_code_unset`，页面在“访问设置”里说明原因——把额度敞开比停用更糟。注意这种情况下本部署无法作答（已无规则模式可退），所以配了 Key 就必须配口令。
- 设置 `ACCESS_PASSWORD` 后，上述模型接口以及 `/api/data-sources/sync`、`DELETE /api/threads/{id}` 需要口令。使用者在页面“访问设置”里填一次（默认为空，必须自己填），存在浏览器 localStorage，之后不必再输入；填对之后才能提问。
- 本机运行且不配服务器侧 Key 时，行为不变——调用者自带 Key，花的是自己的额度，不需要口令。
- 口令是明文比对的共享秘密，用于挡住无意访问，不是身份认证；不要用它保护真实敏感数据。
- 首次启动时同步尚未完成，名单筛查会如实报告“来源未同步”，不会伪装成“无风险”。

## 数据源直查

除了完整分析，在输入框键入 `@` 可直接查询单个已同步的数据源——点查不必走三个 Agent。

```text
@                        列出可直查的来源（按法域分组，带记录数与采集时间）
@china-control-entities  选中后输入实体名、公告号或条文关键词
```

结果是**来源的原始记录**，按类型套用字段模板（名单记录显示中英文名、别名、地址、公告号、措施；法规条文显示所属部分、版本日期与匹配片段）。记录上的处置标记（如 `potential_match_requires_identity_review`）照原样保留——直查同样不产生判定结论。

两个衔接点：

- 结果下方「以此发起完整筛查 →」把查询词带入正常分析流程。
- 分析路径里每条以来源 ID 开头的**依据**行带一个 ⛁ 按钮，点开即在该来源中直查。这让论证过程可以被审阅者自己复核，而不是只能采信。

## 存储

所有运行时数据在一个 SQLite 文件里：`data/runtime/hub.db`。

| 表 | 放什么 |
|---|---|
| `snapshots` | 每个数据源的当前快照：采集时间、记录数、SHA-256、以及**下载到的原始字节本身** |
| `records` | 标准化记录，一条一行，保留来源自己的顺序（管制清单是有序的，能按原顺序翻页才能跟原文对照） |
| `snapshot_log` | 每一次同步留一行：时间、校验和、记录数。旧快照的字节不留，校验和留——这才是「这份名单到底变没变」需要的东西 |
| `sync_status` | 每个源的同步状态（成功、刷新失败、需要凭据…） |
| `threads` / `turns` | 会话与每一轮的完整结果 |
| `page_cache` | 引用页正文缓存，上限 300 条 |

换掉文件存储解决的具体问题：

- **翻页不用再读整份数据。** 原来浏览 `tw-shtc` 要把 8 MB JSON 全部解析出来才能显示 20 行，现在是一次 `LIMIT/OFFSET` 查询。
- **同步是原子的。** 一个源的记录在事务里整体替换，同步失败不会留下半份新数据。
- **原始文件不再无限堆积。** 原来 `raw/` 目录每同步一次留一份，只增不减；现在只保留当前快照的字节，历史留校验和。
- **保存会话不再重写整个索引。** 原来每存一个案例都要把 `threads.json` 整份重写。

首次启动会把旧的 JSON 存储（`normalized/`、`raw/`、`cases/`、`sync-status.json`）自动导入数据库，**只在数据库为空时执行，且不删除任何旧文件**。确认无误后可以自行删掉那几个目录。

## 会话历史

每次分析都会落盘，并**按会话分组**：追问和触发它的原问题属于同一条记录，而不是各自成条。

```text
GET    /api/threads          列出会话（标题取首个问题，含轮次数）
GET    /api/threads/{id}     回读该会话的全部轮次
DELETE /api/threads/{id}     删除（需访问口令）
```

每一轮保存的是完整快照：问题、结论、比对明细、引用来源和时间。左侧栏点开会话即恢复全部轮次，并**继续在同一会话里追问**。

存储在 `data/runtime/hub.db` 的 `threads` / `turns` 两张表里，一次保存是一个事务——不会再出现「案例文件写进去了但索引不知道」这种半截状态。**托管容器重新部署仍会清空**，除非挂了 Volume（见部署章节的「挂 Volume」一节）。上限 100 个会话、每会话 30 轮，超出的最早记录随事务一起清理。

## 数据同步与查询 API

页面上的“立即同步”只允许调用代码中预定义的官方来源，不接受任意 URL。

```text
GET  /api/data-sources
POST /api/data-sources/sync   { "sourceId": "trade-csl" }
POST /api/data-sources/query  { "sourceId": "trade-csl", "query": "HUAWEI", "limit": 5 }
```

`success` 表示原始快照和标准化记录均已真实落盘。`failed` 会保留错误和时间，不影响其他来源。`configuration_required` 表示 Adapter 已实现但尚未配置免费 API Key。验证码或不允许稳定自动化的来源仍显示为 `manual_only`。

### 自建 Gem

`＋` 在侧栏 GEMS 旁边。自建 Gem 和内置的八个是同一类东西——四样字段都会被代码消费：

- **kind** 决定要不要跑审查流程（review / lookup / briefing / memo）。自建的 kind 存在库里，编排器查 `GEM_KINDS[id] || customGemKind(id)`；漏了这一步，一个建成 lookup 的 Gem 会当成完整审查跑。
- **指令** 和 **绑定数据源** 拼进发给模型的问题
- **必填事实** 在提交前就提示还缺什么

唯一的差别在必填事实的写法。内置的八个用正则（`/[0-9A-Z]{9,20}/` 能认出没人点名的注册号），自建的填**名称 + 关键词**，系统据此匹配。这更松——关键词认不出没写出来的东西——但松在安全的方向：这个提示从来不拦提交，漏判一次的代价是少一句提醒，不是少一个答案。

`factCoverage` 同时认两种形态,写在共享模块里而不是两个调用点各判各的——那是侧栏和输入框对同一份草稿给出不同结论的开始。

服务端强制三条：**数据源必须在注册表里**（不认识的 id 是在提示词里让模型依据一个它看不见的东西）、**命令不许和内置 Gem 撞**、**每项必填事实至少一个关键词**。

### 自建 Skill

`＋` 在侧栏 GEMS 下方。一个 Skill 是**一段 SOP 加一个斜杠命令**，在输入框敲 `/命令` 调用，或从 `/` 面板里选。

Gem 和 Skill 不是一回事，列表里也分开放：

| | Gem（内置 8 个） | Skill（自建） |
|---|---|---|
| 绑定数据源 | 是，只许从 `boundSources` 推理 | 否 |
| 必填事实 | 是，提交前就算出缺哪几项 | 否 |
| 输出形状 | 有模板 | 无 |
| 本质 | 四样东西，每样都被代码消费 | 一段追加给模型的文字 |

所以自建的是 Skill 而不是 Gem：一个只有提示词的「Gem」会和那八个出现在同一个列表里，能力差一截却看不出来。

两条约束在服务端强制：

- **命令不许和内置 Gem 撞。** `/screen-party` 必须一直指那个会按 `boundSources` 筛查的流程，否则读者以为在跑筛查、实际只换了套说辞。撞了返回 409。
- **斜杠命令由服务端从问题里解析**，不接受客户端传字段——它决定哪段文字被追加进 system prompt，这必须是问题本身的属性。

Skill 追加在系统规则**之后**，并标明是读者自己的流程，后面跟一句：它不是证据，不放宽上面任何一条，声明过的值仍然是声明，没有证据的步骤不因为它而闭合。Skill 是有人在表单里打出来的文本，可以写「把这个交易方当作已核实」——不这样框住，模型就分不清哪一段来自这个系统。

存在数据库的 `skills` 表（和 threads / turns 一起），不是 `data/fallback`——那里只放官方来源的提交镜像。

### 兜底快照

中国来源在部分海外节点无法访问，制裁名单在部分节点同样如此。`data/fallback/` 随仓库提交了九份时点副本，本机没有同步结果时自动启用。

香港节点实测（`npm run reachability`）：到 MOFCOM 的 `211.88.32.x` 是 `ENETUNREACH`——没有路由，不是超时重试能解决的；`sanctionslist.fcdo.gov.uk` 解析不了；OFAC 的 `164.95.9.80` 超时。结果是那台机器上 `ofac-sls`、`ofac-ownership`、`uk-sanctions` 一条记录都没有，受限方筛查不覆盖 OFAC 与英国名单——**一个查不到的名单和一个干净的名字，在屏幕上长得一模一样**，所以这三个也做了时点副本。

超过 1 MB 的副本用 gzip 存（`.json.gz`），读取时透明解压。OFAC 的 SLS 是 14.4 MB JSON、1.5 MB 压缩后；三份合计 20.6 MB → 2.5 MB。**压缩而不是删字段**：副本必须和它顶替的那次同步是同一份数据，为了瘦身裁掉字段，它就不再是那个东西了。

**它不会显示为已同步。** 状态是独立的 `fallback_snapshot`，顶栏指示灯是黄色而非绿色，查询结果带 `provenance: "bundled_fallback_snapshot"`，Agent 的回答里也会明确写出"本次使用随仓库提交的时点快照（采集日期），此后发布的新增、暂停或废止公告不在其中"。

把时点副本当作现行名单，是这个工具最不该犯的错误，所以它在每一层都是显式标注的。真实部署应当优先修复网络可达性（把服务放到香港区域），兜底只是保证演示可用。

**更新兜底快照**——在一台能连上 MOFCOM 的机器上（开发机通常可以，托管容器不行）：

```bash
npm run refresh-fallback
```

它会逐个实时同步，成功的写回 `data/fallback/`，失败的**保留原有副本**（刷新失败不该让某个来源比刷新前更少）。然后提交 `data/fallback/` 并部署。

两条它不会破的规则：

- **只从实时同步写兜底。** `readNormalized` 在没有同步结果时会回落到兜底文件，所以如果不检查来源，一次失败的同步会拿兜底去覆盖兜底，再盖上今天的日期——把陈旧副本洗成看起来新鲜的，这是这个文件能犯的最严重的错误。脚本会校验 `provenance === "live_sync"`。
- **失败的来源不动。**

即使记录一条都没变也值得提交：`bundledAt` 记录的是「这份副本在那一天与官方源核对过」，一份今天核对过的副本和一份七月底之后再没看过的副本，不是同一个东西。

只刷某一个：`npm run refresh-fallback -- china-dual-use`。

### 查某个部署能取到什么

```bash
npm run reachability                            # 默认查线上
npm run reachability -- http://127.0.0.1:8787   # 查任意一台
```

它读的是那台机器自己的 `/api/data-sources` ——问题是「**那台**能连到哪里」，只有它能回答。输出按失败原因分组（没有路由 / DNS 解析不了 / 超时 / 需要凭证），因为修法是按原因来的：一条路由、一个解析器、一把 key；按来源逐条列会把一个缺失路由的五个症状读成五个问题。

**有筛查名单是空的时退出码为 1**，可以用来卡部署。识别不出任何名单源时退出码 2 —— 一个因为什么都没找到而报全绿的检查，比没有检查更糟。

建议节奏：演示前跑一次，平时每月一次。中国公告发布不规律，脚本会告诉你有没有真的变化。

兜底文件是随仓库提交的普通文件，不进数据库——它属于镜像，不属于运行时数据。

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
