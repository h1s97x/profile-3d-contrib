# GitHub Profile 3D Contrib

![svg](https://raw.githubusercontent.com/h1s97x/github-profile-3d-contrib/main/docs/demo/profile-gitblock.svg)

> [!IMPORTANT]
> **本仓库在 CNB 独立维护。**
>
> - 主仓:[h1s97x/plugins/profile-3d-contrib](https://cnb.cool/h1s97x/plugins/profile-3d-contrib)
> - 原始作品:[yoshi389111/github-profile-3d-contrib](https://github.com/yoshi389111/github-profile-3d-contrib),`v0.9.3`
> - 维护者:`h1s97x`
> - 许可证:MIT —— 原作者著作权归 SATO Yoshiyuki 所有(见 [LICENSE](../LICENSE))
>
> 本项目衍生自原始作品,与原作者无隶属或背书关系。开发独立于原项目,不再与其同步。

<!-- 语言代码顺序（英语除外） -->
[English (en)](../README.md) |
[Deutsch (de)](README.de.md) |
[Español (es)](README.es.md) |
[Français (fr)](README.fr.md) |
[日本語 (ja)](README.ja.md) |
[한국어 (ko)](README.ko.md) |
[Português (pt-BR)](README.pt-br.md) |
[Português (pt)](README.pt.md) |
[Русский (ru)](README.ru.md) |
简体中文 (zh-CN) |
[繁體中文 (zh-TW)](README.zh-TW.md) |

> [!NOTE]
> 此翻译由机器翻译生成。
> 它可能包含错误或不自然的表达。
> 欢迎为改进翻译做出贡献！

## 概述

此 GitHub Action 会在您的 3D 个人资料图片上生成 GitHub 贡献日历。

## 如何使用（GitHub Actions）- 基本

此 GitHub Action 会生成您的 GitHub 个人资料 3D 贡献日历并提交到您的仓库。
添加 GitHub Action 后，工作流会每天自动运行一次。
您也可以手动触发工作流。

### 步骤 1. 创建特殊的个人资料仓库

在 GitHub 上创建一个与您的用户名相同名称的仓库。

- 例如，如果用户名为 `octocat`，则创建名为 `octocat/octocat` 的仓库。
- 参考：[管理个人资料自述文件](https://docs.github.com/zh/account-and-profile/how-tos/setting-up-and-managing-your-github-profile/customizing-your-profile/managing-your-profile-readme)

在此仓库中，按照以下步骤操作。

### 步骤 2. 创建工作流文件

创建如下工作流文件。

- `.github/workflows/profile-3d.yml`

```yaml:.github/workflows/profile-3d.yml
name: GitHub-Profile-3D-Contrib

on:
  schedule: # 03:00 JST == 18:00 UTC
    - cron: "0 18 * * *"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest
    name: generate-github-profile-3d-contrib
    steps:
      - uses: actions/checkout@v5
      - uses: h1s97x/github-profile-3d-contrib@latest
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          USERNAME: ${{ github.repository_owner }}
      - name: Commit & Push
        run: |
          git config user.name github-actions
          git config user.email github-actions@github.com
          git add -A .
          if git commit -m "generated"; then
            git push
          fi
```

> [!NOTE]
> 您可以更改 GitHub 设置以包含来自私有仓库的贡献。要更改此设置，请点击标准贡献日历右上角的 `Contribution settings`，或点击屏幕右上角的头像，选择 `Settings` ⇒ `Public profile` ⇒ `Contributions & Activity`，并勾选 `Include private contributions on my profile`。
>
> 如果您希望包含来自私有仓库的额外活动，请将个人访问令牌注册为密钥，并在工作流文件中设置为 `GITHUB_TOKEN` 环境变量。但在大多数情况下，默认的 `secrets.GITHUB_TOKEN` 已足够。

默认情况下，计划每天运行一次。
您可以根据需要更改计划时间。

这会将工作流添加到您的仓库中。

#### 环境变量

示例中只指定了 `GITHUB_TOKEN` 和 `USERNAME` 环境变量，但您可以指定以下环境变量：

- `GITHUB_TOKEN` : （必需）访问令牌
- `USERNAME` : （必需）目标用户名（或通过参数指定）。
- `MAX_REPOS` : （可选）最大仓库数，默认 100 - 自 v0.2.0 起
- `SETTING_JSON` : （可选）设置 json 文件路径。详情请参见仓库中的 `sample-settings/*.json` 和 `src/type.ts`。- 自 v0.6.0 起
- `GITHUB_ENDPOINT` : （可选）Github GraphQL 端点。例如，如果您希望基于公司 GitHub Enterprise 活动而不是 GitHub.com 创建贡献日历，请设置此环境变量。例如：`https://github.mycompany.com/api/graphql` - 自 v0.8.0 起
- `YEAR` : （可选）如需生成往年日历，请指定年份。此项主要用于命令行运行工具时指定。- 自 v0.8.0 起

#### 关于 `GITHUB_TOKEN`

示例中设置为 `GITHUB_TOKEN` 环境变量的 `secrets.GITHUB_TOKEN` 是 GitHub 自动创建的特殊访问令牌。

- GitHub 文档: [在工作流中使用 GITHUB_TOKEN 进行身份验证](https://docs.github.com/zh/actions/tutorials/authenticate-with-github_token)

如果您只想为公共仓库生成贡献日历，请使用此值。
无需手动创建密钥。

此外，如果您希望在贡献日历中包含私有仓库的活动，请在个人资料设置的 "Public profile" 部分的 "Profile settings" 中勾选 "Include private contributions on my profile"。

如果还希望包含来自私有仓库的额外活动信息，请创建具有适当权限的访问令牌。
将该访问令牌注册为任意名称的密钥（例如 `MY_PERSONAL_ACCESS_TOKEN`）。
但请注意，用户创建的密钥不能以 `GITHUB_` 开头。

- GitHub 文档: [机密](https://docs.github.com/zh/actions/concepts/security/secrets)

将该密钥设置为 `GITHUB_TOKEN` 环境变量的值。

```diff
          env:
-           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+           GITHUB_TOKEN: ${{ secrets.MY_PERSONAL_ACCESS_TOKEN }}
            USERNAME: ${{ github.repository_owner }}
```

#### 关于计划时间

示例中设置为 UTC 时间 18:00。
这是因为作者本地时间为日本午夜。

```yaml
on:
  schedule: # 03:00 JST == 18:00 UTC
    - cron: "0 18 * * *"
```

您可以根据需要更改为任意时间。
建议设置为本地时间的午夜（约凌晨 3 点）。
但请注意，时间必须以 UTC 指定。

### 步骤 3. 手动运行此 GitHub Action

首次运行时，请手动运行此工作流。

- `Actions` -> `GitHub-Profile-3D-Contrib` -> `Run workflow`

个人资料图片会生成在以下路径：

- `profile-3d-contrib/profile-green-animate.svg`
- `profile-3d-contrib/profile-green.svg`
- `profile-3d-contrib/profile-season-animate.svg`
- `profile-3d-contrib/profile-season.svg`
- `profile-3d-contrib/profile-south-season-animate.svg`
- `profile-3d-contrib/profile-south-season.svg`
- `profile-3d-contrib/profile-night-view.svg`
- `profile-3d-contrib/profile-night-green.svg`
- `profile-3d-contrib/profile-night-rainbow.svg`
- `profile-3d-contrib/profile-gitblock.svg`

如果您指定了 `SETTING_JSON` 环境变量且 json 文件中未包含 `fileName` 属性，则会生成以下图片：

- `profile-3d-contrib/profile-customize.svg`

您可以像下面这样在 README.md 中使用这些图片。

示例：绿色版本

![svg](https://raw.githubusercontent.com/h1s97x/github-profile-3d-contrib/main/docs/demo/profile-green-animate.svg)

示例：季节版本（北半球）

![svg](https://raw.githubusercontent.com/h1s97x/github-profile-3d-contrib/main/docs/demo/profile-season-animate.svg)

示例：季节版本（南半球）

![svg](https://raw.githubusercontent.com/h1s97x/github-profile-3d-contrib/main/docs/demo/profile-south-season-animate.svg)

示例：夜景版本

![svg](https://raw.githubusercontent.com/h1s97x/github-profile-3d-contrib/main/docs/demo/profile-night-view.svg)

示例：夜间绿色版本

![svg](https://raw.githubusercontent.com/h1s97x/github-profile-3d-contrib/main/docs/demo/profile-night-green.svg)

示例：夜间彩虹版本

![svg](https://raw.githubusercontent.com/h1s97x/github-profile-3d-contrib/main/docs/demo/profile-night-rainbow.svg)

示例：git block 版本

![svg](https://raw.githubusercontent.com/h1s97x/github-profile-3d-contrib/main/docs/demo/profile-gitblock.svg)

### 步骤 4. 将图片添加到 README.md

在您的 README 文件中添加生成图片的路径。

示例：

```md
![](./profile-3d-contrib/profile-green-animate.svg)
```

## 如何使用（GitHub Actions）- 高级示例

- [更多信息请参见 EXAMPLES.md](../EXAMPLES.md)

## 如何使用（CNB）

生成器本身与平台无关 —— 它只读取环境变量,不依赖 `@actions/*`。**同一份** `dist/index.js` 在两个平台上都能运行,差别只在于调用方式。

> [!IMPORTANT]
> **CNB 没有 `uses: owner/repo@ref` 这套机制。** 在 CNB 中,流水线插件是 Docker 镜像,无法像 GitHub Actions 那样引用一个仓库作为 action。因此使用方式正好相反:由你的 CNB 流水线下载 `dist/index.js` 并用 Node 执行。
>
> 如果你只用 GitHub Actions,本节可以跳过。

### 第 1 步. 在 CNB 上创建个人资料仓库

创建一个与你的 CNB 账号同名的仓库,并确认你希望统计贡献的 GitHub 账号已设置为你的 GitHub 个人主页。

> [!NOTE]
> 生成的文件会提交到你的 **CNB** 仓库,但贡献数据始终来自 **GitHub** —— 生成器查询的是 GitHub GraphQL API,因此这里依然需要 `GITHUB_TOKEN`。

### 第 2 步. 准备密钥仓库

CNB 不使用 `${{ secrets.* }}`。密钥保存在专用的[密钥仓库](https://docs.cnb.cool/zh/repo/secret)中,再通过 `imports` 注入。

在密钥仓库中创建 `envs.yml`:

```yaml title="envs.yml（位于密钥仓库中）"
GITHUB_TOKEN: ghp_xxxxxxxxxxxxxxxxxxxx
```

### 第 3 步. 添加流水线

在你的个人资料仓库中添加 `.cnb.yml`:

```yaml title=".cnb.yml"
main:
  "crontab: 0 18 * * *": # 03:00 JST == 18:00 UTC
    - name: generate
      docker:
        image: node:24
      imports:
        - https://cnb.cool/YOUR_CNB_USER/YOUR_SECRET_REPO/-/blob/main/envs.yml
      stages:
        - name: fetch
          jobs:
            - name: 下载生成器
              script: |
                mkdir -p .tool
                curl -fsSL -o .tool/dist.js \
                  https://raw.githubusercontent.com/h1s97x/github-profile-3d-contrib/v1.0.0/dist/index.js

        - name: generate
          jobs:
            - name: 运行生成器
              env:
                # 对应 GitHub Actions 上下文变量的 CNB 变量。
                # CNB_REPO_SLUG 形如 "你的账号/你的仓库"，取第一段。
                USERNAME: ${CNB_REPO_SLUG}
              script: |
                node .tool/dist.js "$USERNAME"

        - name: commit
          jobs:
            - name: 提交并推送
              script: |
                git config user.name "cnb-bot"
                git config user.email "cnb-bot@users.noreply.cnb.cool"
                git add -A profile-3d-contrib
                if git diff --cached --quiet; then
                  echo "无变化，跳过提交。"
                else
                  git commit -m "generated"
                  git push origin HEAD:$CNB_BRANCH
                fi
```

生成器也支持指定设置文件与输出目录:

```sh
node .tool/dist.js "$USERNAME"        # 目标用户名（或直接设置 USERNAME 环境变量）
```

### 第 4 步. 与 GitHub Actions 的差异

| 主题 | GitHub Actions | CNB |
|---|---|---|
| 引用方式 | `uses: h1s97x/github-profile-3d-contrib@v1.0.0` | 在 `script` 任务中下载 `dist/index.js` |
| 密钥 | `${{ secrets.GITHUB_TOKEN }}` | 密钥仓库 + `imports` |
| 仓库上下文 | `${{ github.repository_owner }}` | `${{ CNB_REPO_SLUG }}` |
| 流水线配置 | `.github/workflows/*.yml` | `.cnb.yml`（Pipeline / Stage / Job 三层） |
| 定时触发 | `on.schedule.cron` | `"crontab: ..."` 触发键 |
| 检出代码 | `actions/checkout@v5` | 自动（流水线在你的仓库中运行） |

> [!NOTE]
> `USERNAME` 必须是你的 **GitHub** 用户名,因为贡献数据来自 GitHub。
> 只有当你的 CNB 账号名与 GitHub 用户名相同时,`${CNB_REPO_SLUG}` 才正好等于 GitHub 用户名 —— 否则请显式传入 GitHub 用户名。

### 在 CNB 上构建本项目

本仓库中的 `.cnb.yml` 是项目自身的 CI,直接在 CNB 主仓运行,用于校验已提交的 `dist/` 是否仍与源码一致:

- [CNB 流水线语法](https://docs.cnb.cool/zh/build/grammar)
- [环境变量与密钥](https://docs.cnb.cool/zh/build/env)

## 如何使用（本地）

将 `GITHUB_TOKEN` 环境变量设置为您的个人访问令牌。

```sh
export GITHUB_TOKEN=XXXXXXXXXXXXXXXXXXXXX
```

用您的 GitHub 用户名或目标用户名替换 `USER_NAME`，运行以下命令。

```sh
node_modules/.bin/ts-node src/index.ts USER_NAME
```

或

```sh
npm run build
node . USER_NAME
```

## 许可证

&copy; 2021 SATO Yoshiyuki. 采用 MIT 许可证。
