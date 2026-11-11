# 项目接管执行档案(Takeover Record)

| 元信息 | 值 |
|---|---|
| 状态 | **已执行** |
| 执行日期 | 2026-10-03 |
| 上游项目 | [yoshi389111/github-profile-3d-contrib](https://github.com/yoshi389111/github-profile-3d-contrib) |
| 基线版本 | `v0.9.3` |
| 本次发布版本 | `1.0.0` |
| 维护者 | `h1s97x` |
| 许可证 | MIT(原作者著作权归 SATO Yoshiyuki,见 [`LICENSE`](../../LICENSE)) |

本文档是**接管的权威记录**:记录已执行的改动、关键决策及其依据、以及未完成事项的交接说明。
后续演进阶段见 [README](./README.md) 的阶段路线图。

> **接管首次提交(`a2c5e2a`)未修改 `src/` 任何运行时代码**,1749 行源码与 8 个内置主题 JSON
> 保持原样,产物与 `0.9.3` 字节一致。
>
> **现状(阶段 1 之后)**:`src/` 已改动 9 个文件(`settings-validator.ts` 新增、缺陷 B1~B6 修复),
> `dist/index.js` 由 190,611 行增至 191,885 行。**16 份 SVG 快照字节未变**,即存量用户升级后
> 图片不会重绘;B1~B6 修复前「渲染逻辑零改动」的表述已不再适用于 `1.0.0` 起的代码状态。

---

## 一、待替换占位符

面向用户的 `uses:` 坐标已在 `1.0.0` 落实为 `h1s97x/...`。以下占位符**按文件区分处理**,
不得一次性全局替换:

| 占位符 | 位置 | 处理 |
|---|---|---|
| `YOUR_GITHUB_USER` / `YOUR_GITHUB_REPO` | `package.json`(3 处:repository / homepage / bugs)、11 份 README 与 `EXAMPLES.md` 的 `uses:`、`.github/workflows/sync-cnb.yml` 注释 | **已替换**为 `h1s97x/github-profile-3d-contrib` |
| `YOUR_GITHUB_USER` / `YOUR_GITHUB_REPO` | `docs/spec/04-phase3-config-api.md`、`docs/spec/06-phase5-advanced.md` 中已规划但未实现的内容 | **已替换**为真实坐标 —— 这些文档描述的就是本仓库未来的样子,留占位符等于让人以为发布前还要再改一遍 |
| `YOUR_CNB_USER` / `YOUR_SECRET_REPO` | `README.md`、`docs/README.zh-CN.md` 的 CNB 密钥仓库 `imports` 示例 | **保留**,是给读者填自己的值 |

检查命令(`.github/workflows/` 里的 `uses:` 写的是 `./`,不引用本仓库坐标,所以能直接 grep):

```sh
# 运行时/发布面不应再出现占位符,期望输出 clean
grep -rn 'YOUR_GITHUB' action.yml package.json .github/ || echo 'clean'
# 全仓只剩 README 密钥仓库示例里的两个 CNB 占位符,期望 2
grep -rn 'YOUR_CNB_USER\|YOUR_SECRET_REPO' --include='*.md' . | grep -v docs/spec/ | wc -l
```

> 早期版本的替换命令写成 `sed 's|YOUR_GITHUB_USER/YOUR_GITHUB_REPO|<user>/<repo>|g'`,
> 会连带改掉 `docs/spec` 里计划内容的示例,把「计划文档」变成「既成事实」,已废弃。
> 后续改动请按文件逐个确认,不要用全局 sed。

---

## 二、双平台架构决策

### 2.1 结论:一个仓库,GitHub 为源,CNB 为自动镜像

**为什么不用两个仓库:**

| 论据 | 说明 |
|---|---|
| 产物是同一个文件 | `dist/index.js` 在两个平台字节相同,差异仅约 30 行调用契约 |
| 双仓库必然漂移 | 每次发版需在两处重建、打 tag、推送;ncc 产物在不同环境下可能有字节差异,漏一处即导致同版本号行为不一致 |
| 单人维护成本 | 仓库数翻倍意味着发版、版本号、CHANGELOG、依赖安全更新全部翻倍 |
| 真实成本在文档 | 平台专有语法(`secrets.GITHUB_TOKEN` 49 处、`github.repository_owner` 25 处、`actions/checkout` 16 处)与仓库数量无关 |

### 2.2 同步方向的修正(重要)

最初设想「在 `.cnb.yml` 中用 git-sync 从 GitHub 拉取」。**经查证官方文档后此方案已废弃**:

`cnb/plugins/tencentcom/git-sync` 的「GitHub → CNB」用法要求在 **GitHub Actions** 中以
`uses: docker://tencentcom/git-sync` 运行;CNB 侧只能使用 `sync_mode: pull` 配合
`crontab` **定时拉取**(存在最长 24 小时延迟)。

因此最终方案:

```
GitHub(源)
├── .github/workflows/sync-cnb.yml   ← 主动推送到 CNB(push 即同步,无延迟)
└── .cnb.yml                          ← 随源码镜像过去,仅承担 CI 校验职责
```

### 2.3 CNB 消费模型的澄清

**CNB 的插件是 Docker 镜像,不存在 `uses: owner/repo@ref` 式的仓库引用。**
(依据:插件市场中所有条目均为 `cnbcool/*` / `tencentcom/*` 等镜像坐标)

这意味着 CNB 用户**无法**像 GitHub 用户那样引用本仓库。实际消费方式是:

```sh
curl -fsSL -o dist.js https://raw.githubusercontent.com/<user>/<repo>/v1.0.0/dist/index.js
node dist.js <GITHUB_USERNAME>
```

完整的 CNB 流水线示例见 [`README.md`](../../README.md#how-to-use-cnb) 与
[`docs/README.zh-CN.md`](../../docs/README.zh-CN.md)。

### 2.4 保留 MIT 署名的处理方式

| 位置 | 处理 | 理由 |
|---|---|---|
| `LICENSE:3` `(c) 2021 SATO, Yoshiyuki` | **完全不动** | MIT 的法定要求 |
| `README.md` 版权行 | **保留**,并追加维护者说明 | 兼顾署名与接管声明 |
| `action.yml` `author` | 更新为 `h1s97x` | 项目已由新维护者接管,继续挂原作者会造成误导 |
| 11 份 README 顶部 | 新增 `> [!IMPORTANT]` 衍生声明块 | 明确版本基线、上游链接、非官方声明 |
| `branding` 块 | **不动** | 保持 GitHub Marketplace 显示一致 |

### 2.5 保留项目名

`github-profile-3d-contrib` **未更名**。原因:该名称已被大量存量用户在
`uses: yoshi389111/github-profile-3d-contrib@latest` 中引用,更名会使所有存量配置失效,
属于无收益的破坏性变更。

**若后续确需更名**,切换步骤:

1. 在 GitHub 上重命名仓库(GitHub 会自动重定向旧地址)
2. 更新 `package.json` 的 `name` / `repository` / `homepage` / `bugs`
3. 全局替换 11 份 README 与 `action.yml` 中的 `uses:` 坐标
4. **保留旧仓库不删除**,以免既有引用立即失效
5. 在 `CHANGELOG.md` 中以 `Breaking changes` 形式公告坐标变更
6. 在旧仓库 README 顶部加一行指向新仓库的说明

---

## 三、已执行的改动清单

### 3.1 基础设施保护

| 文件 | 动作 | 内容 |
|---|---|---|
| `.gitattributes` | NEW | `dist/** linguist-generated=true` + `dist/** -diff` |
| `.github/workflows/ci.yml` | NEW | `dist-consistency`(阻塞)+ `quality`(观察期)两个 job |
| `.github/workflows/release.yml` | NEW | 发布校验:tag 与版本号一致 + 产物可复现 |
| `.github/workflows/sync-cnb.yml` | NEW | GitHub → CNB 自动镜像 |
| `.cnb.yml` | NEW | CNB 侧 CI:构建并校验镜像产物一致性 |
| `.github/workflows/build.yml` | MODIFY | `npm install` → `npm ci`;新增 `concurrency`;无变化时跳过提交 |
| `.github/workflows/latest-branch.yml` | MODIFY | 仅补充设计决策与风险记录,逻辑未变 |

**关于 `.gitattributes` 的两个属性:**

- `-diff` —— 未来同步上游时,若双方都改过 `src/`,`dist/index.js` 必然冲突且无法手动合并。
  标记后冲突时只显示「二进制文件有差异」,避免 6.5 MB 文本涌入终端。
  **正确做法:先合 `src/`,再本地 `npm run build` 重新生成,永不手动合并。**
- `linguist-generated` —— 让 GitHub 语言统计不把 6.5 MB 打包产物计入。

**刻意未加** `* text=auto eol=lf`:该规则会触发全仓库历史重写,而 `dist/` 的 6.5 MB 在归一化时会产生巨大 diff,风险远大于收益。

**关于 CI 的两个 job 分级:**

| job | 状态 | 理由 |
|---|---|---|
| `dist-consistency` | **阻塞** | 用户执行的是已提交的产物而非源码,这是防供应链问题的核心闸门,高置信度 |
| `quality` | `continue-on-error: true` | 接管前未在干净环境验证过存量代码的 lint / 类型 / 测试状态。一次性设为阻塞会导致 CI 长期红灯而无人知晓根因 |

提升 `quality` 为阻塞的前置条件:本地跑通 `npm run lint`、`npm run check-types`、`npm test`
并确认存量失败项已清零。

**关于 CI 未使用 sparse-checkout:**

理论上可用 sparse-checkout 排除 `dist/` 加速 checkout(每次省 6.5 MB),但那会使工作区中不存在
`dist/`,导致 `git diff --exit-code dist/` 把「全部文件新增」误判为不一致。
**接受 6.5 MB 的 checkout 成本** —— 约数秒,远小于误判的代价。

### 3.2 身份接管

| 文件 | 改动 |
|---|---|
| `package.json` | `author` → `h1s97x <Yang1297656998@outlook.com>`;新增 `repository` / `homepage` / `bugs`;`version` → `1.0.0` |
| `action.yml` | `author` → `h1s97x`;补充两条「刻意不做」的说明(`inputs` / `post` 钩子) |
| `README.md` | 10 处坐标替换;新增衍生声明块;平台选择指引;新增完整 CNB 章节;版权行追加维护者说明 |
| `docs/README.zh-CN.md` | 9 处坐标替换;新增完整 CNB 章节(中文) |
| 其余 9 份翻译 | 9~10 处坐标替换;新增本地化衍生声明块;末尾加指向英文版 CNB 章节的指针 |
| `EXAMPLES.md` | 1 处坐标替换;新增「仅限 GitHub Actions」提示块 |
| `CHANGELOG.md` | 新增 `[1.0.0] - 2026-10-03` 条目,含 `Breaking changes` 与 `Known issues` |

**未改动的字段及理由:**

| 字段 | 理由 |
|---|---|
| `package.json` `name` | 改名会破坏存量 `uses:` 引用 |
| `package.json` `scripts` | 避免与既有 `clean` 脚本等行为产生意外 |
| `action.yml` `name` / `description` / `branding` | 保持 GitHub Marketplace 显示一致 |
| `action.yml` `runs` | 不加 `inputs`(属阶段 3);不加 `post`(无 `dist/cleanup.js` 会导致 Action 失败) |

### 3.3 CNB 事实核查结论

以下三项在制定计划时标记为「未验证」,现已通过官方文档确认:

| 待确认项 | 结论 | 依据 |
|---|---|---|
| CNB 能否引用用户仓库作为 action | **不能**。插件模型是 Docker 镜像,无仓库引用机制 | 插件市场所有条目均为镜像坐标 |
| `git-sync` 的部署位置 | 「GitHub → CNB」需在 **GitHub Actions** 中以 `uses: docker://tencentcom/git-sync` 运行;CNB 侧只能用 `sync_mode: pull` + `crontab` 定时拉取 | [git-sync README](https://cnb.cool/cnb/plugins/market/-/git/raw/main/plugins/tencentcom/git-sync/README.md) |
| CNB 的 secrets 机制 | **密钥仓库** + `imports` 注入,**无** `${{ secrets.* }}` | [环境变量文档](https://docs.cnb.cool/zh/build/env) |

**其他已确认事实:**

- 流水线结构:触发分支 → 触发事件 → Pipeline → Stage → **Job**
- Job 层字段:`image`(插件镜像或脚本环境)、`settings`(插件参数)、`script`、`env`、`imports`
- Pipeline 层构建镜像:`docker: { image: node:24 }`
- 定时触发:`"crontab: 0 18 * * *"` 作为触发键
- 内置 git 任务仅有 PR / Issue / Release 管理(`git:reviewer`、`git:auto-merge`、`git:release` 等),
  **没有**「提交并推送文件」的内置任务 —— 该步骤需用 `script` + 原生 `git` 命令
- 仓库上下文变量:`CNB_REPO_SLUG`(形如 `owner/repo`)、`CNB_BRANCH`、`CNB_COMMIT`、`CNB_TOKEN`
- `$CNB_TOKEN` 等内置令牌在日志中**自动打码**

**降级路径说明:** 若将来 CNB 提供了仓库引用型 action 机制,消费方式可简化为一行 `uses:`,
届时需同步更新 `README.md` 与 `docs/README.zh-CN.md` 的 CNB 章节。

---

## 四、未完成事项(交接给后续阶段)

### 4.1 遗留缺陷

以下缺陷在 `0.9.3` 中即已存在,本次为纯基础设施改动,**刻意未一并修复**。
完整的「失败现象 → 根因 → 修复后行为」分析见 [02-phase1-correctness.md](./02-phase1-correctness.md)。

| 编号 | 缺陷 | 影响 | 优先级 |
|---|---|---|---|
| B1 | 设置 JSON 零校验,`type` 拼写错误时**静默产出全透明 SVG 且退出码 0** | 最高 —— 用户完全无从察觉 | P0 |
| B3 | `MAX_REPOS` 只是分页停止阈值而非仓库数上限,star/fork **可能虚高** | 数据失真 | P0 |
| B2 | 空贡献日历导致 `TypeError` 崩溃 | 崩溃 | P0 |
| B5 | API 错误时 dump 完整响应,可能泄露私有仓库名 | 隐私 | P0 |
| B4 | `fileName` 未做路径校验 | 加固缺口 | P0 |
| B6 | 重复属性、冗余 `mkdirSync`、数值无范围校验、`testMatch` 正则未转义 | 代码质量 | P2 |

### 4.2 向上游提交 PR 的建议

**B1 值得单独向上游提 PR。** 理由:

- 上游作者态度开放 —— CHANGELOG 显示已合并多个外部贡献(`#148` @K-H-A-L-I-D、`#129` @SoulBreathe、
  `#154`、`#136`、`#131`、`#132`、`#135`、`#126`、`#119`、`#116`)
- B1 是完全静默的失败,属于上游难以自行发现的缺陷类型
- 修复不涉及架构变更,PR 体积小、可审查

PR 描述应包含:

1. 复现步骤:构造 `"type": "norml"` 的 settings JSON,运行后检查产物是否全透明且退出码为 0
2. 根因分析:`settings-reader.ts` 的 `JSON.parse(...) as type.Settings` 是纯类型断言;
   未命中的 `settings.type` 判定导致既不生成柱子的 class,也不生成对应 CSS 规则
3. 影响面:`create-svg.ts:27,30`、`create-3d-contrib.ts:253-261,283-291,329-337`、
   `create-css-colors.ts:42,55,107,134`
4. 建议方案:引入 JSON Schema 校验,或至少校验 `type` 字段的枚举值

**注意**:不要把架构重构一并提上去。阶段 2 会删除 5 个文件并重命名大部分模块,
上游几乎不可能接受,这属于分叉内容。

### 4.3 长期演进阶段

见 [README](./README.md) 的阶段路线图。阶段分类:

| 阶段 | 分类 | 说明 |
|---|---|---|
| 0 安全网 | **接管已部分完成** | CI 闸门与 `dist/` 保护本次已落地;渲染层快照测试仍待补 |
| 1 止血与正确性 | 后续执行 | 6 个遗留缺陷 + JSON Schema + 错误码体系 |
| 2 架构重构 | 长期演进 | 渲染器注册表 + `LayoutModel`;永久分叉,不可回流上游 |
| 3 配置体系与 API 层 | 长期演进 | `config` 分层、`action.yml` inputs、`GitHubClient` |
| 4 性能与体验打磨 | 长期演进 | 依赖瘦身(6.7 MB → 1.5~2 MB)、`LayoutOptions`、`l10n`、可访问性 |
| 5 进阶能力 | 探索性 | PNG 导出、API 缓存、多用户聚合(需走 RFC) |

---

## 五、已知风险与设计决策

### 5.1 `latest` 分支的强制推送

`latest-branch.yml` 在 Release 发布时执行:

```sh
git branch -f latest ${{ github.event.release.tag_name }}
git push origin latest --force
```

**风险**:`--force` 会重写 `latest` 分支的提交历史。若有人把 `latest` 的某个提交作为基线做了
分支或 fork,强制推送后其历史将与新版本分叉。

**当前判断**:接管阶段仓库尚无外部引用 `latest`,该风险可控,故保留此设计以兼容存量
`@latest` 引用。同时应通过 semver tag 引导用户 pin 具体版本。

**取消该策略的条件**:先在 README 中通知用户迁移至 semver tag,再移除本工作流。

### 5.2 同步依赖强制推送

`sync-cnb.yml` 使用 `PLUGIN_FORCE: "true"`。原因:`latest` 分支由 `latest-branch.yml` 强制推送更新,
若镜像侧不 force,会因非快进而拒绝,导致两个平台状态漂移。

### 5.3 `dist/` 冲突的正确处理

若未来从上游同步代码时 `dist/index.js` 冲突:

1. **不要**尝试手动合并
2. 接受 `src/` 的合并结果
3. 本地执行 `npm ci && npm run build`
4. 提交重新生成的 `dist/`

`.gitattributes` 中的 `-diff` 会让冲突提示简化为「二进制文件有差异」,这是预期行为。

### 5.4 CNB 凭据

`sync-cnb.yml` 需要 GitHub 仓库 Secret `CNB_TOKEN`(CNB 访问令牌,写入权限)。
CNB 仓库地址是公开信息,直接写入工作流;凭据绝不进仓库。

---

## 六、验证清单

- [ ] `git grep -n 'yoshi389111/github-profile-3d-contrib' -- ':!dist'` 的命中项只剩:11 份 README 的衍生声明、
      `README.md` 上游链接行、`CHANGELOG.md` 的 `Breaking changes` 与本文档、`src/create-3d-contrib.ts` 的
      上游 issue 引用;`docs/spec/03` 的验收项见下一行
- [ ] 自查脚本 `git grep -c 'yoshi389111/github-profile-3d-contrib'` 在**指定文件**上返回 0,
      而全仓 grep 只返回上面那批(见 [阶段 2 验收](./03-phase2-architecture.md#十验收标准))
- [ ] `git diff --stat HEAD~1 -- src/ spec/ sample-settings/ tsconfig.json .eslintrc.js` 输出为空
      (仅适用于首次接管提交;阶段 1 起 `src/` 与 `spec/` 有意改动,改用「16 份快照字节未变」验收)
- [ ] `LICENSE` 未被修改
- [ ] `dist/` 仍被 git 追踪(`git ls-files dist/` 返回 3 个文件)
- [ ] `npm ci && npm run build` 后 `git diff --exit-code -- dist/` 通过
- [x] 面向用户的 `YOUR_GITHUB_*` 占位符已替换;`docs/spec` 计划内容中的占位符**按第一节豁免**
- [ ] `package-lock.json` 的 `version` 与 `package.json` 一致(由 CI `release.yml` 与 `quality` 检查)
- [ ] 11 份 README 的衍生声明块渲染正常(引用块与后续内容之间有空行)
- [ ] `.cnb.yml` 与 `ci.yml` 的产物一致性判定逻辑等价
