# Compliance Hub Prototype 测试场景与验收矩阵

这份矩阵回答的是：“这个 Prototype 目前可以证明什么能力？”它不预设最终法律结论，而是验证系统是否把问题交给正确 Agent、提出必要事实、引用相关公开来源，并明确需要人工审查的部分。

## 统一通过标准

每个测试场景都应满足以下要求：

1. 路由到预期 Agent，跨域场景应同时触发多个 Agent。
2. 不因信息不足自动给出“可以交易”或“无需许可证”。
3. 输出至少包含：初步风险、主要发现、缺失信息、建议行动。
4. 结论能够追溯到公开来源；来源失败时明确标记失败。
5. 不把品牌名当成 legal entity，不把产品商品名当成最终 ECCN，也不把风险指标直接认定为违法或空壳公司。
6. 最终结果明确要求 Human Compliance / Legal review，而不是自动审批。

## 场景矩阵

| ID | 场景 | 预期 Agent | 要验证的能力 | 关键成功信号 |
|---|---|---|---|---|
| T01 | 华为体系内实体的技术支持、软件更新和技术访问 | Trade | 品牌与具体实体拆分；服务和技术范围分析 | 要求 legal entity、地址、服务内容、EAR jurisdiction，不笼统回答“服务都可以” |
| T02 | 未上名单客户被两家受限公司合计持有 55% | Trade + TPDD | OFAC 50% ownership aggregation；UBO 补件 | 识别间接/合计所有权问题，要求完整 cap table 和 UBO 证据 |
| T03 | 客户名称近似名单命中，但国家、地址和注册号不同 | Trade | False-positive resolution；身份要素比对 | 比较名称、别名、地址、注册号、出生日期等，不只做字符串命中 |
| P01 | H100 从美国经加拿大中转到墨西哥 | Product | 产品分类、路线、最终安装地和许可分析 | 要求准确 part number、ECCN、ultimate consignee、parent、end use |
| P02 | 含 VPN/强加密功能的美国网络设备出口印度 | Product | Encryption classification；许可例外和申报 | 区分硬件型号、加密功能、ECCN/ENC eligibility、最终用户类型 |
| P03 | 中国镓相关两用物项出口欧盟 | Product + Trade | 中国出口管制、技术参数、最终用户/用途 | 引导核查中国两用物项规则和许可证，不只应用美国规则 |
| D01 | 新顾问要求 15% 成功费并收款至 BVI | TPDD | 商业合理性、费用、付款路径、UBO | 要求 deliverables、fee benchmark、开户证明、UBO、合同与收款主体关系 |
| D02 | 新经销商使用共享办公、无员工信息且拒绝 UBO | TPDD | Shell-company indicators 与经营实质 | 把现象作为红旗而非直接定性；要求注册、办公、人员、银行和业务证明 |
| D03 | 顾问承诺赢得政府招标并要求付个人账户 | TPDD | PEP/反腐败、服务证明和费用合理性 | 识别政府关系、个人账户和成功费风险；要求持续监控与履约证据 |
| X01 | H100 经墨西哥经销商最终供给中国客户 | Trade + Product + TPDD | 最终用户、产品许可、转运规避与经销商尽调协同 | 三类 Agent 同时响应；Master 合并而不是重复三份互不相关结论 |
| X02 | 被拒订单改由新加坡货代收货、无关第三方付款 | Trade + Product + TPDD | Circumvention pattern、路线变更、付款异常 | 识别“拒绝后改路由”的组合风险，建议暂停而不是按新单重新开始 |
| X03 | 新供应商设备含美国加密芯片和中国两用部件，并要求付关联账户 | Trade + Product + TPDD | BOM、Vendor 和 Transaction 信息整合 | 同时要求 BOM/classification、主体筛查、账户关系与供应商 UBO |

## 能力覆盖视图

| 能力 | 对应场景 |
|---|---|
| Restricted-party / Entity List / sanctions triage | T01、T03、X01、X02 |
| Ownership / UBO / OFAC 50% Rule | T02、D01、D02、X03 |
| ECCN、产品参数和许可证信息缺口 | P01、P02、P03、X01、X03 |
| Transit、re-export、diversion、最终用户/用途 | P01、P03、X01、X02 |
| Shell indicators、商业合理性、异常费用和付款 | D01、D02、D03、X02、X03 |
| 三 Agent 协同和 Master consolidation | X01、X02、X03 |
| 中英双语、Dark/Light、来源可追溯 | 全部场景 |

## 当前 Prototype 明确不证明的能力

- 不证明已完成生产级 exact-name / fuzzy matching；目前是研究和路由原型。
- 不证明产品一定属于某个 ECCN，或一定需要/不需要许可证。
- 不证明某家公司是 shell company、受制裁方或存在违法行为。
- 不执行交易批准、拒绝或许可证申请。
- 不包含付费数据库中的 UBO、PEP、企业注册、负面新闻或持续监控数据。

## 建议演示顺序

1. T03：展示系统不会把近似名称直接判成命中。
2. P02：展示不仅支持芯片，也支持加密产品分类问题。
3. D02：展示 TPDD 不会把红旗直接等同于空壳公司。
4. X02：展示三个 Agent 如何处理同一笔交易的规避组合风险。
5. 切换英文和 Light 模式，重复 X01，验证语言与界面能力。
