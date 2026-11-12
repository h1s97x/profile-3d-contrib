# 阶段 4:性能与体验打磨(Performance & UX)

| 元信息 | 值 |
|---|---|
| 优先级 | P1 / P2 |
| 分类 | **长期演进** —— 依赖瘦身需在阶段 2 完成后进行,否则会白做 |
| 工期 | 4 周 |
| 目标版本 | **minor** |
| 前置条件 | [阶段 2](./03-phase2-architecture.md) 已完成;阶段 3 可并行 |
| 风险等级 | 中 |

## 一、目标

1. **产物体积** 6.7 MB → 1.5~2 MB
2. **补全 `l10n`**、**补齐可访问性**
3. **布局参数化**,把硬编码常量开放为可配置项
4. **输出层加固**,消除路径穿越与无谓 commit

> 体积优化的实际收益需在 commit 1 后**实测确认**。总纲中的 1.5~2 MB 是目标值,不是结论。

## 二、依赖瘦身分析

### 2.1 现状

`dist/index.js` 6.7 MB。5 个源文件均全量引入 d3:

```typescript
// src/create-svg.ts / create-3d-contrib.ts / create-css-colors.ts /
// create-radar-contrib.ts / create-pie-language.ts 均为:
import * as d3 from 'd3';
```

bundle 内实测存在的模块,及其是否真被使用:

| 模块 | bundle 内出现次数 | 实际是否使用 | 说明 |
|---|---|---|---|
| `d3-selection` | 53 | **是** | `d3.select` / `selectAll` / `.append` / `.attr` |
| `d3-shape` | 60 | **是** | `d3.pie` / `d3.arc` |
| `d3-path` | — | **是** | `d3.path()`(`create-3d-contrib.ts:133`) |
| `d3-color` | — | **是** | `d3.rgb` / `.darker()` |
| `d3-interpolate` | — | **是** | `d3.interpolate`(season 渐变) |
| `d3-geo` | 58 | **否** | 完全未使用 |
| `d3-force` | 12 | **否** | 完全未使用 |
| `d3-drag` | 6 | **否** | 完全未使用 |
| `d3-zoom` | 6 | **否** | 完全未使用 |
| `jsdom` | 58 | 仅提供 DOM 容器 | 见 2.3 |

### 2.2 按需引入

```typescript
// src/renderers/shared.ts(计划内容)—— 统一出口,避免各文件重复声明
export { select, selectAll } from 'd3-selection';
export type { Selection } from 'd3-selection';
export { pie, arc } from 'd3-shape';
export type { PieArcDatum } from 'd3-shape';
export { path as d3path } from 'd3-path';
export { rgb, interpolate } from 'd3-color';
```

引入策略:

- **不用** `d3` 顶层聚合包,改为直接依赖 `d3-selection` / `d3-shape` / `d3-path` / `d3-color` / `d3-interpolate` 五个子包
- 这五个包已经是 `d3` 的直接依赖,**不会增加传递依赖数量**,只是不再引入另外 30+ 个子包
- 需补 `@types/d3-selection` 等类型包;当前只有 `@types/d3`,可以保留(它会带全部子包的类型,类型体积不影响运行时产物体积)

风险:若代码中某处用了未列出的 d3 API,会编译报错 —— 这正是我们想要的,编译器会把「未使用模块」的假设证伪。

### 2.3 `jsdom` 处置

`jsdom` 在本项目中的**唯一**用途是给 `d3.select` 提供一个 DOM 容器:

```typescript
// src/create-svg.ts:35-38(现状)
const fakeDom = new JSDOM(
    '<!DOCTYPE html><html><body><div class="container"></div></body></html>',
);
const container = d3.select(fakeDom.window.document).select('.container');
```

它带来的传递依赖包括 `parse5`、`tough-cookie`、`cssstyle`、`nwsapi` 等,是 bundle 中相当可观的一部分。

| 方案 | 体积影响 | 风险 | 建议 |
|---|---|---|---|
| 保持 jsdom | 基线 | 无 | — |
| 换 `linkedom` | 大幅下降 | **中**。需验证 d3-selection 的 `append` / `attr` / `html()` 在 linkedom 下的行为与序列化结果是否与 jsdom 逐字节一致 | **先做 spike** |
| 手工拼字符串 | 最小 | **高**。需重写全部绘制逻辑,与阶段 2 刚建立的 renderer 架构冲突,且失去 d3 的声明式简洁 | 不推荐 |

**spike 方案**(不改任何产品代码,只做一次性验证):

1. 新建 `scratch/linkedom-check.ts`(不入库,或入库后删除)
2. 用阶段 0 的 `spec/dummy-data.ts` 分别经 jsdom 与 linkedom 渲染 `night-rainbow` 与 `gitblock`(覆盖最复杂的两条路径)
3. 对两者的输出做**逐字节 diff**
4. 若完全一致 → 替换;若有差异但**仅**为属性顺序/转义差异 → 需评估是否影响浏览器渲染与快照;若有语义差异 → 放弃

> 关键判据:快照测试是**逐字节**比较,而 SVG 属性顺序变化会触发快照失败。若 linkedom 导致顺序不同,即使视觉一致也会卡住阶段 0 建立的门禁。因此 spike 必须验证字节一致,而非「看起来一样」。

### 2.4 预期与验证

| 子项 | 预期收益 | 验证方法 |
|---|---|---|
| d3 按需引入 | 移除 4+ 个未用子包 | `npm run build` 后对比 `dist/index.js` 字节数 |
| `axios → fetch`(阶段 3) | 移除 3 个传递依赖 | `npm ls --prod` 对比 |
| `jsdom → linkedom` | 移除 5+ 个传递依赖 | 同上,且须通过 spike |
| **合计目标** | **6.7 MB → 1.5~2 MB** | 每项 commit 单独记录字节数变化 |

## 三、渲染性能优化

### 3.1 rainbow 内联样式聚类

`create-3d-contrib.ts:81-98` 的 `addRainbowColor` 为**每个元素**写入内联样式:

```typescript
// 现状
path.attr('class', className).attr(
    'style',
    `animation-delay:${delaySeconds.toFixed(3)}s`,
);
```

371 天 × 3 个面 ≈ **1113 个内联 `style` 属性**。延迟值只取决于 `week`(共 53 个可能值),因此存在大量重复。

优化方案:按 week 生成 53 个 CSS 类,延迟写进样式表。

```typescript
// src/renderers/rainbow.ts(计划内容)
// CSS 侧生成: .rb-w{week}-l{level}-{face} { animation-delay: Xs; animation-name: rb-l{level}-{face} }
const delayClass = `rb-w${((week % 53) + 53) % 53}`;
path.attr('class', `${className} ${delayClass}`);
```

| 指标 | 优化前 | 优化后 |
|---|---|---|
| 内联 `style` 属性数 | ~1113 | 0 |
`<style>` 内容增量 | 0 | 53 × 3 条规则,约 +4 KB |
| SVG 总体积 | 基线 | **略增或持平** |
| 浏览器解析开销 | 1113 次内联样式解析 | 53 条规则匹配 |

净收益主要在浏览器端(尤其 README 页面同时加载多张图时),SVG 体积可能微增。**须用快照测试确认体积变化幅度可接受**。

同时修复 `create-3d-contrib.ts:91` 的重复解析:

```typescript
// 现状:每元素执行一次
const durationSeconds = parseFloat(settings.duration);

// 计划:在 rainbow renderer 的 css() 中解析一次后闭包捕获
const durationSeconds = parseFloat(settings.duration);
const delayOf = (week: number): number => { /* ... */ };
```

### 3.2 已由阶段 2 完成的优化

阶段 2 的 commit 11(`perf: reuse single LayoutModel across all themes`)已完成「10 次布局 → 1 次布局」。本阶段不再重复该工作,只负责**验证**提速达标。

### 3.3 性能基线脚本

```typescript
// scripts/perf-baseline.ts(计划内容)
interface PerfResult {
    theme: string;
    animated: boolean;
    renderMs: number;
    svgBytes: number;
}

export const runPerfBaseline = (): ReadonlyArray<PerfResult> => { /* ... */ };
```

用法:`node dist/index.js` 前置调用,或独立跑 `npx ts-node scripts/perf-baseline.ts`。需在 CI 中作为**非阻塞**任务运行(耗时较长),只记录数据供对比,不设阈值。

## 四、LayoutOptions 参数化

把下列硬编码常量开放为可配置项,**默认值必须与现状完全一致**(否则快照会失败):

| 现有位置 | 常量 | 建议配置名 | 默认值 |
|---|---|---|---|
| `create-svg.ts:10` | `width` | `canvas.width` | `1280` |
| `create-svg.ts:11` | `height` | `canvas.height` | `850` |
| `create-3d-contrib.ts:5` | `ANGLE` | `perspective.angle` | `30` |
| `create-3d-contrib.ts:185` | `dx = width / 64` | `perspective.columnDivisor` | `64` |
| `create-3d-contrib.ts:190` | `offsetX = dx * 7` | `perspective.leftPadding` | `7` |
| `create-3d-contrib.ts:191` | `offsetY` 中的 `+7` | `perspective.bottomPadding` | `7` |
| `create-3d-contrib.ts:204` | `/20` | `barHeight.logDivisor` | `20` |
| `create-3d-contrib.ts:204` | `*144 + 3` | `barHeight.scale` / `barHeight.minimum` | `144` / `3` |
| `create-css-colors.ts:4-6` | `DARKER_*` | `shade.{top,left,right}` | `0` / `0.5` / `1` |
| `create-pie-language.ts:21` | `slice(0, 5)` | `pie.topLanguages` | `5` |
| `create-radar-contrib.ts:5` | `rangeLabels` | `radar.scaleLabels` | `['1','10','100','1K','10K']` |

```typescript
// src/renderers/layout.ts(计划内容)
export interface LayoutOptions {
    readonly angle: number;
    readonly columnDivisor: number;
    readonly leftPadding: number;
    readonly bottomPadding: number;
    readonly barLogDivisor: number;
    readonly barHeightScale: number;
    readonly barHeightMinimum: number;
}

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
    angle: 30, columnDivisor: 64, leftPadding: 7, bottomPadding: 7,
    barLogDivisor: 20, barHeightScale: 144, barHeightMinimum: 3,
};
```

JSON Schema 中对应新增可选的 `layout` 对象,全部字段可选,缺省即用默认值。

## 五、l10n 补全

### 5.1 缺口

`create-pie-language.ts:4` 的 `const OTHER_NAME = 'other';` **无法本地化**。`type.ts` 中 `l10n` 被重复声明两次:

- `RadarContribSettings.l10n`:5 键(`commit` / `issue` / `pullreq` / `review` / `repo`)
- `BaseSettings.l10n`:6 键(多 `contrib`)

`PieLangOnlySettings` 继承的 `l10n` **不含** `other` 字段。中文用户看到的是英文 `other`。

### 5.2 补全方案

```typescript
// src/type.ts(计划内容)—— 统一为单一 l10n 定义
export interface L10nLabels {
    readonly commit: string;
    readonly issue: string;
    readonly pullreq: string;
    readonly review: string;
    readonly repo: string;
    readonly contrib: string;
    readonly other: string;   // 新增
    readonly period: string;  // 新增,如「统计周期」
}

export const DEFAULT_L10N: L10nLabels = {
    commit: 'Commit', issue: 'Issue', pullreq: 'PullReq',
    review: 'Review', repo: 'Repo', contrib: 'contributions',
    other: 'other', period: 'period',
};
```

同时删除 `RadarContribSettings.l10n` 与 `BaseSettings.l10n` 的双声明,统一由 `BaseSettings` 引用 `L10nLabels`。这是修 A 类问题的收尾,消除类型层面的重复。

### 5.3 补齐流程

1. 从 10 份 `docs/README.<lang>.md` 中提取已有的译文术语(贡献、议题、拉取请求、评审、仓库、其他)
2. 补齐 `DEFAULT_L10N` 的 8 个键 × 11 种语言(英文 + 10 份翻译)
3. 新增 `src/l10n/index.ts` 存放各语言包,参考 GitHub Linguist 的语言名规范
4. README 的 `l10n` 文档段落更新为「支持的全部键 + 各语言取值」

> `L10nLabels` 的字段若从可选改为必填,会破坏存量 settings JSON。**必须保持全部可选**,`DEFAULT_L10N` 作为 fallback。

## 六、可访问性

### 6.1 改动

```typescript
// src/pipeline/index.ts(计划内容)
svg.attr('role', 'img')
   .attr('aria-label', describe(userInfo, settings))
   .append('title')
   .text(describe(userInfo, settings));
```

`describe()` 生成如:`「octocat 的 3D 贡献日历,2026-01-01 至 2026-12-31,共 366 次贡献,1 234 星标,56 次复刻」` 的可读描述,使用 `DEFAULT_L10N` 本地化。

### 6.2 快照影响评估

`<title>` 元素**会**进入 SVG 序列化结果,导致**全部 16 份快照变化**。

处理方式(必须二选一,并在 commit message 中说明):

| 方案 | 做法 | 评价 |
|---|---|---|
| A | 更新 16 份基线快照 | 简单,但快照的「门禁」价值在这一次被主动放弃 |
| B | 快照测试中剥离 `<title>` 与 `aria-label` 后再比对 | 保持门禁严格性,推荐 |

推荐方案 B:在快照测试中加一个 `normalizeSvg()` 辅助函数,移除 `role` / `aria-label` / `<title>` 后再 `toMatchSnapshot()`,并在测试文件中明确注释说明原因。

> 需评估 `<title>` 是否有视觉副作用。`<title>` 在 SVG 中不渲染,理论上无影响,但须用 `docs/demo/` 人工比对确认。

## 七、输出层加固

`file-writer.ts` 在阶段 1 已加 `path.basename` + 白名单,本阶段追加**幂等写入**:

```typescript
// src/file-writer.ts(计划内容)
export const writeFile = (name: string, content: string, outDir: string): void => {
    const safe = assertSafeName(name);          // 阶段 1 已实装
    mkdirOnce(outDir);                          // 阶段 1 已实装
    const target = path.join(outDir, safe);
    if (existsSync(target) && readFileSync(target, 'utf8') === content) {
        skippedCount += 1;                      // 内容未变,跳过
        return;
    }
    writeFileSync(target, content);
    writtenCount += 1;
};
```

用户价值:README 推荐的 workflow 是 `if git commit -m "generated"; then git push; fi`。内容未变时 git 本身已会拒绝提交,但 `writeFileSync` 仍会重写文件、改变 mtime。幂等写入让「无变化」这一事实在文件系统层也成立,并可通过日志告知用户「10 个文件全部无变化」。

## 八、文档修正

| 项 | 位置 | 修正 |
|---|---|---|
| 文件名笔误 | `CHANGELOG.md` `0.9.0` 条目引用 `sample-settings/green.dual.json` | 实际文件为 `green-dual.json`。修正引用(**不改历史条目的语义描述**) |
| 10 份 README 同步 | `docs/README.<lang>.md` | 明确英文 `README.md` 为权威源;中文等 10 份为翻译。引入 `docs/README.<lang>.md` 的同步检查清单(新增配置项时须同步全部 11 份) |
| settings 文档 | `README.md` 当前让用户参考 `src/type.ts` | 改为指向 `schema/settings.schema.json`,并说明 VS Code 自动补全的用法 |
| 架构文档 | 新增 | 阶段 2 commit 13 产出的「如何新增主题」文档,链接到 `docs/roadmap/` |

## 九、文件级改动清单

| 文件路径 | 动作 | 改动说明 |
|---|---|---|
| `src/renderers/shared.ts` | MODIFY | d3 按需引入出口 |
| `src/renderers/rainbow.ts` | MODIFY | `parseFloat` 提循环外;week 延迟类替代内联样式 |
| `src/renderers/layout.ts` | MODIFY | 新增 `LayoutOptions` + `DEFAULT_LAYOUT_OPTIONS` |
| `src/renderers/dom.ts` | MODIFY | 新增 `role` / `aria-label` / `<title>` |
| `src/type.ts` | MODIFY | 统一 `L10nLabels`,删除 `l10n` 双声明,新增 `other` / `period` |
| `src/l10n/index.ts` | NEW | 11 种语言包 |
| `src/renderers/footer.ts` | MODIFY | `describe()` 使用 l10n |
| `src/file-writer.ts` | MODIFY | 幂等写入 + 计数 |
| `schema/settings.schema.json` | MODIFY | 新增可选 `layout` 对象、`l10n.other`、`l10n.period` |
| `scripts/perf-baseline.ts` | MODIFY | 扩充为 8 主题 × 动画/静态的完整基线 |
| `spec/normalize-svg.ts` | NEW | 快照归一化辅助(剥离 `role` / `title` / `aria-label`) |
| `spec/renderers/rainbow.spec.ts` | MODIFY | 断言无内联样式 |
| `spec/layout-options.spec.ts` | NEW | 默认值必须与现状一致的断言 |
| `spec/l10n.spec.ts` | NEW | 11 种语言 × 8 键完整性 |
| `README.md` + 10 份翻译 | MODIFY | `layout` / `l10n` 文档、schema 指引 |
| `CHANGELOG.md` | MODIFY | `green-dual.json` 笔误、本阶段条目 |
| `package.json` | MODIFY | 移除 `jsdom`(若 spike 通过)、`axios`(阶段 3) |

## 十、commit 切分

| # | commit message | 内容 | 快照 |
|---|---|---|---|
| 1 | `perf: import d3 submodules instead of the full package` | d3 按需引入 | **会变**(仅体积,内容应等价) |
| 2 | `chore: evaluate linkedom as a jsdom replacement` | spike 结果记录 | 不变 |
| 3 | `refactor: replace jsdom with linkedom` | **仅在 spike 通过时执行** | 必须全绿 |
| 4 | `perf: hoist duration parsing out of the per-cell loop` | `parseFloat` 提循环外 | 必须全绿 |
| 5 | `perf: replace inline animation-delay with weekly classes` | 延迟类聚类 | 必须全绿 |
| 6 | `feat: add LayoutOptions with backwards-compatible defaults` | 布局参数化 | 必须全绿 |
| 7 | `feat: unify l10n labels and add translations for 11 languages` | l10n 补全 | 必须全绿 |
| 8 | `feat: add accessibility metadata to generated SVG` | 可访问性 | 用 `normalizeSvg` 后必须全绿 |
| 9 | `feat: skip writing files whose content is unchanged` | 幂等写入 | 必须全绿 |
| 10 | `perf: add full render performance baseline script` | 性能脚本 | 不涉及 |
| 11 | `docs: correct settings filename reference in changelog` | 笔误 | 不涉及 |
| 12 | `docs: document layout options, l10n keys and schema usage` | 文档 | 不涉及 |

> commit 3 是本阶段**唯一有条件执行**的 commit。若 spike 结论为「不通过」,直接跳过,不阻塞其余 11 个 commit。

## 十一、测试策略

| 目标 | 用例要点 |
|---|---|
| d3 按需引入 | 编译通过即证明无遗漏 API;快照全绿证明行为等价 |
| rainbow 优化 | 断言输出中**不含** `style="animation-delay`;断言 `<style>` 内含 53 组延迟类 |
| `LayoutOptions` | 断言 `DEFAULT_LAYOUT_OPTIONS` 的每个值与迁移前常量**逐一相等**(这是防回归的关键断言) |
| l10n | 11 种语言 × 8 键全部存在且非空;缺失键 fallback 到 `DEFAULT_L10N` |
| 可访问性 | 断言 `role="img"` 存在、`aria-label` 含用户名与总贡献数;`normalizeSvg` 后快照全绿 |
| 幂等写入 | 连续两次写同内容 → 第二次跳过;内容不同 → 正常写入 |
| 体积 | CI 非阻塞任务记录 `dist/index.js` 字节数,写入 job summary |
| 回归 | 16 份快照(经 `normalizeSvg`)全绿 |

## 十二、验收标准

- [ ] `dist/index.js` ≤ 2 MB(若 linkedom 未通过则 ≤ 3.5 MB,需在 PR 中说明)
- [ ] SVG 中不含内联 `animation-delay`
- [ ] 快照经 `normalizeSvg` 后全绿
- [ ] `DEFAULT_LAYOUT_OPTIONS` 每一项都有「与迁移前常量相等」的断言
- [ ] 11 种语言 × 8 个 l10n 键完整
- [ ] 生成的 SVG 含 `role="img"` 与可读 `aria-label`
- [ ] `docs/demo/` 下 10 个 SVG 人工比对无视觉差异
- [ ] 性能提速 ≥ 3 倍(阶段 2 达成,本阶段复核)
- [ ] 传递依赖数量 ≤ 阶段 3 结束时
- [ ] `CHANGELOG.md` 笔误已修正,README × 11 已更新

## 十三、回滚方案

| 回滚粒度 | 操作 | 影响 |
|---|---|---|
| linkedom 回 jsdom | revert commit 3 | 体积收益减少,其余不受影响 |
| d3 全量引入回退 | revert commit 1 | 仅体积,无行为影响 |
| 布局参数化回退 | revert commit 6 | 关闭 `layout` 配置能力 |
| l10n 回退 | revert commit 7 | `other` 回到硬编码英文 |
| 可访问性回退 | revert commit 8 + 删 `normalize-svg.ts` | 快照恢复原始基线 |
| 整阶段回滚 | revert commit 1~9 | 回到阶段 2/3 状态 |

> 所有回滚均**不影响** SVG 的核心几何与配色,故不会导致用户图片视觉变化(除 commit 8 的可访问性属性外,那是纯增量)。

## 十四、风险

| 风险 | 等级 | 缓解 |
|---|---|---|
| linkedom 序列化与 jsdom 不一致 | 中 | spike 前置验证,commit 3 有条件执行,失败即跳过 |
| d3 按需引入遗漏 API | 低 | 编译器会直接报错;无运行时风险 |
| 快照因可访问性属性全变 | 中 | `normalizeSvg` 方案;并用 `docs/demo/` 人工确认无视觉差异 |
| l10n 字段从可选改必填破坏存量配置 | 中 | 全部保持可选,`DEFAULT_L10N` fallback |
| 体积目标未达成 | 低 | 目标值而非承诺;PR 中如实报告实测值 |
| rainbow 聚类使 SVG 体积反增 | 低 | 明确净收益在浏览器端而非体积;若体积增幅超 5% 则回退 commit 5 |
| 11 份 README 翻译质量 | 低 | 英文为权威源;翻译初稿 + 人工校对 |

## 十五、出口条件

- [ ] 全部 12 个 commit 合入(或 commit 3 明确跳过并记录原因)
- [ ] 体积、快照、l10n、可访问性验收项全部通过
- [ ] `docs/demo/` 人工比对通过
