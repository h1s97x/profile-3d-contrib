# GitHub Profile 3D Contrib

![svg](https://raw.githubusercontent.com/h1s97x/github-profile-3d-contrib/main/docs/demo/profile-gitblock.svg)

> [!IMPORTANT]
> **This repository is a maintained fork.**
>
> | | |
> |---|---|
> | Upstream | [yoshi389111/github-profile-3d-contrib](https://github.com/yoshi389111/github-profile-3d-contrib) |
> | Baseline version | `v0.9.3` |
> | Fork maintainer | `h1s97x` |
> | License | MIT (see [LICENSE](./LICENSE)) |
>
> This is an unofficial fork. It is not affiliated with or endorsed by the original author.
> Copyright and authorship of the original work remain with SATO Yoshiyuki — see [LICENSE](./LICENSE).
>
> **Upgrading from the upstream project:** replace the `uses:` coordinate with
> `h1s97x/github-profile-3d-contrib@v1.0.0` (or `@latest`). No other configuration changes are required,
> unless you use `MAX_REPOS` — see the breaking change noted in [CHANGELOG](./CHANGELOG.md).

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
`@actions/*` or `@octokit/*`. The very same `dist/index.js` runs on both GitHub Actions and CNB —
only the invocation contract differs. See [How to use (CNB)](#how-to-use-cnb).


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

- `GITHUB_TOKEN` : (required) access token
- `USERNAME` : (required) target username (or specify with an argument).
- `MAX_REPOS` : (optional) max repositories, default 100 - since ver. 0.2.0
- `SETTING_JSON` : (optional) settings json file path. See `sample-settings/*.json` and `src/type.ts` in `h1s97x/github-profile-3d-contrib` repository for details. - since ver. 0.6.0
- `GITHUB_ENDPOINT` : (optional) Github GraphQL endpoint. For example, if you want to create a contribution calendar based on your company's GitHub Enterprise activity instead of GitHub.com, set this environment variable. e.g. `https://github.mycompany.com/api/graphql` - since ver. 0.8.0
- `YEAR` : (optional) For past calendars, specify the year. This is intended to be specified when running the tool from the command line. - since ver. 0.8.0

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

If you specify the `SETTING_JSON` environment variable without a `fileName` property in the json file, the following image will be generated:

- `profile-3d-contrib/profile-customize.svg`

You can use these images in your README.md as shown below.

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
![](./profile-3d-contrib/profile-green-animate.svg)
```

## How to use (GitHub Actions) - Advanced examples

- [More info in EXAMPLES.md](./EXAMPLES.md)

## How to use (CNB)

The generator itself is platform-agnostic — it reads only environment variables and has no
dependency on `@actions/*`. The **same** `dist/index.js` runs on both platforms. Only the way you
invoke it differs.

> [!IMPORTANT]
> **CNB has no `uses: owner/repo@ref` mechanism.** In CNB, pipeline plugins are Docker images, so a
> GitHub repository cannot be referenced as an action. The consumption model is inverted: your CNB
> pipeline downloads `dist/index.js` and runs it with Node.
>
> If you only use GitHub Actions, you do not need this section at all.

### Step 1. Create your profile repository on CNB

Create a repository named after your CNB account, and make sure the GitHub account whose
contributions you want to chart is set as your GitHub profile.

> [!NOTE]
> The generated content is committed to your **CNB** repository, but the contribution data always
> comes from **GitHub** — the generator queries the GitHub GraphQL API. `GITHUB_TOKEN` is therefore
> still required here.

### Step 2. Prepare a secret repository

CNB does not use `${{ secrets.* }}`. Secrets are stored in a dedicated
[secret repository](https://docs.cnb.cool/zh/repo/secret) and injected via `imports`.

Create a secret repository containing an `envs.yml`:

```yaml title="envs.yml (in your secret repository)"
GITHUB_TOKEN: ghp_xxxxxxxxxxxxxxxxxxxx
```

### Step 3. Add the pipeline

Add `.cnb.yml` to your profile repository:

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
            - name: Download the generator
              script: |
                mkdir -p .tool
                curl -fsSL -o .tool/dist.js \
                  https://raw.githubusercontent.com/h1s97x/github-profile-3d-contrib/v1.0.0/dist/index.js
                node .tool/dist.js --version || true

        - name: generate
          jobs:
            - name: Run the generator
              env:
                # CNB's equivalent of the GitHub Actions context.
                # CNB_REPO_SLUG looks like "your-name/your-repo"; take the first segment.
                USERNAME: ${CNB_REPO_SLUG}
              script: |
                node .tool/dist.js "$USERNAME"

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

The generator also accepts a settings file and a custom output directory:

```sh
node .tool/dist.js "$USERNAME"        # target username (or set the USERNAME env var)
```

### Step 4. Differences from GitHub Actions

| Topic | GitHub Actions | CNB |
|---|---|---|
| Reference | `uses: h1s97x/github-profile-3d-contrib@v1.0.0` | Download `dist/index.js` in a `script` job |
| Secrets | `${{ secrets.GITHUB_TOKEN }}` | Secret repository + `imports` |
| Repo context | `${{ github.repository_owner }}` | `${{ CNB_REPO_SLUG }}` |
| Pipeline config | `.github/workflows/*.yml` | `.cnb.yml` (Pipeline / Stage / Job) |
| Schedule | `on.schedule.cron` | `"crontab: ..."` trigger key |
| Check out code | `actions/checkout@v5` | Automatic (the pipeline runs in your repo) |

> [!NOTE]
> `USERNAME` must be your **GitHub** username, because the contribution data comes from GitHub.
> Setting it to `${CNB_REPO_SLUG}` works only when your CNB account name equals your GitHub user
> name — otherwise pass the GitHub username explicitly.

### Build this project on CNB

The `.cnb.yml` in this repository is the project's own CI. It runs on the CNB mirror and verifies
that the mirrored `dist/` still matches the source:

- [CNB pipeline syntax](https://docs.cnb.cool/zh/build/grammar)
- [Environment variables and secrets](https://docs.cnb.cool/zh/build/env)

## How to use (local)

Set the `GITHUB_TOKEN` environment variable to your personal access token.

```sh
export GITHUB_TOKEN=XXXXXXXXXXXXXXXXXXXXX
```

Run the following command, replacing `USER_NAME` with your GitHub username or the target username.

```sh
node_modules/.bin/ts-node src/index.ts USER_NAME
```

or

```sh
npm run build
node . USER_NAME
```

## License

&copy; 2021 SATO Yoshiyuki. Licensed under the MIT License.

The original work is copyright SATO Yoshiyuki and is redistributed under the MIT License.
Subsequent maintenance and modifications are by the fork maintainer (`h1s97x`).
The full license text is in [LICENSE](./LICENSE).
