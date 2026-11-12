# 阶段 1:止血与正确性(Correctness)

| 元信息 | 值 |
|---|---|
| 优先级 | P0 |
| 分类 | **后续执行** —— 6 个遗留缺陷(`B1`~`B6`)。`B1` 建议单独向上游提 PR,详见 [接管档案](./00-takeover.md#42-向上游提交-pr-的建议) |
| 工期 | 2 周 |
| 目标版本 | **patch**(如 `0.9.4`) |
| 前置条件 | [阶段 0](./01-phase0-safety-net.md) 已完成 |
| 并行性 | 可与阶段 2 并行,但建议串行或严格分文件提交 |

## 一、目标

**修掉当前会产出错误结果、崩溃或泄露信息的缺陷,而不改变任何正常的 SVG 输出。**

本阶段最重要的约束:

> **范围外:不改变任何 SVG 输出的字节内容。**
>
> 阶段 0 建立的快照基线是本阶段的门禁 —— 修复完成后,8 种主题 × 动画/静态 = 16 份快照必须**全部原样通过**。任何快照变化都说明修复引入了不该有的行为变化,必须阻断。

唯一的例外是 B1:修复「静默产出空白图」必然改变非法配置的输出(从空白图变为报错退出),这正是修复目的。

## 二、缺陷清单与修复对照

每条修复按「失败现象 → 根因 → 修复后行为」三段式描述。

### B1 设置 JSON 零校验,静默产出空白图

**失败现象**:用户 settings 中 `"type": "norml"`(拼写错误),Action 运行成功、退出码 0,生成的全透明 SVG,用户界面完全空白,无任何提示。

**根因**:`src/settings-reader.ts:9` 的 `return JSON.parse(content) as type.Settings;` 是纯类型断言,编译期类型在运行时不存在。非法 `type` 导致 `create-svg.ts:27`/`:30`、`create-3d-contrib.ts:253-261`/`:283-291`/`:329-337`、`create-css-colors.ts:42`/`:55`/`:107`/`:134` 全部判定不命中,于是既不生成柱子的 `class`,也不生成对应 CSS 规则。

**修复后行为**:加载时即校验,发现未知 `type` 时以退出码 1 终止,输出带行号与可选值列表的错误,例如:

```
[ERROR] E_SETTINGS_INVALID: settings.json 第 3 行: "type" 的值 "norml" 无效。
  期望以下之一: normal | season | rainbow | bitmap | pie_lang_only | radar_contrib_only
```

### B2 空日历导致启动即崩

**失败现象**:`YEAR=2024` 指向无数据年份时抛出
`TypeError: Cannot read properties of undefined (reading 'date')`,堆栈指向 `create-svg.ts:217`。

**根因**:`create-3d-contrib.ts:176` 有空数组守卫,但 `create-svg.ts:217` 与 `:219` 无条件访问 `contributionCalendar[0]` 与 `[length - 1]`。`create3DContrib` 安全返回后,编排层继续执行到崩溃点。

**修复后行为**:在 `createSvg` 入口做 fail-fast,输出:

```
[ERROR] E_YEAR_EMPTY: 用户 octocat 在 2024 年没有贡献数据,无法生成日历。
  建议:省略 YEAR 以使用当前年份,或确认该年份是否已被 GitHub 数据保留策略清除。
```

### B3 `MAX_REPOS` 语义失效

**失败现象**:`MAX_REPOS=10` 且用户有 30 个仓库时,生成的 star / fork 数字仍包含全部 30 个仓库;同时语言饼图的数据与 `MAX_REPOS` 无关。

**根因**:两处独立问题。

1. `github-graphql.ts:193` 的 `if (result && result.user.repositories.nodes.length === maxReposOneQuery)` 只把 `maxRepos` 当作**分页停止阈值**;首页返回的 100 个节点(`:198` 的 `push`)从未被截断。
2. `github-graphql.ts:110` 的 `commitContributionsByRepository(maxRepositories: 100)` 是硬编码字面量,与 `maxRepos` 无关。

**修复后行为**:`maxRepos` 成为真正的仓库数上限,对 `repositories` 与 `commitContributionsByRepository` 同时生效。

**用户影响(必须在 CHANGELOG 说明)**:此前 star / fork 数字**虚高**。修正后,设置 `MAX_REPOS` 的用户其数字会变小。这是修正而非退化,不得表述为「功能变更」。

### B4 `fileName` 路径穿越

**失败现象**:settings 中 `"fileName": "../../.github/workflows/pwn.yml"` 可将内容写出 `./profile-3d-contrib` 之外。

**根因**:`src/file-writer.ts:7` 的 `writeFileSync(\`${OUTPUT_FOLDER}/${fileName}\`, content)` 直接拼接,`fileName` 未做任何校验。

**修复后行为**:`path.basename` 归一化 + 正则白名单校验,非法时抛
`E_FILENAME_INVALID` 并列出合法示例。合法文件名不再因路径分隔符被拒绝,但会被归一化到 `basename`。

### B5 错误日志泄露私有信息

**失败现象**:GraphQL 返回 `data: null` 且无 `errors` 时,`aggregate-user-info.ts:38` 抛出
`JSON\n{...}` 完整响应。私有仓库名不是 secret,Actions 日志脱敏不遮蔽它,而 profile 仓库日志默认公开。

**根因**:兜底分支用 `JSON.stringify(response, null, 2)` 倾倒整个响应对象。

**修复后行为**:只输出结构化摘要,不含任何仓库名:

```
[ERROR] E_GITHQL_NO_DATA: GitHub API 返回空 data 且无 errors 字段。
  响应类型: ContributionCalendar(可能为权限受限或查询字段已变更)
  建议:确认 GITHUB_TOKEN 权限,或设置 GITHUB_API_VERSION 头。
```

### B6 其他缺陷

| 编号 | 位置 | 现象 | 修复 |
|---|---|---|---|
| B6-a | `create-svg.ts:147-148` | 连续两次 `.attr('text-anchor', 'start')` | 删其一 |
| B6-b | `file-writer.ts:6` | `mkdirSync` 一次运行调用 10 次 | 移入模块级惰性单次初始化 |
| B6-c | `index.ts:23-36` | `MAX_REPOS=-1`、`YEAR=3000` 通过校验 | 范围校验(见下) |
| B6-d | `package.json` `clean` | 只清 `dist/*`,`dist0` 残留被 ncc 打包 | 补 `dist0` |
| B6-e | `index.ts:118` | `void main()` 使模块无法被安全 import | 改为 `if (require.main === module)` |

## 三、文件级改动清单

| 文件路径 | 动作 | 改动说明 | 涉及符号 / 函数 |
|---|---|---|---|
| `src/errors.ts` | NEW | 结构化错误码体系(枚举 + 构造函数 + 退出码映射) | `AppError`、`ErrorCode` |
| `src/settings-validator.ts` | NEW | **零依赖**设置校验器,输出行号级错误;本阶段仅告警不阻断 | `validateSettings`、`ValidationIssue` |
| `schema/settings.schema.json` | NEW | JSON Schema,供编辑器补全与后续阶段 3 复用;本阶段不用于运行时校验 | — |
| `src/settings-reader.ts` | MODIFY | 接入校验器;保留 `readSettingJson` 签名,新增可选 `validate` 参数 | `readSettingJson` |
| `src/create-svg.ts` | MODIFY | 入口空日历守卫(B2);删重复属性(B6-a) | `createSvg` |
| `src/index.ts` | MODIFY | 数值范围校验(B6-c);`require.main` 守卫(B6-e);错误统一走 `AppError` | `main` |
| `src/github-graphql.ts` | MODIFY | `maxRepos` 真正截断(B3);`errors` 类型改 `Array`(A5);`commitContributionsByRepository` 接入 `maxRepos`;`URL` 改由参数传入但**保留默认导出以兼容** | `fetchFirst`、`fetchNext`、`fetchData`、`ResponseType`、`ResponseNextType` |
| `src/aggregate-user-info.ts` | MODIFY | 移除整体 dump(B5);`errors` 多条时聚合消息 | `aggregateUserInfo` |
| `src/file-writer.ts` | MODIFY | `path.basename` + 白名单(B4);`mkdirSync` 单次化(B6-b) | `writeFile`、`OUTPUT_FOLDER` |
| `package.json` | MODIFY | `clean` 补 `dist0`(B6-d) | `scripts.clean` |
| `spec/settings-validator.spec.ts` | NEW | 校验器单测:合法单条/多条、非法 `type`、缺必填、`darkMode` 递归类型 | — |
| `spec/github-graphql.spec.ts` | MODIFY | 补 `maxRepos` 截断用例、`errors` 多条用例 | `fetchData` |
| `CHANGELOG.md` | MODIFY | `[Unreleased]` 增加本阶段条目,**必须包含 `MAX_REPOS` 行为变更说明** | — |

> **明确不改动**:`type.ts`(类型定义不变,避免连带影响快照)、`create-3d-contrib.ts`、`create-css-colors.ts`、`create-pie-language.ts`、`create-radar-contrib.ts`、`color-template.ts`、`utils.ts`、`action.yml`、`src/settings/*.json`。

## 四、关键代码骨架

> 以下为计划内容,尚未实现。

### 4.1 错误码体系

```typescript
// src/errors.ts(计划内容)
export const ErrorCode = {
    TOKEN_MISSING: 'E_TOKEN_MISSING',
    USERNAME_MISSING: 'E_USERNAME_MISSING',
    MAX_REPOS_INVALID: 'E_MAX_REPOS_INVALID',
    YEAR_INVALID: 'E_YEAR_INVALID',
    YEAR_EMPTY: 'E_YEAR_EMPTY',
    SETTINGS_INVALID: 'E_SETTINGS_INVALID',
    FILENAME_INVALID: 'E_FILENAME_INVALID',
    GITHUB_NO_DATA: 'E_GITHUB_NO_DATA',
    GITHUB_AUTH: 'E_GITHUB_AUTH',
    GITHUB_RATE_LIMIT: 'E_GITHUB_RATE_LIMIT',
    GITHUB_NETWORK: 'E_GITHUB_NETWORK',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** 退出码约定:1 = 配置/输入错误,2 = 远端 API 错误。供 CI 与用户脚本判别。 */
export class AppError extends Error {
    constructor(
        readonly code: ErrorCode,
        message: string,
        readonly hints: ReadonlyArray<string> = [],
    ) {
        super(`[${code}] ${message}`);
        this.name = 'AppError';
    }
    get exitCode(): number {
        return EXIT_CODE_BY_ERROR[this.code] ?? 1;
    }
}
```

### 4.1.1 实现偏差:校验器也承担「不可渲染」拦截

原计划把校验器定为「仅告警不阻断」,只有未知 `type` 例外。实际实现多了两类**阻塞性**错误,
原因是它们不是画得丑,而是**画不出来**:

| 条件 | 计划行为 | 实际行为 | 依据 |
|---|---|---|---|
| `contribPatterns[i]` 缺 `top` 面板 | warning | **error** | `create-3d-contrib.ts` 每周读 `contribPatterns[level].top.width`,缺失即 `TypeError` 崩溃 |
| `contribPatterns[i].top.backgroundColor` / `foregroundColor` 缺失或非字符串 | 未检查 | **error** | `create-css-colors.ts` 对这两个值调 `d3.rgb()`,缺失时 `undefined` 直接抛错(左侧/右侧面板本就由 top 派生,故只校验 top) |

同时补充两点非阻塞行为:

- 渲染层与 `writeFile` 做兜底:面板缺失、宽度缺失、颜色非字符串时降级绘制而不是抛异常,
  保证「校验器漏了」也不会让整张图报废。
- `fileName` 保持 `E_FILENAME_INVALID` 的**硬失败**(路径穿越不能被回落吞掉),
  但 `settings-reader` 会在渲染前先 `WARNING` 告警,`index.ts` 在写入时回落到
  `profile-customize.svg`。安全边界不变,存量配置不再从一个警告变成一次失败。

另:未知 `type` 报错后仍会用 `normal` 的字段集把余下字段复查一遍,只保留 warning,
避免一个 `type` 拼写把「bitmap 缺 top」这类阻塞问题挡住。

与上一条一并说明:计划里「其它设置问题只发 warning」这句话,现在应理解为
「**不会导致渲染失败的**其它问题只发 warning」。

### 4.2 设置校验器(零依赖)

```typescript
// src/settings-validator.ts(计划内容)
export interface ValidationIssue {
    /** JSON 路径,如 "$.darkMode.type";无法定位时为 "$" */
    path: string;
    /** 1-based 行号,无法定位时为 undefined */
    line?: number;
    message: string;
    expected?: ReadonlyArray<string>;
}

export const validateSettings = (
    file: unknown,
): ReadonlyArray<ValidationIssue> => { /* ... */ };
```

设计要点:

- **零依赖**是硬约束。项目在 `0.9.2` 因 `undici` 漏洞移除了 `@actions/github` 与 `@actions/core`,若本阶段引入 `ajv` 会违背该既定安全策略。`ajv` 仅作为阶段 3 的可选评估项。
- 行号定位:顶层与 `darkMode` 的字段通过扫描原始文本中 `"key"` 的出现位置估算;`contribPatterns` 这类深层数组**不**逐元素报行号,只报索引路径,避免实现复杂度与收益失衡。
- 校验分层:**结构**(是对象还是数组)→ **必填字段** → **`type` 枚举** → **类型专属字段**(如 `rainbow` 必须有 `saturation` / `contribLightness` / `duration` / `hueRatio`)→ **`darkMode` 递归**(其 `type` 必须与父级一致,这是 `0.9.0` 引入 `darkMode` 时的隐含约束,当前完全未校验)。
- 本阶段:输出一段 `::warning::` 风格的提示后**继续执行**,保证不破坏存量配置。阶段 3 转为阻断式。

### 4.3 `maxRepos` 真正截断

```typescript
// src/github-graphql.ts(计划内容,节选)
const commitContributionsByRepository = `commitContributionsByRepository(
    maxRepositories: ${Math.min(maxRepos, maxReposOneQuery)})`;

// fetchFirst 之后立即截断首页结果
if (result) {
    result.user.repositories.nodes = result.user.repositories.nodes.slice(0, maxRepos);
    result.user.repositories.edges = result.user.repositories.edges.slice(0, maxRepos);
}
```

分页循环的终止条件同步调整:当前实现是 `if (result && result.user.repositories.nodes.length === maxReposOneQuery)`,截断后 `nodes.length` 已变为 `maxRepos`,**必须改为在截断前保存原始长度**,否则当 `maxRepos < 100` 时会错误地跳过多余分页,而当 `maxRepos > 100` 时会漏掉必要的分页。这是一个易错点,实现时须用「原始首页长度」变量固定判定基准。

> **实现偏差(已合并):** 实际代码把截断放在分页循环**之后**,因此上述顺序陷阱不会发生 —
> 循环终止条件读到的仍是首页原始长度。上方的「首页即截断」写法未采用。
> 另外 `commitContributionsByRepository` 用的是 `Math.max(1, maxRepos)` 后的值,
> 而非原文的 `Math.min(maxRepos, maxReposOneQuery)`;`MAX_REPOS < 1` 已在 `index.ts` 被拒,
> 故两者等价,但计划文档的字面内容与代码不一致,此处以代码为准。

## 五、commit 切分

一缺陷一 commit,便于逐条 Review 与 `git bisect` 定位。

| # | commit message | 内容 | 快照门禁 |
|---|---|---|---|
| 1 | `feat: add structured error code system` | 新增 `src/errors.ts`,`index.ts` 接入 | 不涉及 |
| 2 | `fix: fail fast on empty contribution calendar` | B2 | 必须全绿 |
| 3 | `fix: enforce maxRepos as a real repository cap` | B3 | 必须全绿(**预期 star/fork 数字变化,但 SVG 结构不变**) |
| 4 | `fix: correct errors tuple type to array` | A5 类型修正 | 必须全绿 |
| 5 | `fix: stop dumping raw GraphQL response in errors` | B5 | 必须全绿 |
| 6 | `fix: sanitize output file names against path traversal` | B4 | 必须全绿 |
| 7 | `refactor: dedupe mkdirSync and remove duplicate attribute` | B6-a、B6-b | 必须全绿 |
| 8 | `refactor: validate env numeric ranges and guard main entry` | B6-c、B6-e | 不涉及 |
| 9 | `fix: clean dist0 directory in clean script` | B6-d | 不涉及 |
| 10 | `feat: add zero-dependency settings validator` | 新增校验器 + 单测 | 必须全绿 |
| 11 | `docs: publish JSON schema and warning-mode integration` | `schema/settings.schema.json` + `settings-reader` 接入告警 | 必须全绿 |
| 12 | `docs: update changelog for maxRepos behavior change` | `CHANGELOG.md` | 不涉及 |

> commit 3 的快照判定需要人工确认:仓库统计数字变化**不应**引起快照失败(快照基于 `spec/dummy-data.ts` 的固定输入,而 `maxRepos` 修正只影响**截断逻辑**,不改变给定数据下的渲染结果)。若快照失败,说明截断实现有误。

## 六、测试策略

| 目标 | 用例要点 |
|---|---|
| 校验器 | 合法单条 / 合法多条 / 未知 `type` / 缺 `backgroundColor` / `rainbow` 缺 `hueRatio` / `bitmap` 的 `contribPatterns` 长度不足 5 / `darkMode.type` 与父不一致 / 顶层是数组但含 `null` 元素 |
| `maxRepos` 截断 | `maxRepos < 100` 时首页被截断且不再分页 / `maxRepos > 100` 时分页到 `maxRepos` 恰好停止 / `maxRepos` 恰好等于 100 时不触发分页 / 用户仓库数少于 `maxRepos` 时正常结束 |
| `errors` 类型 | GraphQL 返回 2 条以上 `errors` 时聚合为单条 `AppError` 且消息包含全部 `message` |
| B5 脱敏 | 响应中含私有仓库名时,抛出的错误消息**不含**该名称(用 `expect(...).not.toContain('private-repo-name')` 断言) |
| B4 路径穿越 | `fileName` 为 `../evil.svg`、`/abs/evil.svg`、`a/b.svg` 时抛 `E_FILENAME_INVALID` 或被归一化;合法名正常写出 |
| B2 空日历 | `contributionCalendar` 为 `[]` 时抛 `E_YEAR_EMPTY` 且消息含用户名与年份 |
| 回归 | 阶段 0 的 16 份快照全绿 |

## 七、验收标准

- [ ] 16 份快照全部原样通过(SVG 字节未变)
- [ ] `"type": "norml"` 的 settings 在 1 秒内以退出码 1 终止,错误含行号与可选值
- [ ] 合法 settings(含 `darkMode`)不产生任何告警噪声
- [ ] `YEAR=2024`(无数据)以 `E_YEAR_EMPTY` 终止,不再抛 `TypeError`
- [ ] `MAX_REPOS=10` + 30 仓库的 mock 场景下,统计节点数为 10
- [ ] `MAX_REPOS=-1` 与 `YEAR=3000` 被拒绝并给出合法区间
- [ ] `fileName: "../../evil.svg"` 无法写出目录外
- [ ] 错误消息经断言不含任何仓库名
- [ ] `errors` 含多条时全部 message 均出现在最终错误中
- [ ] `npm run clean` 后 `dist0/` 不存在
- [ ] `CHANGELOG.md` 明确说明 `MAX_REPOS` 行为变更及数字变小的事实
- [ ] 渲染层测试覆盖率 ≥ 60%

## 八、回滚方案

本阶段为 patch 版本,回滚粒度按 commit 划分:

| 情况 | 回滚操作 |
|---|---|
| 校验器误报导致用户无法使用 | 单独 revert commit 11(告警接入),保留 commit 10 的校验器本体 |
| `maxRepos` 修正引发用户不满 | 单独 revert commit 3,并在 CHANGELOG 说明回退原因 |
| 错误码体系需回退 | revert commit 1,并连带 revert 所有使用 `AppError` 的 commit(8 个) |

**不可单独回滚的 commit**:commit 1(错误码体系)是后续多个 commit 的依赖前提,回滚它必须连带回滚 2、5、6、8。

**关键提示**:因本阶段不改变 SVG 输出,任何回滚都**不会**导致用户图片重绘。

## 九、风险

| 风险 | 等级 | 缓解 |
|---|---|---|
| `maxRepos` 截断实现引入分页逻辑错误 | 中 | commit 3 单独 Review;针对 `maxRepos < 100` / `> 100` / `== 100` 三种边界各写一例 |
| 校验器对存量用户配置误报 | 中 | 本阶段**仅告警不阻断**;收集一个 minor 版本的反馈后再转阻断 |
| 行号定位实现过复杂 | 低 | `contribPatterns` 等深层结构只报 JSON 路径不报行号;行号仅用于顶层与 `darkMode` 字段 |
| 错误脱敏导致排查困难 | 低 | 保留 `errors[].type` 与 `path`(GraphQL 错误路径),这些不含仓库名但足以定位 |
| 与阶段 2 并行导致 `create-svg.ts` 冲突 | 低 | 两者都改 `create-svg.ts`,建议阶段 1 完成后才启动阶段 2,或严格分文件提交 |

## 十、出口条件

- [ ] 全部 12 个 commit 合入,patch 版本发布
- [ ] `docs/roadmap/01` 与 `02` 的验收清单全部勾选
- [ ] CHANGELOG 已发布,含 `MAX_REPOS` 行为变更说明
- [ ] 渲染层快照基线保持全绿,证明本阶段未改变输出
