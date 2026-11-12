# GitHub Profile 3D Contrib

![svg](https://raw.githubusercontent.com/h1s97x/github-profile-3d-contrib/main/docs/demo/profile-gitblock.svg)

> [!IMPORTANT]
> **This repository is independently maintained on CNB.**
>
> | | |
> |---|---|
> | Canonical repository | [h1s97x/plugins/profile-3d-contrib](https://cnb.cool/h1s97x/plugins/profile-3d-contrib) |
> | Original work | [yoshi389111/github-profile-3d-contrib](https://github.com/yoshi389111/github-profile-3d-contrib), `v0.9.3` |
> | Maintainer | `h1s97x` |
> | License | MIT (see [LICENSE](./LICENSE)) |
>
> This project is derived from the original work and is not affiliated with or endorsed by the
> original author. Copyright of the original work remains with SATO Yoshiyuki — see [LICENSE](./LICENSE).
> Development is independent of the upstream project: no upstream synchronization is performed.

<!-- Platform picker -->
**Platform:** [GitHub Actions](#how-to-use-github-actions---basic) | [CNB](#how-to-use-cnb) | [Local](#how-to-use-local)

<!-- Language code order (except English) -->
English (en) |
[Deutsch (de)](docs/README.de.md) |
[Español (es)](docs/README.es.md) |
[Français (fr)](docs/README.fr.md) |
[日本語 (ja)](docs/README.ja.md) |
[한국어 (ko)](docs/README.ko.md) |
[Português (pt-BR)](docs/README.pt-br.md) |
[Português (pt)](docs/README.pt.md) |
[Русский (ru)](docs/README.ru.md) |
[简体中文 (zh-CN)](docs/README.zh-CN.md) |
[繁體中文 (zh-TW)](docs/README.zh-TW.md) |

<!--
> [!NOTE]
> This translation was generated with machine translation.
> It may contain errors or unnatural expressions.
> Contributions to improve the translation are welcome!
-->

## Overview

This GitHub Action creates a GitHub contribution calendar on a 3D profile image.

The rendering logic is platform-agnostic: it reads only `process.env` and has no dependency on
`@actions/*` or `@octokit/*`. One `Dockerfile` builds the image used by both GitHub Actions
(container action) and CNB (pipeline plugin) — only the invocation contract differs. The repository
no longer commits a prebuilt `dist/`. See [How to use (CNB)](#how-to-use-cnb).


## How to use (GitHub Actions) - Basic

This GitHub Action generates your github profile 3d contribution calendar and commits to your repo.
After adding the GitHub Action, the workflow runs automatically once a day.
You can also trigger the workflow manually.

### Step 1. Create special profile repository

Create a repository on GitHub with the same name as your username.

- For example, if the username is `octocat`, create a repository named `octocat/octocat`.
- See also: [Managing your profile README](https://docs.github.com/en/account-and-profile/how-tos/setting-up-and-managing-your-github-profile/customizing-your-profile/managing-your-profile-readme)

In this repository, follow the steps below.

### Step 2. Create workflow file

Create a workflow file like the one below.

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
> You can change your GitHub settings to include contributions from private repositories. To change this setting, click `Contribution settings` in the top right of the standard contribution calendar, or click your icon in the top right of the screen, select `Settings` ⇒ `Public profile` ⇒ `Contributions & Activity`, and check `Include private contributions on my profile`.
>
> If you want to include additional activities from private repositories, register a personal access token as a secret and set it to the `GITHUB_TOKEN` environment variable in the workflow file. However, in most cases the default `secrets.GITHUB_TOKEN` is sufficient.

The schedule is set to run once a day by default.
You can change the scheduled time as you like.

This will add the workflow to your repository.

#### Environment variables

In the sample, only `GITHUB_TOKEN` and `USERNAME` are specified as environment variables, but you can specify the following environment variables:

- `GITHUB_TOKEN` : (required for GitHub data) access token
- `USERNAME` : (required) target username (or specify with an argument).
- `MAX_REPOS` : (optional, **GitHub data source only**) max repositories, default 100 - since ver. 0.2.0
- `SETTING_JSON` : (optional) path to a settings JSON file. For ready-to-copy pipeline snippets (flat `settings:` or inline `settings_json`), see [`docs/demo/pipelines/`](./docs/demo/pipelines/). - since ver. 0.6.0
- `GITHUB_ENDPOINT` : (optional) Github GraphQL endpoint. For example, if you want to create a contribution calendar based on your company's GitHub Enterprise activity instead of GitHub.com, set this environment variable. e.g. `https://github.mycompany.com/api/graphql` - since ver. 0.8.0
- `YEAR` : (optional) For past calendars, specify the year. This is intended to be specified when running the tool from the command line. - since ver. 0.8.0
- `PLATFORM` : (optional) `github` (default) or `cnb` — selects the contribution data source. When unset, a present `CNB_TOKEN` or `CNB_ACCESS_TOKEN` means `cnb`, otherwise `github`. Any other value fails with `E_PLATFORM_INVALID`.
- `CNB_TOKEN` : (required for CNB data) CNB access token with the `account-engage:r` (read) scope. CNB pipelines inject it automatically, but that temporary token can only see public repositories.
- `CNB_ACCESS_TOKEN` : (optional) access token with private-repository access. Takes precedence over `CNB_TOKEN`; inject it from a secret repository via `imports` (see the CNB section below).
- `CNB_API_ENDPOINT` : (optional) CNB OpenAPI endpoint, default `https://api.cnb.cool`. Also injected by CNB pipelines.

#### About `GITHUB_TOKEN`

The `secrets.GITHUB_TOKEN` set in the `GITHUB_TOKEN` environment variable in the sample is a special access token automatically created by GitHub.

- GitHub Docs: [Use GITHUB_TOKEN for authentication in workflows](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)

If you want to generate a contribution calendar for public repositories only, use this value.
There is no need to create a secret manually.

Also, if you want to include activity in your private repositories in your contribution calendar, check "Include private contributions on my profile" in the "Profile settings" section of "Public profile" in your profile settings.

Furthermore, if you want to include additional activity information from private repositories, create an access token with the appropriate permissions.
Register that access token as a secret with any name you like (For example, `MY_PERSONAL_ACCESS_TOKEN`).
However, please note that user-created secrets cannot start with `GITHUB_`.

- GitHub Docs: [Secrets](https://docs.github.com/en/actions/concepts/security/secrets)

Set that secret as the value of the `GITHUB_TOKEN` environment variable.

```diff
          env:
-           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+           GITHUB_TOKEN: ${{ secrets.MY_PERSONAL_ACCESS_TOKEN }}
            USERNAME: ${{ github.repository_owner }}
```

#### About the time to schedule

In the sample, it is set to start at 18:00 UTC.
This is because it will run at midnight JST, which is the author's local time.

```yaml
on:
  schedule: # 03:00 JST == 18:00 UTC
    - cron: "0 18 * * *"
```

You can change it to any time you like.
We recommend midnight (around 3am) your local time.
However, please note that the time must be specified in UTC.

### Step 3. Manually run this GitHub Action

The first time, run this workflow manually.

- `Actions` -> `GitHub-Profile-3D-Contrib` -> `Run workflow`

The profile images are generated at the following paths:

- `profile-3d-contrib/profile-green.svg`

If you specify the `SETTING_JSON` environment variable without a `fileName` property in the json file, the following image will be generated:

- `profile-3d-contrib/profile-customize.svg`

The gallery below shows the optional built-in themes (static previews stored in this repository).
Pick one with `settings.theme`, or use `theme: all` to generate them all — a default run produces
only `profile-green.svg`.

Example: green version

![svg](https://raw.githubusercontent.com/h1s97x/github-profile-3d-contrib/main/docs/demo/profile-green-animate.svg)

Example: season version (Northern Hemisphere.)

![svg](https://raw.githubusercontent.com/h1s97x/github-profile-3d-contrib/main/docs/demo/profile-season-animate.svg)

Example: season version (Southern Hemisphere.)

![svg](https://raw.githubusercontent.com/h1s97x/github-profile-3d-contrib/main/docs/demo/profile-south-season-animate.svg)

Example: night view version

![svg](https://raw.githubusercontent.com/h1s97x/github-profile-3d-contrib/main/docs/demo/profile-night-view.svg)

Example: night green version

![svg](https://raw.githubusercontent.com/h1s97x/github-profile-3d-contrib/main/docs/demo/profile-night-green.svg)

Example: night rainbow version

![svg](https://raw.githubusercontent.com/h1s97x/github-profile-3d-contrib/main/docs/demo/profile-night-rainbow.svg)

Example: git block version

![svg](https://raw.githubusercontent.com/h1s97x/github-profile-3d-contrib/main/docs/demo/profile-gitblock.svg)

### Step 4. Add image to README.md

Add the path to the generated image in your README file.

Example:

```md
![](./profile-3d-contrib/profile-green.svg)
```

## How to use (GitHub Actions) - Advanced examples

- [More info in EXAMPLES.md](./EXAMPLES.md)

## How to use (CNB)

The generator is platform-agnostic — it reads only environment variables and has no dependency on
`@actions/*`. The **same `Dockerfile`** builds the image used by GitHub Actions (container action)
and CNB (pipeline plugin); only the invocation contract differs. No prebuilt `dist/` is committed.

> [!IMPORTANT]
> **CNB has no `uses: owner/repo@ref` mechanism.** Pipeline plugins are Docker images, so a GitHub
> repository cannot be referenced as an action. Use the plugin image below.
>
> If you only use GitHub Actions, you do not need this section at all.

### Use the plugin image

The image is published to this repository's Docker artifact registry on every `v*` tag. It is built
from `src/` at release time, so it always matches the source.

```yaml title=".cnb.yml (in your profile repository)"
main:
  "crontab: 0 0 * * *": # 00:00 Asia/Shanghai — CNB crontab uses the system timezone
    - name: refresh-homepage-assets
      stages:
        - name: profile-3d-contrib
          image: docker.cnb.cool/h1s97x/plugins/profile-3d-contrib:latest
          settingsFrom:
            - https://cnb.cool/YOUR_CNB_USER/YOUR_SECRET_REPO/-/blob/main/plugin.yml
          settings:
            username: h1s97x
            platform: cnb
```

```yaml title="plugin.yml (in your secret repository)"
access_token: <access token with private-repository access>
```

> [!NOTE]
> **Plugin tasks do not receive variables injected by `imports`.** Per the
> [script vs plugin task documentation](https://docs.cnb.cool/zh/build/script-vs-plugin.md), custom
> environment variables are only passed to script tasks, so the token must arrive via `settingsFrom`
> (which loads plugin parameters from a file). Never put the token in `settings` directly. Without
> `access_token` the built-in `CNB_TOKEN` is used, which only sees public repositories.

### Configure it like `cnb-metrics`

No settings file is needed. Common options go straight into `settings:`, and the image entrypoint
assembles them into the generator's settings object:

```yaml
- name: profile-3d-contrib
  image: docker.cnb.cool/h1s97x/plugins/profile-3d-contrib:latest
  settings:
    username: h1s97x
    platform: cnb
    theme: gitblock
    output: my-3d-contrib.svg
    animation: true
    background_color: "#0d1117"
    contrib_colors: "#efefef,#d8e887,#8cc569,#47a042,#1d6a23"
```

| `settings` key | Purpose | Default |
|---|---|---|
| `username` | target account | owner of `CNB_REPO_SLUG` / `GITHUB_REPOSITORY` |
| `platform` | `cnb` or `github` | auto-detected |
| `theme` | built-in theme name, or `all` for the full set of 10 | `green` |
| `output` | output file name | `profile-<theme>.svg` |
| `background_color` / `foreground_color` / `strong_color` / `weak_color` / `radar_color` | override theme colours | from the theme |
| `contrib_colors` | 5 comma-separated bar colours (ignored by `season` / `bitmap`) | from the theme |
| `animation` | bar growing animation | from the theme |
| `l10n` | JSON object overriding radar labels and "contributions" | English |
| `settings_json` | a whole inline settings JSON (object or array), advanced | — |
| `settings_file` | path to a settings JSON, equivalent to the legacy `SETTING_JSON` | — |

Themes: `green` (same as `normal`), `halloween`, `season`, `season-south`, `night-view`,
`night-green`, `night-rainbow`, `gitblock`.

**With no rendering option at all the generator writes one image**, `profile-green.svg`. Setting
`theme` / `output` / colours / `animation` / `l10n` produces a single configured image instead.
Use `theme: all` (or `ALL_THEMES=true`) to get the legacy set of 10 built-in theme images. For multi-theme arrays, single panels or custom `bitmap` patterns, use
`settings_json` (inline) or `settings_file`; ready-to-copy pipeline snippets live in
[`docs/demo/pipelines/`](./docs/demo/pipelines/).

Internally the entrypoint writes a temporary JSON and points `SETTING_JSON` at it, so the existing
`src/settings-validator.ts` still validates the structure (with line numbers) and still blocks
unsafe `fileName` values. `src/` and the 18 SVG snapshots are untouched.

### Data-source and advanced parameters

CNB turns `settings.foo` into `PLUGIN_FOO`; the entrypoint maps those to the generator's
environment variables:

| `settings` key | Generator variable | Notes |
|---|---|---|
| `username` | `USERNAME` | required (or run in a CNB profile repository) |
| `platform` | `PLATFORM` | `cnb` (default) or `github` |
| `access_token` | `CNB_ACCESS_TOKEN` | private CNB repositories; load via `settingsFrom` |
| `github_token` | `GITHUB_TOKEN` | GitHub data source |
| `github_endpoint` | `GITHUB_ENDPOINT` | GitHub Enterprise |
| `cnb_api_endpoint` | `CNB_API_ENDPOINT` | defaults to `https://api.cnb.cool` |
| `max_repos` | `MAX_REPOS` | GitHub data source only |
| `year` | `YEAR` | 2008..current year |
| `setting_json` | `SETTING_JSON` | path to a settings file |

The image writes SVGs to `./profile-3d-contrib/` in the shared build workspace, so it composes
with your other plugin stages — just add that directory to your commit stage.

### Choose the data source

Contribution data can come from **GitHub** (the historical behaviour) or from **CNB itself**:

| | GitHub data | CNB data |
|---|---|---|
| Set `PLATFORM` | `github` (default) | `cnb` |
| Token | `GITHUB_TOKEN` | `CNB_TOKEN` (auto-injected), or `CNB_ACCESS_TOKEN` / plugin `access_token` for private repositories |
| `USERNAME` | GitHub username | CNB username |
| Calendar | GraphQL contribution calendar | `GET /users/{username}/calendar` |
| Language pie | per-language commit contributions | primary language of each repository (every repository weighs 1) |
| Reviews axis | pull request reviews | `valid_cr_count` |

`PLATFORM` is optional: when it is unset, the generator picks CNB if `CNB_TOKEN` is present and
GitHub otherwise. Set it explicitly when both tokens exist.

The CNB calendar API reports raw daily activity counts, so the 0–4 colour levels are derived with the
same **quartile** rule GitHub uses, and the language pie degrades to repository shares because CNB
does not expose a per-language contribution breakdown. The renderer, the themes and the settings
system are identical for both sources.

### Step 1. Create your profile repository on CNB

Create a repository named after your CNB account.

> [!NOTE]
> With `PLATFORM: cnb` both the data and the generated files live on CNB — no GitHub account is
> involved. Keep the default GitHub mode if you want to chart GitHub contributions instead; then make
> sure the GitHub account you want to chart is set as your GitHub profile.

### Step 2. Prepare a secret repository

CNB does not use `${{ secrets.* }}`. Secrets are stored in a dedicated
[secret repository](https://docs.cnb.cool/zh/repo/secret). The plugin image loads its token from
`plugin.yml` via `settingsFrom` (see above); the `envs.yml` + `imports` form below is only for the
script method in Step 3, because plugin tasks do not receive imported environment variables.

With `PLATFORM: cnb` the pipeline injects `CNB_TOKEN` automatically, which is enough for
**public** repositories. That temporary token is scoped to the current repository, so it
cannot see private repositories. To include them, create an access token with
private-repository access and store it in a secret repository:

```yaml title="envs.yml (in your secret repository)"
CNB_ACCESS_TOKEN: <access-token-with-private-repository-access>
```

`CNB_ACCESS_TOKEN` takes precedence over the built-in `CNB_TOKEN`. Keeping a distinct
name means `imports` does not have to shadow a platform-provided variable.

For GitHub data, store `GITHUB_TOKEN` the same way:

```yaml title="envs.yml (in your secret repository)"
GITHUB_TOKEN: ghp_xxxxxxxxxxxxxxxxxxxx
```

### Step 3. Add the pipeline

Add `.cnb.yml` to your profile repository:

```yaml title=".cnb.yml"
main:
  "crontab: 0 18 * * *": # 18:00 Asia/Shanghai (UTC+8) — CNB crontab uses the system timezone
    - name: generate
      docker:
        image: node:24
      # Needed for GitHub data, or for CNB private repositories
      # (CNB_ACCESS_TOKEN). Drop this when public CNB repositories are enough.
      imports:
        - https://cnb.cool/YOUR_CNB_USER/YOUR_SECRET_REPO/-/blob/main/envs.yml
      stages:
        - name: fetch
          jobs:
            - name: Download the generator
              script: |
                # dist/ 不再提交仓库:在流水线里从源码现场构建
                npm ci
                npm run build
                test -s dist/index.js

        - name: generate
          jobs:
            - name: Run the generator
              env:
                PLATFORM: cnb # drop this line to chart GitHub contributions
              script: |
                # CNB_REPO_SLUG looks like "your-name/your-repo"; for a
                # profile repository the first segment is your account name.
                USERNAME="${CNB_REPO_SLUG%%/*}"
                node dist/index.js "$USERNAME"

        - name: commit
          jobs:
            - name: Commit and push
              script: |
                git config user.name "cnb-bot"
                git config user.email "cnb-bot@users.noreply.cnb.cool"
                git add -A profile-3d-contrib
                if git diff --cached --quiet; then
                  echo "No changes, skipping commit."
                else
                  git commit -m "generated"
                  git push origin HEAD:$CNB_BRANCH
                fi
```

The generator also accepts a settings file via `SETTING_JSON` (see [`docs/demo/pipelines/`](./docs/demo/pipelines/)):

```sh
node dist/index.js "$USERNAME"        # target username (or set the USERNAME env var)
```

### Step 4. Differences from GitHub Actions

| Topic | GitHub Actions | CNB |
|---|---|---|
| Reference | `uses: h1s97x/github-profile-3d-contrib@v1.0.0` (container action) | Plugin `image:` stage; optionally build from source in a `script` job |
| Data source | GitHub API | GitHub API, or the CNB API with `PLATFORM: cnb` |
| Secrets | `${{ secrets.GITHUB_TOKEN }}` via `env:` | Secret repository + `settingsFrom` (`access_token`); `imports` only for the script method |
| Repo context | `${{ github.repository_owner }}` | `${CNB_REPO_SLUG%%/*}` |
| Pipeline config | `.github/workflows/*.yml` | `.cnb.yml` (Pipeline / Stage / Job) |
| Schedule | `on.schedule.cron` | `"crontab: ..."` trigger key |
| Check out code | `actions/checkout@v5` | Automatic (the pipeline runs in your repo) |

> [!NOTE]
> `USERNAME` must name the account on the platform selected by `PLATFORM`. CNB account names and
> GitHub usernames are usually different, so with the default GitHub data source pass the GitHub
> username explicitly (or keep a CNB account whose name matches it).

### Build this project on CNB

The `.cnb.yml` in this repository is the project's own CI. It runs lint, type checks and tests on
the CNB primary repository, validates the image sources, and publishes the plugin image on `v*` tags:

- [CNB pipeline syntax](https://docs.cnb.cool/zh/build/grammar)
- [Environment variables and secrets](https://docs.cnb.cool/zh/build/env)

## How to use (local)

Set the `GITHUB_TOKEN` environment variable to your personal access token.

```sh
export GITHUB_TOKEN=XXXXXXXXXXXXXXXXXXXXX
```

To chart CNB contributions instead, select the CNB data source (this needs a CNB token with the
`account-engage:r` scope):

```sh
export PLATFORM=cnb
export CNB_TOKEN=XXXXXXXXXXXXXXXXXXXXX
```

Run the following command, replacing `USER_NAME` with your GitHub username or the target username.

```sh
node_modules/.bin/ts-node src/index.ts USER_NAME
```

or

```sh
npm ci
npm run build
node dist/index.js USER_NAME
```

## License

&copy; 2021 SATO Yoshiyuki. Licensed under the MIT License.

The original work is copyright SATO Yoshiyuki and is redistributed under the MIT License.
Subsequent maintenance and modifications are by the current maintainer (`h1s97x`).
The full license text is in [LICENSE](./LICENSE).
