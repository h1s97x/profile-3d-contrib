# Demo 与可复制的流水线示例

## 效果图

`*.svg` 是 10 套内置主题的渲染结果。`README.md` 和 10 份翻译通过
`raw.githubusercontent.com/.../docs/demo/*.svg` 引用它们，因此这些文件必须留在仓库里、
路径不能改 —— 这是它们放在 `docs/` 下的唯一原因。

## 流水线示例

[`pipelines/`](./pipelines/) 下是可以直接复制进你 profile 仓库的配置片段，用扁平
`settings:` 或内联 `settings_json`，**不需要准备任何 JSON 文件**。

| 示例 | 场景 | 产物 |
|---|---|---|
| [`basic.cnb.yml`](./pipelines/basic.cnb.yml) | 最简：像 `cnb-metrics` 一样用扁平 `settings:` 出单图 | `profile-gitblock.svg` |
| [`all-themes.cnb.yml`](./pipelines/all-themes.cnb.yml) | `theme: all`，一次产出全部 10 张 | 10 张内置主题图 |
| [`private.cnb.yml`](./pipelines/private.cnb.yml) | 私有仓库令牌，走密钥仓库 `settingsFrom` | `profile-green.svg` |
| [`multi-theme.cnb.yml`](./pipelines/multi-theme.cnb.yml) | `settings_json` 数组，一次生成多张 | `day.svg` / `night.svg` |
| [`panels.cnb.yml`](./pipelines/panels.cnb.yml) | 只画语言饼 / 只画雷达 | `pie_lang_only.svg` / `radar_contrib_only.svg` |
| [`localized.cnb.yml`](./pipelines/localized.cnb.yml) | `l10n` 本地化文案 | `profile-es.svg` |
| [`github-actions.yml`](./pipelines/github-actions.yml) | GitHub container action 用法 | `profile-gitblock.svg` |

> 每个文件是流水线里的**一个 stage 片段**（GitHub Actions 示例除外）。把它插进你
> `.cnb.yml` 的 `stages` 数组，并**和 commit stage 放在同一条流水线** —— CNB 的
> 工作区只在同一条流水线的各 stage 之间共享，拆成两条会看不到生成的 SVG。

`theme` 可取值：`green`（同 `normal`）、`halloween`、`season`、`season-south`、
`night-view`、`night-green`、`night-rainbow`、`gitblock`；`theme: all` 会一次产出全部
10 张内置主题图。不给任何渲染选项时，生成器只产出一张 `profile-green.svg`。

完整参数表见 [README 的 CNB 章节](../../README.md#how-to-use-cnb)。
