# 附录:目标架构蓝图(Technical Contract)

> **本附录是跨阶段共享的技术契约。** [阶段 2](./03-phase2-architecture.md)、[阶段 3](./04-phase3-config-api.md)、[阶段 4](./05-phase4-perf-ux.md) 的接口定义**均以本附录为准**,三者不允许各自另立定义,以免接口漂移。
>
> **全部内容为计划内容,尚未实现。** 当前实现以 `src/` 为准。

## 一、目标目录树

```
/workspace/
├── action.yml                    [MODIFY 阶段 3]  新增 inputs
├── package.json                  [MODIFY 阶段 0/1/3/4]
├── tsconfig.json                 [不改]
├── tsconfig.spec.json            [NEW 阶段 0]  spec 类型检查
├── schema/
│   └── settings.schema.json      [NEW 阶段 1]  设置 JSON Schema
├── scripts/
│   └── perf-baseline.ts          [NEW 阶段 2]  性能基线
├── src/
│   ├── index.ts                  [MODIFY 阶段 0/1/3]  编排入口
│   ├── cli/
│   │   └── index.ts              [NEW 阶段 3]  parseArgs + 帮助
│   ├── config/
│   │   ├── config.ts             [NEW 阶段 3]  resolveConfig
│   │   └── validate-config.ts    [NEW 阶段 3]  范围校验
│   ├── errors.ts                 [NEW 阶段 1]  错误码体系
│   ├── github/
│   │   ├── client.ts             [NEW 阶段 3]  GitHubClient
│   │   ├── documents.ts          [NEW 阶段 3]  GraphQL 文档常量
│   │   ├── errors.ts             [NEW 阶段 3]  ApiErrorKind
│   │   └── retry.ts              [NEW 阶段 3]  退避 + 抖动
│   ├── l10n/
│   │   └── index.ts              [NEW 阶段 4]  11 种语言包
│   ├── pipeline/
│   │   └── index.ts              [NEW 阶段 2]  renderSvg 编排
│   ├── renderers/
│   │   ├── index.ts              [NEW 阶段 2]  自注册副作用入口
│   │   ├── types.ts              [NEW 阶段 2]  Renderer / RenderContext
│   │   ├── registry.ts           [NEW 阶段 2]  注册表
│   │   ├── layout.ts             [NEW 阶段 2]  LayoutEngine + LayoutOptions
│   │   ├── dom.ts                [NEW 阶段 2]  DOM 容器
│   │   ├── shared.ts             [NEW 阶段 2]  d3 出口 + wrapDarkMode
│   │   ├── full-canvas.ts        [NEW 阶段 2]  组合画布
│   │   ├── footer.ts             [NEW 阶段 2]  统计数字
│   │   ├── normal.ts             [NEW 阶段 2]
│   │   ├── season.ts             [NEW 阶段 2]
│   │   ├── rainbow.ts            [NEW 阶段 2]
│   │   ├── bitmap.ts             [NEW 阶段 2]
│   │   ├── pie-lang.ts           [NEW 阶段 2]
│   │   └── radar.ts              [NEW 阶段 2]
│   ├── settings/                 [不改]  8 个内置主题 JSON
│   ├── type.ts                   [MODIFY 阶段 4]  统一 L10nLabels
│   ├── aggregate-user-info.ts    [MODIFY 阶段 1]
│   ├── color-template.ts         [不改]
│   ├── settings-reader.ts        [MODIFY 阶段 1]
│   ├── settings-validator.ts     [NEW 阶段 1]  零依赖校验器
│   ├── file-writer.ts            [MODIFY 阶段 1/4]  幂等写
│   ├── github-graphql.ts         [DELETE 阶段 3]
│   ├── create-svg.ts             [DELETE 阶段 2]
│   ├── create-3d-contrib.ts      [DELETE 阶段 2]
│   ├── create-css-colors.ts      [DELETE 阶段 2]
│   ├── create-pie-language.ts    [DELETE 阶段 2]
│   └── create-radar-contrib.ts   [DELETE 阶段 2]
└── spec/
    ├── layout.spec.ts            [NEW 阶段 2]
    ├── config.spec.ts            [NEW 阶段 3]
    ├── render-output.spec.ts     [NEW 阶段 0]  快照基线
    ├── normalize-svg.ts          [NEW 阶段 4]  快照归一化
    ├── renderers/                [NEW 阶段 2/4]
    ├── github/                   [NEW 阶段 3]
    └── __snapshots__/            [NEW 阶段 0]
```

净变化:`src/` 从 13 个 `.ts` 变为 26 个(新增 22、删除 5、修改 6),但**总行数预计下降** —— 删除的 5 个文件(1082 行)中有大量重复的三段式 switch。

## 二、核心接口签名

### 2.1 Renderer 契约(阶段 2)

```typescript
// src/renderers/types.ts
import type * as d3 from 'd3-selection';
import type * as type from '../type';
import type { LayoutModel } from './layout';

export type SvgRoot = d3.Selection<SVGSVGElement, unknown, null, unknown>;

export interface RenderContext<T extends type.Settings = type.Settings> {
    readonly svg: SvgRoot;
    readonly userInfo: type.UserInfo;
    readonly settings: T;
    readonly layout: LayoutModel | null;
    readonly forceAnimation: boolean;
}

export interface Renderer<T extends type.Settings = type.Settings> {
    readonly type: T['type'];
    readonly canvas: { width: number; height: number };
    readonly needsLayout: boolean;
    css(settings: T): string;
    defs?(ctx: RenderContext<T>): void;
    draw(ctx: RenderContext<T>): void;
}
```

### 2.2 LayoutModel(阶段 2)

```typescript
// src/renderers/layout.ts
export interface LayoutCell {
    readonly date: Date;
    readonly level: number;
    readonly contributionCount: number;
    readonly week: number;
    readonly dayOfWeek: number;
    readonly baseX: number;
    readonly baseY: number;
    readonly height: number;
    readonly seasonPattern: number;
}

export interface LayoutGeometry {
    readonly width: number;
    readonly height: number;
    readonly dx: number;
    readonly dy: number;
    readonly dxx: number;
    readonly dyy: number;
    readonly offsetX: number;
    readonly offsetY: number;
    readonly weekcount: number;
    readonly angle: number;
}

export interface LayoutModel {
    readonly cells: ReadonlyArray<LayoutCell>;
    readonly geometry: LayoutGeometry;
}

export interface LayoutOptions {
    readonly angle: number;
    readonly columnDivisor: number;
    readonly leftPadding: number;
    readonly bottomPadding: number;
    readonly barLogDivisor: number;
    readonly barHeightScale: number;
    readonly barHeightMinimum: number;
}

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions;

export const createLayoutEngine: (options?: LayoutOptions) => {
    layout(userInfo: type.UserInfo, width: number, height: number): LayoutModel | null;
};

export const atan: (value: number) => number;
```

**强约束**:`layout()` 必须是纯函数 —— 相同输入产出完全相同的 `LayoutModel`(含全部浮点位)。禁止读取当前时间、随机数或可变全局。

### 2.3 注册表(阶段 2)

```typescript
// src/renderers/registry.ts
export const registerRenderer: (renderer: Renderer) => void;
export const getRenderer: <T extends type.Settings>(settings: T) => Renderer<T>;
```

### 2.4 配置(阶段 3)

```typescript
// src/config/config.ts
export type ConfigKey =
    | 'token' | 'username' | 'endpoint' | 'apiVersion'
    | 'maxRepos' | 'year' | 'settingsFile' | 'outDir'
    | 'themes' | 'dryRun';

export type ConfigSource = 'cli' | 'input' | 'env' | 'default';

export interface ResolvedConfig {
    readonly token: string;
    readonly username: string;
    readonly endpoint: string;
    readonly apiVersion: string;
    readonly maxRepos: number;
    readonly year: number | null;
    readonly settingsFile: string | null;
    readonly outDir: string;
    readonly themes: ReadonlyArray<string>;
    readonly dryRun: boolean;
    readonly sources: Readonly<Record<ConfigKey, ConfigSource>>;
}

export const resolveConfig: (argv: ReadonlyArray<string>) => ResolvedConfig;
```

### 2.5 API 客户端(阶段 3)

```typescript
// src/github/errors.ts
export type ApiErrorKind =
    | 'AUTH' | 'RATE_LIMIT' | 'NOT_FOUND'
    | 'GRAPHQL' | 'SCHEMA_DRIFT' | 'NETWORK';

export interface ApiErrorDetail {
    readonly kind: ApiErrorKind;
    readonly message: string;
    readonly paths: ReadonlyArray<string>;
    readonly resetAt?: Date;
    readonly status?: number;
    readonly retryable: boolean;
}

// src/github/client.ts
export interface GitHubClientOptions {
    readonly token: string;
    readonly endpoint: string;
    readonly apiVersion: string;
    readonly maxRetries?: number;
    readonly timeoutMs?: number;
    readonly fetchImpl?: typeof fetch;
}

export interface RateLimitInfo {
    readonly limit: number;
    readonly remaining: number;
    readonly cost: number;
    readonly resetAt: Date;
}

export class GitHubClient {
    constructor(options: GitHubClientOptions);
    queryRateLimit(): Promise<RateLimitInfo>;
    query<T>(document: string, variables?: Record<string, unknown>): Promise<T>;
    paginate<T>(
        extract: (data: T) => { nodes: T[]; cursor: string | null; hasNextPage: boolean },
        variables?: Record<string, unknown>,
    ): AsyncGenerator<T[], void, undefined>;
    fetchContributionData(args: {
        userName: string; maxRepos: number; year: number | null;
    }): Promise<ContributionData>;
}
```

### 2.6 错误码(阶段 1)

```typescript
// src/errors.ts
export const ErrorCode = {
    TOKEN_MISSING: 'E_TOKEN_MISSING',
    USERNAME_MISSING: 'E_USERNAME_MISSING',
    MAX_REPOS_INVALID: 'E_MAX_REPOS_INVALID',
    YEAR_INVALID: 'E_YEAR_INVALID',
    YEAR_EMPTY: 'E_YEAR_EMPTY',
    SETTINGS_INVALID: 'E_SETTINGS_INVALID',
    FILENAME_INVALID: 'E_FILENAME_INVALID',
    CONFIG_CONFLICT: 'E_CONFIG_CONFLICT',
    DUPLICATE_RENDERER: 'E_DUPLICATE_RENDERER',
    GITHUB_NO_DATA: 'E_GITHUB_NO_DATA',
    GITHUB_AUTH: 'E_GITHUB_AUTH',
    GITHUB_RATE_LIMIT: 'E_GITHUB_RATE_LIMIT',
    GITHUB_NOT_FOUND: 'E_GITHUB_NOT_FOUND',
    GITHUB_GRAPHQL: 'E_GITHUB_GRAPHQL',
    GITHUB_SCHEMA_DRIFT: 'E_GITHUB_SCHEMA_DRIFT',
    GITHUB_NETWORK: 'E_GITHUB_NETWORK',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
    constructor(
        readonly code: ErrorCode,
        message: string,
        readonly hints?: ReadonlyArray<string>,
    );
    readonly exitCode: number;
}
```

### 2.7 设置校验(阶段 1)

```typescript
// src/settings-validator.ts
export interface ValidationIssue {
    /** JSON 路径,如 "$.darkMode.type" */
    readonly path: string;
    /** 1-based 行号;无法定位时为 undefined */
    readonly line?: number;
    readonly message: string;
    readonly expected?: ReadonlyArray<string>;
}

export const validateSettings: (file: unknown) => ReadonlyArray<ValidationIssue>;
```

### 2.8 l10n(阶段 4)

```typescript
// src/type.ts
export interface L10nLabels {
    readonly commit: string;
    readonly issue: string;
    readonly pullreq: string;
    readonly review: string;
    readonly repo: string;
    readonly contrib: string;
    readonly other: string;
    readonly period: string;
}

export const DEFAULT_L10N: L10nLabels;
// 所有字段在 Settings.l10n 中必须保持「可选」,以兼容存量配置
```

### 2.9 编排(阶段 2)

```typescript
// src/pipeline/index.ts
export interface RenderRequest {
    readonly userInfo: type.UserInfo;
    readonly settings: type.Settings;
    readonly forceAnimation: boolean;
}

export const renderSvg: (req: RenderRequest) => string;
```

### 2.10 输出(阶段 1 / 4)

```typescript
// src/file-writer.ts
export const DEFAULT_OUT_DIR = './profile-3d-contrib';

/** basename 归一化 + 白名单校验,非法抛 E_FILENAME_INVALID */
export const assertSafeName: (name: string) => string;

/** 内容与磁盘一致时跳过写入(阶段 4) */
export const writeFile: (name: string, content: string, outDir: string) => void;
```

## 三、旧→新映射表

现有 13 个 `.ts` 文件的完整去向,确保实施过程中不会丢失任何逻辑:

| 现状文件 | 行数 | 目标 | 变化性质 | 阶段 |
|---|---|---|---|---|
| `index.ts` | 118 | `index.ts` | 改用 `resolveConfig` 与 `renderSvg` | 0/1/3 |
| `type.ts` | 179 | `type.ts` | 新增 `L10nLabels`;删除 `l10n` 双声明;`Settings` 类型本身不变 | 4 |
| `github-graphql.ts` | 211 | `github/client.ts` + `github/documents.ts` + `github/errors.ts` | 拆为 3 个模块;重试/分页/错误分类为新增能力 | 3 |
| `aggregate-user-info.ts` | 103 | `aggregate-user-info.ts` | 移除整体 dump;聚合多条 `errors` | 1 |
| `create-svg.ts` | 237 | `pipeline/index.ts` + `renderers/dom.ts` + `renderers/footer.ts` | 拆为 3 个模块;消除 4 处 `settings.type` | 2 |
| `create-3d-contrib.ts` | 352 | `renderers/layout.ts` + `renderers/{normal,season,rainbow,bitmap}.ts` | 拆为 5 个模块;消除 16 处 `settings.type`;几何提取为纯函数 | 2 |
| `create-css-colors.ts` | 185 | `renderers/{normal,season,rainbow,bitmap}.ts` 的 `css()` + `renderers/shared.ts` | 拆为 5 个模块;消除 9 处 `settings.type` | 2 |
| `create-pie-language.ts` | 132 | `renderers/pie-lang.ts` | 改名;`OTHER_NAME` 改为 l10n | 2/4 |
| `create-radar-contrib.ts` | 154 | `renderers/radar.ts` | 改名;逻辑基本不变 | 2 |
| `color-template.ts` | 31 | `color-template.ts` | **不改** | — |
| `settings-reader.ts` | 10 | `settings-reader.ts` | 接入校验器 | 1 |
| `file-writer.ts` | 8 | `file-writer.ts` | 路径穿越加固 + 幂等写 | 1/4 |
| `utils.ts` | 29 | `utils.ts` | **不改** | — |
| `settings/*.json`(8 个) | — | `settings/*.json` | **不改** | — |

**新增但不属现有文件**:`errors.ts`、`settings-validator.ts`、`cli/`、`config/`、`github/`、`l10n/`、`pipeline/`、`renderers/`。

## 四、环境变量兼容表

**承诺:以下 6 个环境变量在本 spec 全周期内不删除、不重命名。**

### `GITHUB_TOKEN`

| 项 | 内容 |
|---|---|
| 旧行为 | `process.env.GITHUB_TOKEN`,为空则报 `GITHUB_TOKEN is empty` 并退出码 1 |
| 新行为 | 优先级 `CLI --token` > `inputs.token` > `env GITHUB_TOKEN`;为空报 `E_TOKEN_MISSING` |
| 是否破坏 | **否** |
| 迁移建议 | 无需改动。`inputs.token` 仅为可选补充;因 `secrets.*` 只能通过 `env` 传递,主流用法仍应走 `env` |

### `USERNAME`

| 项 | 内容 |
|---|---|
| 旧行为 | `3 <= process.argv.length ? process.argv[2] : process.env.USERNAME` |
| 新行为 | 优先级 `CLI 位置参数` > `inputs.username` > `env USERNAME` |
| 是否破坏 | **否**。原「位置参数优先于 env」的既有语义被保留为优先级链的一部分 |
| 迁移建议 | 无需改动。**但注意**:旧实现不区分位置参数与选项,`--help` 会被当成用户名。新实现会正确识别 |

### `MAX_REPOS`

| 项 | 内容 |
|---|---|
| 旧行为 | 默认为 100;**仅作为分页停止阈值**。用户仓库数少于 `maxRepos` 时全部统计,首页 100 个节点不做截断。`commitContributionsByRepository` 硬编码 100,完全不受影响。负数与非整数仅 `isNaN` 检查 |
| 新行为 | 默认 100;**真正作为仓库数上限**,对 `repositories` 与 `commitContributionsByRepository` 同时生效;范围强制 1~1000 |
| 是否破坏 | **是 —— 行为变更**。设置 `MAX_REPOS` 的用户,其 star / fork 数字将**变小**(此前虚高) |
| 迁移建议 | 依赖旧(虚高)数字的用户无需改配置,数字会自动变为正确值。**必须在 CHANGELOG 中显式说明**,并附一个改动前后的对照示例 |

> 这是本 spec 唯一的破坏性变更。旧行为是缺陷,新行为是修正。

### `SETTING_JSON`

| 项 | 内容 |
|---|---|
| 旧行为 | 读取 JSON 文件;`JSON.parse` 后类型断言,**零校验**;内容为数组则逐项渲染,否则渲染单项;缺省文件名 `profile-customize.svg` |
| 新行为 | 同样支持单条/数组;新增 JSON Schema 校验(阶段 1 仅告警 → 阶段 3 转阻断);文件名经 `assertSafeName` 加固 |
| 是否破坏 | **部分**。格式合法的存量配置完全不受影响;格式非法的配置将开始报错(此前是静默产出空白图) |
| 迁移建议 | 阶段 1~2 之间发布时,告警会指出问题但**不阻断**。请在此期间修正配置。阶段 3 起非法配置会阻断 |

### `GITHUB_ENDPOINT`

| 项 | 内容 |
|---|---|
| 旧行为 | `github-graphql.ts:4-5` **模块加载期**求值为模块级常量 `URL`;默认 `https://api.github.com/graphql` |
| 新行为 | 由 `GitHubClient` 构造参数注入;优先级 `CLI --endpoint` > `inputs.endpoint` > `env GITHUB_ENDPOINT` > 默认值。**默认值与解析时机对用户不可见,行为等价** |
| 是否破坏 | **否** |
| 迁移建议 | 无需改动。唯一可观察差异:若用户在进程运行**中途**修改 `process.env.GITHUB_ENDPOINT`,旧实现不生效、新实现仍不生效(endpoint 在配置解析时一次性确定) |

### `YEAR`

| 项 | 内容 |
|---|---|
| 旧行为 | 默认为 `null`;非数字报 `YEAR is NaN`;**无范围校验**(`YEAR=3000` 可通过) |
| 新行为 | 范围强制 1970 ~ 当前年,越界报 `E_YEAR_INVALID`;该年份无数据时报 `E_YEAR_EMPTY`(此前是 `TypeError` 崩溃) |
| 是否破坏 | **否**。合法值行为完全一致;非法值此前崩溃或产出无意义结果 |
| 迁移建议 | 无需改动 |

### 新增项(非破坏)

| 名称 | 形式 | 说明 |
|---|---|---|
| `GITHUB_API_VERSION` | env | GitHub API 版本头。`@actions/*` 会自动注入,用户一般无需设置 |
| — | `inputs.*` | 10 个新 input,见[阶段 3](./04-phase3-config-api.md) |
| — | `--*` CLI | 11 个新选项,见[阶段 3](./04-phase3-config-api.md) |

## 五、`settings.type` → Renderer 映射表

| `settings.type` | Renderer 文件 | `needsLayout` | `canvas` | 主题名(CLI) | 输出文件(无动画) |
|---|---|---|---|---|---|
| `normal` | `normal.ts` | true | 1280×850 | `normal` / `night-view` / `night-green` | `profile-green.svg` 等 |
| `season` | `season.ts` | true | 1280×850 | `season` / `season-south` | `profile-season.svg` / `profile-south-season.svg` |
| `rainbow` | `rainbow.ts` | true | 1280×850 | `night-rainbow` | `profile-night-rainbow.svg` |
| `bitmap` | `bitmap.ts` | true | 1280×850 | `gitblock` | `profile-gitblock.svg` |
| `pie_lang_only` | `pie-lang.ts` | false | 520×260 | — | `profile-customize.svg`(自定义时) |
| `radar_contrib_only` | `radar.ts` | false | 520×390 | — | `profile-customize.svg`(自定义时) |

`canvas` 数值来自 `create-svg.ts:10-18` 的现有常量:

```typescript
const pieHeight = 200 * 1.3;                    // 260
const pieWidth = pieHeight * 2;                 // 520
const radarWidth = 400 * 1.3;                   // 520
const radarHeight = (radarWidth * 3) / 4;       // 390
```

**关键收益**:`season` 与 `season-south` 共用 `type:'season'`(内容不同),`normal` / `night-view` / `night-green` 共用 `type:'normal'`。内部 type 与用户可见名称解耦,新增内置主题变体**不需要新增 type**。

## 六、错误码总表

| 错误码 | 退出码 | 触发条件 | 用户可操作建议 |
|---|---|---|---|
| `E_TOKEN_MISSING` | 1 | 未提供 `GITHUB_TOKEN` | 设置 env 或 `inputs.token` |
| `E_USERNAME_MISSING` | 1 | 未提供用户名 | 设置 env 或位置参数 |
| `E_MAX_REPOS_INVALID` | 1 | 非整数或超出 1~1000 | 修正取值 |
| `E_YEAR_INVALID` | 1 | 非整数或超出 1970~当年 | 修正取值 |
| `E_YEAR_EMPTY` | 1 | 该年份无贡献数据 | 省略 `YEAR` 或确认数据保留策略 |
| `E_SETTINGS_INVALID` | 1 | settings JSON 校验失败 | 按行号提示修正 |
| `E_FILENAME_INVALID` | 1 | `fileName` 含路径分隔符或非法字符 | 仅用文件名,不含路径 |
| `E_CONFIG_CONFLICT` | 1 | `--theme` 与 `--settings-json` 并用 | 二选一 |
| `E_DUPLICATE_RENDERER` | 1 | 同一 `type` 重复注册 | 内部错误,应视为 bug |
| `E_GITHUB_AUTH` | 2 | 401/403 或 Bad credentials | 检查 token 权限 |
| `E_GITHUB_RATE_LIMIT` | 2 | 限流且重置时间 > 60s | 等待至提示的时间,或改用 PAT |
| `E_GITHUB_NOT_FOUND` | 2 | 404 或用户不存在 | 检查用户名拼写 |
| `E_GITHUB_GRAPHQL` | 1 | 200 + `errors` | 按 `paths` 排查 |
| `E_GITHUB_SCHEMA_DRIFT` | 1 | 未识别的 `errors[].type` | 设置 `GITHUB_API_VERSION` |
| `E_GITHUB_NETWORK` | 2 | 超时 / DNS / 5xx(重试后) | 检查网络,稍后重试 |
| `E_GITHUB_NO_DATA` | 2 | `data` 为空且无 `errors` | 检查 token 权限 |

**退出码约定**:`1` = 配置或输入错误(用户改配置可解决),`2` = 远端或网络错误(重试可能解决)。供用户工作流判别。

## 七、文档索引(回链)

| 文档 | 内容 |
|---|---|
| [总纲](./README.md) | 现状、问题诊断、目标、收益、风险、优先级、路线图 |
| [阶段 0](./01-phase0-safety-net.md) | 安全网 |
| [阶段 1](./02-phase1-correctness.md) | 止血与正确性 |
| [阶段 2](./03-phase2-architecture.md) | 架构重构 |
| [阶段 3](./04-phase3-config-api.md) | 配置体系与 API 层 |
| [阶段 4](./05-phase4-perf-ux.md) | 性能与体验打磨 |
| [阶段 5](./06-phase5-advanced.md) | 进阶能力 |
