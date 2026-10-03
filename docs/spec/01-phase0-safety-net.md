# 阶段 0:安全网(Safety Net)

| 元信息 | 值 |
|---|---|
| 优先级 | P0 |
| 分类 | **接管已部分完成** —— CI 闸门与 `dist/` 保护已随 `1.0.0` 落地;渲染层快照测试与 `spec/` 类型检查仍待补齐 |
| 工期 | 1~2 周 |
| 目标版本 | **不发版** |
| 前置条件 | 无 |
| 阻断的后续阶段 | [阶段 2](./03-phase2-architecture.md)(强依赖) |

## 一、目标

**在动架构之前,先让「坏改动」无法合入。**

阶段 2 的核心硬约束是「重构不改变 SVG 字节输出」。这条约束目前**无法验证**,因为:渲染层没有任何测试(`create-svg.ts` / `create-3d-contrib.ts` / `create-css-colors.ts` / `create-pie-language.ts` / `create-radar-contrib.ts` 全部 0 覆盖),且 CI 在 PR 上完全不执行任何检查。因此阶段 0 的唯一产出就是**判定门禁本身**。

## 二、前置动作

> **当前环境 `node_modules` 未安装。** 实测执行 `npx jest` 会报 `Module ts-jest in the transform option was not found`。
>
> 阶段 0 的第一个动作必须是 `npm ci`,之后才有一切可执行。

## 三、范围

### 做

1. 新增 PR 触发的 CI 工作流,含 `dist/` 一致性校验
2. 让 `spec/` 纳入 TypeScript 类型检查
3. 为 5 个渲染模块建立 SVG 快照基线
4. 使既有 `pre-commit` 配置真正生效
5. 修正 jest `testMatch` 正则,增加覆盖率阈值

### 不做(明确排除)

- **不修改 `src/` 下任何文件** —— 本阶段唯一触碰 `src/` 的动作是「读取」用于生成快照
- 不重构任何代码
- 不升级任何依赖版本(工具链升级见 [阶段 1](./02-phase1-correctness.md) 的独立 commit)
- 不改动 `action.yml`

## 四、文件级改动清单

| 文件路径 | 动作 | 改动说明 | 涉及符号 / 函数 |
|---|---|---|---|
| `.github/workflows/ci.yml` | NEW | PR / push 触发:`npm ci` → `lint` → `check-types` → `test` → `build` → `git diff --exit-code dist/` | — |
| `.github/workflows/build.yml` | MODIFY | 保留 `workflow_dispatch` 手动构建能力,与 `ci.yml` 职责分离,不改其行为 | — |
| `package.json` | MODIFY | `check-types` 改为引用 `tsconfig.spec.json`;jest `testMatch` 正则转义;新增 `coverageThreshold`;新增 `husky` / `lint-staged` devDependencies;新增 `prepare` 脚本 | `scripts.check-types`、`jest.testMatch`、`jest.coverageThreshold` |
| `tsconfig.spec.json` | NEW | 继承 `tsconfig.json`,`include` 增加 `["spec/**/*"]`,`noEmit: true` | — |
| `spec/__snapshots__/` | NEW | 渲染层快照产物(由 Jest 自动生成,需提交) | — |
| `spec/render-output.spec.ts` | NEW | 对 6 种 `settings.type` × 暗色模式做 SVG 快照断言 | — |
| `spec/create-css-colors.spec.ts` | NEW | CSS 生成的单测(不依赖 DOM) | `createCssColors` |
| `spec/layout-geometry.spec.ts` | NEW | 3D 布局几何的纯函数断言,含「首日非周日」边界用例 | `create3DContrib` 的几何部分 |
| `spec/github-graphql-error.spec.ts` | NEW | GraphQL 错误响应、`errors` 多条、HTTP 失败的处理断言 | `fetchFirst`、`fetchNext` |

### 关于 `check-types` 的改法

当前 `tsconfig.json` 的 `include` 为 `["src/**/*"]`,导致 `spec/` 从不被类型检查。改法:

```json
// package.json(计划内容)
"check-types": "tsc --noEmit && tsc --noEmit -p tsconfig.spec.json"
```

> 注意 `tsconfig.eslint.json` 已被 ESLint 引用(`.eslintrc.js` 的 `parserOptions.project`),新增的 `tsconfig.spec.json` 需与之保持一致,避免 ESLint 报「文件不在 project 内」。

### CI 工作流骨架

> 以下为计划内容,尚未实现。

```yaml
# .github/workflows/ci.yml(计划内容)
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run check-types
      - run: npm run test
      - run: npm run build
      - name: Verify dist/ is in sync with source
        run: |
          if ! git diff --exit-code -- dist/; then
            echo "::error::dist/ 与源码不一致,请执行 npm run build 后提交 dist/"
            exit 1
          fi
```

`dist/` 一致性校验是本阶段最有价值的单项:它保证 `action.yml` 指向的 `dist/index.js` 永远与 `src/` 同步,避免用户 `@latest` 拿到过期产物。

## 五、快照基线设计

### 为何需要

`create-svg.ts:56-110` 的绘制顺序、`create-3d-contrib.ts` 中 `util.toFixed` 的浮点截断,共同决定了 SVG 的字节内容。阶段 2 重构会调整调用顺序,若没有基线,一次重构就可能让所有用户的图片集体变化,而**没人能说清变化是否等价**。

### 基线输入

统一使用既有 `spec/dummy-data.ts`(2359 行,含 371 天完整日历、10 种语言、fork/star 统计)。它已经能产出确定的 `UserInfo`,无需新建。

### 断言方式

```typescript
// spec/render-output.spec.ts(计划内容)
import * as create from '../src/create-svg';
import type * as type from '../src/type';
import { dummyData } from './dummy-data';
import * as aggregate from '../src/aggregate-user-info';
import * as template from '../src/color-template';

const userInfo = aggregate.aggregateUserInfo(dummyData);

const CASES: ReadonlyArray<[string, type.Settings]> = [
    ['normal', template.NormalSettings],
    ['halloween', template.HalloweenSettings],
    ['season-north', template.NorthSeasonSettings],
    ['season-south', template.SouthSeasonSettings],
    ['night-view', template.NightViewSettings],
    ['night-green', template.NightGreenSettings],
    ['night-rainbow', template.NightRainbowSettings],
    ['gitblock', template.GitBlockSettings],
];

describe.each(CASES)('render snapshot: %s', (_name, settings) => {
    it('animated', () => {
        expect(create.createSvg(userInfo, settings, true)).toMatchSnapshot();
    });
    it('static', () => {
        expect(create.createSvg(userInfo, settings, false)).toMatchSnapshot();
    });
});
```

### 快照噪声控制

`night-rainbow` 主题含 `hueRatio`,快照会随周次变化 —— 这是**确定性**的(不依赖当前时间),可以接受。但需注意:

- 快照必须在**固定 `TZ`** 下生成。`create-3d-contrib.ts:181`、`:199` 使用 `getUTCDay()`,与时区无关;但 `aggregate-user-info.ts:50` 的 `new Date(week.date)` 解析非 ISO 字符串(`"YYYY-MM-DD hh:mm:ss.SSS+00:00"`,空格分隔)依赖运行时宽松解析。CI 中显式设置 `TZ: UTC` 规避不确定性。
- `file-writer.spec.ts` 现有 `afterEach` 会 `rmSync(OUTPUT_FOLDER)`,新增渲染测试**不得**复用该目录。

## 六、commit 切分

| # | commit message | 内容 | 独立可合并 |
|---|---|---|---|
| 1 | `ci: add pull request verification workflow` | 新增 `ci.yml` | 是 |
| 2 | `chore: type-check spec directory` | 新增 `tsconfig.spec.json`,`check-types` 覆盖 `spec/` | 是 |
| 3 | `test: add CSS generation unit tests` | `create-css-colors.spec.ts` | 是 |
| 4 | `test: add 3D layout geometry unit tests` | `layout-geometry.spec.ts` | 是 |
| 5 | `test: add render output snapshot baseline` | `render-output.spec.ts` + 提交的 `__snapshots__/` | 是 |
| 6 | `test: cover GraphQL error handling paths` | `github-graphql-error.spec.ts` | 是 |
| 7 | `chore: fix jest testMatch regex and add coverage thresholds` | 正则转义 + 覆盖率阈值 | 是 |
| 8 | `chore: enable pre-commit hooks with husky` | husky + lint-staged | 是 |

> commit 5 是**本阶段最关键的 commit**。在其合入前,阶段 2 不得启动。

建议顺序 1 → 2 → 3~6 → 7 → 8。commit 1 单独先合,便于快速观察 CI 在主干上的表现。

## 七、测试策略

| 层次 | 范围 | 是否依赖 DOM | 目标覆盖 |
|---|---|---|---|
| 纯函数 | `utils.ts`、`create-css-colors.ts`、3D 布局几何 | 否 | ≥ 80% |
| 渲染快照 | `create-svg.ts` 全链路 | 是(JSDOM) | 基线即可,不追覆盖率 |
| I/O | `github-graphql.ts`、`settings-reader.ts`、`file-writer.ts` | 否 | ≥ 60% |

### 布局几何单测的必测边界

`create-3d-contrib.ts:180-184` 的周次计算是历史缺陷高发区(`0.9.1` 曾修复「week 在起始日非周日时计算错误」,见 CHANGELOG)。必须包含:

- `firstDate.getUTCDay() !== 0`(首日非周日)—— 回归用例
- `contributionCalendar.length` 恰好为 364 / 371 / 372
- 单日贡献量为 0(避免 `Math.log10(0)` → `-Infinity`)

## 八、验收标准

- [ ] `npm ci` 在 Node 24 下成功,`npm test` 全部通过
- [ ] `npm run lint` 与 `npm run check-types` 均覆盖 `src/` **和** `spec/`
- [ ] `docs/spec/` 之外未新增任何 `.md` 文档
- [ ] 打开 PR 时 `CI / verify` 任务运行 `npm ci`、`lint`、`check-types`、`test`、`build`
- [ ] 人为在 `src/` 中引入一处渲染错误(如改 `create-3d-contrib.ts:204` 的 `144`),提交 PR 后 **CI 必须失败**
- [ ] 人为在 `src/` 中做一处不改变行为的改动后重新构建,`git diff --exit-code -- dist/` **必须失败**(证明一致性校验有效)
- [ ] 8 种内置主题 × 动画/静态 = 16 份快照全部生成并已提交
- [ ] `coverageThreshold` 生效:`renderers` 相关文件(阶段 2 后)覆盖率低于阈值时 CI 失败
- [ ] 提交时 husky 拦截 lint 失败
- [ ] `TZ=UTC` 下两次构建产出**完全一致**的 `dist/index.js`

## 九、回滚方案

本阶段全部为增量新增,回滚成本极低:

| 回滚粒度 | 操作 | 影响 |
|---|---|---|
| 完全回滚 | 删除 `.github/workflows/ci.yml`,还原 `package.json` | 无 |
| 仅回滚覆盖率阈值 | 删除 `package.json` 中 `coverageThreshold` | 仅失去门禁 |
| 仅回滚快照测试 | 删除 `spec/render-output.spec.ts` 与 `__snapshots__/` | 阶段 2 的门禁失效,**须同步推迟阶段 2** |

新增的 `tsconfig.spec.json` 可直接删除,`src/` 的编译行为不受影响(未修改 `tsconfig.json`)。

## 十、风险

| 风险 | 等级 | 缓解 |
|---|---|---|
| `dist/` 一致性校验在首次运行时失败(仓库中 `dist/` 已是 6.7 MB 旧产物,与当前源码可能有偏差) | 中 | 先在本地执行 `npm run build` 并确认 diff 规模;若 diff 巨大,先单独一个 commit「重建 dist」,再合入 CI 校验 |
| 快照在 CI 与本地不一致 | 中 | CI 显式设 `TZ: UTC`;发现差异先怀疑浮点格式化与 `new Date()` 宽松解析,定位后再提交基线 |
| `check-types` 纳入 `spec/` 后暴露既有类型错误 | 低 | 先用 `tsc --noEmit -p tsconfig.spec.json` 试跑,预计仅 `spec/github-graphql.spec.ts` 的 `dummyData.data?.user` 可选链有问题,量级极小 |
| husky 在 CI 上干扰 | 低 | `HUSKY=0` 环境变量在 CI 中禁用 hook |

## 十一、出口条件

阶段 0 完成的判定标准是**唯一**的:

> 打开任意 PR,CI 会跑完整套检查,且能捕获渲染层的意外变更。

满足此条即可进入阶段 1 与阶段 2。
