# Changelog
<!-- markdownlint-disable MD024 -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) since version 0.9.2,
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking changes

- **The default output is now one SVG instead of ten.** With no rendering option the generator
  writes only `profile-green.svg`; the other nine built-in theme images are no longer produced.
  Use `theme: all` (CNB plugin / GitHub `env: THEME=all`) or `ALL_THEMES=true` to restore the
  previous set of 10. **Users whose README references any of the other nine files must either
  set `theme: all` or switch to a single configured image** — otherwise those images silently
  stop updating. Existing files are not deleted.
- **The GitHub Action is now a container action and `dist/` is no longer committed.** `action.yml`
  uses `runs.using: docker` with `image: 'Dockerfile'`, so GitHub builds the image from `src/` at
  the pinned ref; CNB uses the same `Dockerfile` as a prebuilt plugin image. The three files under
  `dist/` were removed, `.gitattributes` and `build.yml` were deleted, and the `dist-consistency`
  gates in `ci.yml`, `release.yml` and `.cnb.yml` were replaced by lint / type / test plus an
  image-contract check. Existing `uses:` coordinates still resolve, but each run now builds the
  image instead of executing a prebuilt bundle. Older immutable tags such as `v1.0.0` still carry
  their original `dist/` and are unaffected. The CNB Docker registry requires authentication, so
  GitHub cannot reference the CNB image directly.
- **The image entrypoint no longer forces `PLATFORM=cnb`.** Platform selection is delegated to the
  generator's auto-detection, so the shared image works on GitHub Actions without extra config.
  The entrypoint now also honours `GITHUB_WORKSPACE` / `CNB_BUILD_WORKSPACE` for the output folder.

### Behavior changes (bug fixes)

- **`MAX_REPOS` is now a real cap.** The repository pagination previously overshot the limit by up to 99 entries (whole 100-repository pages were appended), inflating total fork/star counts. The merged repository list is now truncated to `MAX_REPOS` and an info message is logged when truncation happens. If you set `MAX_REPOS`, your fork/star totals may **decrease** to the correct value.
- **Invalid settings `type` now fails fast.** A typo such as `"type": "norml"` previously produced a fully transparent SVG without any message. The action now exits with code 1 and prints `E_SETTINGS_INVALID` including the line number and the list of valid types. Other settings issues (missing fields, odd values) only emit `WARNING:` messages and do not block execution.
- **Empty contribution years fail fast.** Requesting a year without contribution data (or a year dropped by GitHub's data retention) previously crashed with an obscure `TypeError` inside d3. The action now exits with code 1 and prints `E_YEAR_EMPTY` with actionable hints.

### Added

- **CNB as a first-class data source.** Set `PLATFORM=cnb` (or simply provide `CNB_TOKEN`) to build the calendar from [CNB](https://cnb.cool) instead of GitHub. Data comes from the CNB OpenAPI (`GET /users/{username}/calendar`, `GET /users/{username}/repos`); the renderer, the themes, the settings system and the snapshot baselines are untouched. Contribution levels are derived with the same quartile rule GitHub uses, and the language pie is aggregated from each repository's primary language. See "How to use (CNB)" in the README.
- `PLATFORM`, `CNB_TOKEN` and `CNB_API_ENDPOINT` environment variables. An unknown `PLATFORM` value fails fast with `E_PLATFORM_INVALID`, and CNB API errors surface the server `errmsg` alongside the HTTP status.
- **Structured error codes.** All user-facing failures carry a stable `E_*` code and hints. Exit code convention: `1` = configuration/input error, `2` = remote API error.
- **Settings validator and JSON schema.** Zero-dependency structural validation of `SETTING_JSON` files, plus `schema/settings.schema.json` (draft-07) for IDE autocompletion.
- **Render output snapshot tests.** 16 SVG snapshots (8 built-in themes × animated/static) guard against accidental output changes.
- `MAX_REPOS` / `YEAR` environment variables are validated for sane ranges (`MAX_REPOS` must be a positive integer, `YEAR` must be within 2008..current year).
- Output file names from settings are validated. A `fileName` that can leave the output folder — path separators, `..` segments, a leading dot — fails with `E_FILENAME_INVALID` before anything is rendered. A name that is merely unusual (a space, a non-`.svg` suffix) warns and falls back to `profile-customize.svg`.

### Security

- Bumped `axios` from `1.18.1` to `1.20.0` to address CVE-2026-101905, where a polluted `Object.prototype.createConnection` in the Node HTTP adapter could redirect requests (and leak headers, bodies and credentials) to an attacker-controlled endpoint.

### Changed

- **Technical roadmap moved to `docs/roadmap/`.** The former `docs/spec/` directory (Chinese
  design and planning documents) was renamed to avoid confusion with the root `spec/` directory,
  which contains the Jest test suite. All internal links, `CHANGELOG.md` references and the
  roadmap README were updated; the root `spec/` tests are untouched.
- **Demo assets moved to `examples/` and images now use the CNB primary repository.** The
  `docs/demo/` directory was moved to the repository root as `examples/` (effect previews plus
  copyable pipeline YAML). All README images now point at
  `https://cnb.cool/h1s97x/plugins/profile-3d-contrib/-/git/raw/main/examples/*.svg` instead of
  the GitHub-side distribution repository's raw URL, which is no longer synchronized.
- **Configuration examples are now pipeline YAML.** `sample-settings/` and `schema/` were
  removed; ready-to-copy snippets live in `examples/pipelines/` (flat `settings:`, inline
  `settings_json`, `settingsFrom` for private tokens, GitHub Actions workflow). The image
  entrypoint now also reads flat options from plain environment variables, so GitHub Actions
  can use the same style via `env:`.
- **The CNB data source now fetches every repository visible to the token.** The repository
  list was previously truncated to `MAX_REPOS` (default 100), so the `Repo`, star, fork and
  language totals silently omitted older and private repositories. CNB reports the exact count
  in the `x-cnb-total` response header, so pagination now stops on that total (or a short page),
  and `role=Guest` is requested to include repositories the user does not own. `MAX_REPOS` now
  applies only to the GitHub data source. **CNB users' generated SVGs change** — totals become
  larger and every committed image is redrawn once.
- **New `CNB_ACCESS_TOKEN` for private repositories.** The pipeline-injected `CNB_TOKEN` is a
  temporary token scoped to the current repository and can only see public repositories.
  Setting `CNB_ACCESS_TOKEN` from a secret repository via `imports` takes precedence and lets
  the CNB data source include private repositories; `PLATFORM` auto-detection recognizes it too.
- **CNB is now the canonical repository.** `package.json` repository/homepage/bugs now point to
  `cnb.cool/h1s97x/plugins/profile-3d-contrib`, and the README notices describe an independently
  maintained project instead of an upstream-tracking fork. The original author's MIT attribution is
  unchanged. The GitHub repository remains only as a distribution endpoint for existing `uses:` references.
- **The GitHub → CNB mirror workflow was removed.** `.github/workflows/sync-cnb.yml` force-pushed the
  full history into what is now the primary repository; keeping it would let a GitHub-side push
  overwrite the CNB `main` branch. `.cnb.yml` now verifies the build directly on the primary repository.
- **Takeover record and spec docs updated.** Decisions about upstream PRs and upstream synchronization
  are marked as superseded, the origin/provenance of the `v0.9.3` source snapshot is recorded, and the
  acceptance checks still describe the expected upstream-reference hits.
- **API error output no longer dumps raw responses.** GraphQL failures previously serialized the whole response into logs, which could leak private repository names. Only server-provided error messages are printed now.
- The GraphQL `errors` field type was corrected from a fixed one-element tuple to an array (type-level only).
- `commitContributionsByRepository` now honors `MAX_REPOS` (capped at GitHub's maximum of 100).

### Fixed

- **`dist/` rebuilt from the current `src/`.** The artifact had not been regenerated since
  `init from source`, so it no longer matched the phase-0/phase-1 source changes and the new
  `dist-consistency` gate failed on the very pull request that introduced it. A fresh build now
  leaves all 16 render snapshots byte-identical.
- **`::error::` / `::warning::` annotations dropped from output.** Those annotations are a GitHub
  Actions feature; the CNB pipeline printed them verbatim, which reads like a syntax error. Both
  `.cnb.yml` and the settings warnings now use plain `ERROR:` / `WARNING:` prefixes.

- **A settings file that the renderer cannot draw is rejected up front.** Until now the validator
  only warned about a bitmap `contribPatterns` entry without a `top` panel, and the renderer then
  threw `Cannot read properties of undefined` on the first week. A missing `top` panel and a
  non-string panel color are now blocking (`E_SETTINGS_INVALID`) with the offending JSON path, and
  the renderer degrades instead of crashing if such a file still reaches it.
- **A typo in `type` no longer hides every other problem.** Validation still stops at the wrong
  `type`, but the remaining fields are re-checked against the `normal` field set, so block-worthy
  issues such as a broken bitmap pattern are reported in the same run.

### Fixed (documentation and metadata)

- **`package-lock.json` version realigned with `package.json`.** The lock file still carried
  `0.9.3` while `package.json` was already `1.0.0`. `release.yml` only compares the tag against
  `package.json` and CI only runs `npm ci`, so nothing caught the mismatch.
- **Takeover checklist no longer contradicts the code.** `docs/roadmap/00-takeover.md` claimed the
  handover shipped without touching `src/` and that every `YOUR_GITHUB_*` placeholder was replaced;
  both were stale. The placeholder section now distinguishes coordinates that are already updated
  from the CNB secret-repository examples that must stay placeholders, and the dead `sed` one-liner
  (it also rewrote planned examples in the spec docs) is gone.
- **`docs/roadmap/03-phase2-architecture.md` acceptance check fixed.** The self-check
  `git grep -c 'yoshi389111/github-profile-3d-contrib'` could never pass, because the eleven README
  fork notices must keep the upstream link. It is now path-filtered and states the one allowed hit.
- **Phase 0 status updated.** `docs/roadmap/01-phase0-safety-net.md` still said the render snapshots and
  the `spec/` type check were pending; both shipped.
- **Planned examples use the real coordinate.** `docs/roadmap/04-phase3-config-api.md` and
  `docs/roadmap/06-phase5-advanced.md` described this repository's own future CLI and packaging but
  referred to `YOUR_GITHUB_USER`; they now say `h1s97x/...`.

### Fixed (tests)

- **`settings-validator.ts` branch coverage.** 81.36% → 99.37% statements and 97.61% branches, with
  the file at 100% line coverage: season color arrays, missing rainbow fields, malformed panels,
  `l10n` key sets, empty arrays, `fileName` / `growingAnimation` type checks and the typo fallback
  path are now all exercised.

### Fixed (packaging)

- **Leftover `pnpm.overrides` removed.** `package.json` carried 36 pnpm overrides plus a
  `transformIgnorePatterns` entry for `node_modules/.pnpm/`, but the repository installs with
  `npm ci`, which ignores both: the lock file never saw them (it still resolves
  `@types/d3-scale@3.2.2` and `@types/d3-time-format@3.0.0`) and the ignore pattern could not match a
  flat `node_modules/`. They are gone; the ignore pattern now keeps only d3 and its ESM-only
  siblings out of the transform, which is what the tests actually need.
- **`fileName` semantics made consistent.** `E_FILENAME_INVALID` was unreachable: `index.ts`
  silently replaced an unsafe name before `writeFile()` ever saw it, so the only guard against path
  traversal was a warning. The escape check now runs in the settings reader, before rendering, and
  the fallback covers only names that stay inside the output folder.

### Fixed (internal)

- **Build pipeline.** `tsconfig.json` `rootDir` is now `./src` so `npm run build` works again (upstream commit `e733579c` had broken the `dist0/index.js` path). `npm run clean` also removes `dist0`.
- Removed a duplicated `text-anchor` attribute and a redundant per-file `mkdirSync` call.
- Importing `dist/index.js` as a library no longer runs `main()` as a side effect (`require.main` guard).

## [1.0.1] - 2026-11-12

Patch release for version and documentation alignment. The CNB data-source work committed alongside it is recorded under `[Unreleased]`.

Starting with this release the project evolves in small, individually verifiable patch releases
instead of bundling unrelated work into a minor release. The functional changes still listed under
`[Unreleased]` are already present on `main` and in the committed `dist/index.js`, but are
intentionally not announced as released features yet; they will be promoted one patch at a time.

### Changed

- Version bumped to `1.0.1` in `package.json` and `package-lock.json`.
- Removed the premature `since ver. 1.1.0` annotations from `PLATFORM`, `CNB_TOKEN` and
  `CNB_API_ENDPOINT` in the README. `1.1.0` was never released and conflicted with the version in
  `package.json`; version history is now tracked in this changelog only, so small-step releases no
  longer require editing the environment variable table.
- `docs/roadmap/README.md` now reports `1.0.1` as the current version.

## [1.0.0] - 2026-10-03

First release after the **maintenance handover**. `src/` was byte-for-byte untouched in the
handover commit `a2c5e2a`, so the generated output is identical to `0.9.3`; this release contains
no runtime code changes.

> Functional fixes landed afterwards on the same unreleased line (see `[Unreleased]`):
> `src/` has since changed and `dist/index.js` grew from 190,611 to 191,885 lines. The 16 render
> snapshots are still byte-identical, so existing users' images are unaffected, but the code is no
> longer 「unchanged since 0.9.3」.

### Breaking changes

- **The `uses:` coordinate has changed.** This repository is a fork of [yoshi389111/github-profile-3d-contrib](https://github.com/yoshi389111/github-profile-3d-contrib), which is no longer updated. Existing users must update the reference in their workflow:

  ```diff
  - uses: yoshi389111/github-profile-3d-contrib@latest
  + uses: h1s97x/github-profile-3d-contrib@v1.0.0
  ```

  Apart from that single `uses:` line, **no other configuration changes are required** (environment variables, `SETTING_JSON`, and output paths all stay the same), and the generated output is byte-identical to `0.9.3`.

  `@latest` still resolves, but it now tracks this repository's releases and is no longer synchronized with upstream `@latest`.

### Added

- **CNB platform support.** Added `.cnb.yml` (cloud-native build configuration) and CNB usage documentation. The core logic is platform-agnostic — `src/` depends on neither `@actions/*` nor `@octokit/*` — so the same `dist/index.js` runs on both platforms; only the invocation contract differs.
- **Automated GitHub → CNB mirroring.** Added `sync-cnb.yml`, which mirrors the source and artifacts to the CNB repository on every `main` push and on tags.
- **Artifact consistency check (blocking).** Added `ci.yml`, which verifies on pull requests and `main` pushes that `dist/` matches `src/`. Users execute the committed artifact rather than the source, so this is the primary gate against artifact drift.
- **Release verification workflow.** Added `release.yml`, which validates on release that the tag matches the `package.json` version and that the tagged artifacts are reproducible from source.
- **`.gitattributes`.** Marks `dist/` as `linguist-generated` and disables diffs for it, preventing unmergeable conflicts when syncing from upstream in the future.
- Added `repository` / `homepage` / `bugs` fields to `package.json`.

### Changed

- **Project maintenance handover.** The `author` field in `action.yml` and `package.json` is now the new maintainer, `h1s97x`. Based on upstream `v0.9.3`.
- Copyright and attribution are unchanged. The original work is copyright SATO Yoshiyuki, MIT licensed — see `LICENSE`.
- `build.yml` now uses `npm ci` instead of `npm install` so the dependency tree strictly matches `package-lock.json`; added `concurrency` to prevent concurrent push races; the commit step is skipped when the build output is unchanged.
- Updated the `uses:` coordinate in all documentation (English + 10 translations) and added a fork notice to each.
- The `latest` branch strategy is retained (see Known issues), now with its design rationale and risks documented.

### Security

- `build.yml` and the new workflows all pin `actions/checkout@v5` and `actions/setup-node@v5`.
- The CNB sync credential is injected from GitHub Secrets and never committed; the CNB repository URL is public information and is written directly in the workflow.

### Fixed

- **`dist/` is rebuilt from the current `src/`.** The artifact was last generated at commit
  `init from source` and never regenerated after the phase-0/phase-1 source changes, so
  `src/` and `dist/` had drifted apart and the new `dist-consistency` gate failed on the very
  pull request that introduced it. Verified afterwards that a fresh build leaves all 16 render
  snapshots byte-identical.
- **`::error::` / `::warning::` annotations dropped from output.** Those annotations are a GitHub
  Actions feature; the CNB pipeline printed them verbatim, which reads like a syntax error. Both
  `.cnb.yml` and the settings warnings now use plain `ERROR:` / `WARNING:` prefixes.

### Known issues (not fixed here)

These all predate `0.9.3`. This release is infrastructure-only and deliberately does not fix them; they are the subject of `docs/roadmap/02-phase1-correctness.md`.

- **Settings JSON is not validated at runtime.** A typo in the `type` field (e.g. `"norml"`) produces a **fully transparent SVG with exit code 0** — a completely silent failure. Highest impact; recommended first. @see `docs/roadmap/02-phase1-correctness.md` B1
- **`MAX_REPOS` does not mean what it says.** It only acts as a pagination stop threshold, not a repository cap — the first page of 100 repositories is never truncated, and the `commitContributionsByRepository` limit is hardcoded to 100. Reported star / fork counts may therefore be **inflated**. @see B3
- **An empty contribution calendar crashes.** Pointing `YEAR` at a year with no data throws a `TypeError` instead of a helpful message. @see B2
- **`fileName` in `SETTING_JSON` is not path-validated**, so in principle it can write outside the output directory. @see B4
- **API errors may leak private repository names.** When GraphQL returns a null `data` with no `errors`, the message includes the full response JSON. @see B5

## [0.9.3] - 2026-06-15

### Changed

* Improved the performance of the rainbow theme. @K-H-A-L-I-D #148
* Fixed the `clean` npm script to work on Windows. #154

### Security

* Upgrade and clean up dependent libraries.

## [0.9.2] - 2026-02-15

### Added

* Brazilian Portuguese translation of README @SoulBreathe #129

### Changed

* Replaced `core.setFailed` with `console.error` and `process.exitCode` to resolve vulnerable dependency ( `undici 5.29.0` ) #136
* style: Remove unnecessary blank line in PieLangOnlySettings interface #136
* No behavior changes

### Security

* Updated vulnerable dependency `js-yaml` #131
* Updated vulnerable dependency `glob` #132
* Updated vulnerable dependency `axios` #135
* Removed dependencies `@actions/github` and `@actions/core` to exclude vulnerable dependency ( `undici 5.29.0` ) #136

## 2025-09-13, 0.9.1 release

* Fixed "week" to be calculated correctly even when the start date is not a Sunday. #126
* Changed node version from 20 to 24. #119
* Changed actions/checkout version from v4 to v5. #119
* Added translations to the README file. #116
* Updated the version of the dependent packages (via package-lock.json).

## 2025-03-13, 0.9.0 release

* You can now specify `darkMode` definitions in custom JSON files that can be specified in `SETTINGS_JSON`. This allows you to generate svg that supports both light mode and dark mode. The light mode type and dark mode type must match. See `sample-settings/green.dual.json` for details.
* The latest version can now be specified with the `latest` branch.

## 2025-03-09, 0.8.0 release

* Added environment variable `GITHUB_ENDPOINT`.
* Added environment variable `YEAR`.

## 2025-03-05, 0.7.2 release

* Changed node version from 16 to 20.
* Changed actions/checkout version from v3 to v4.
* Update dependent libraries(see package.json).

## 2023-01-11, 0.7.1 release

* Changed node version from 12 to 16.
* Changed actions/checkout version from v2 to v3.

## 2022-08-10, 0.7.0 release

* Added Spanish README.
* Enabled to specify the output destination file name when using settings json
* Multiple custom definitions can be specified in the settings json.
* Made it possible to change the label with a custom definition.
* Added pie_lang_only and radar_contrib_only modes.
* fix: performance bitmap mode.
* fix: growing animation of settings json

## 2022-02-12, 0.6.0 release

* Added git block version.
* New support for setting json file.

## 2022-01-29, 0.5.0 release

* Use logarithm to calculate the height of the bars.

## 2022-01-09, 0.4.0 release

* Added night green version.

## 2021-12-22, 0.3.1 release

* Changed the maximum number of contributors to 9999

## 2021-12-22, 0.3.0 release

* Added season version for the Southern Hemisphere.
* Added night view version.
* Added night rainbow version.

## 2021-05-11, 0.2.0 release

* The repositories to be aggregated are only those owned by the user.
* Allow the number of repositories to be aggregated to be defined by environment variables.
  * `MAX_REPOS` : (optional) max repositories, default 100
* Make the colors of the four seasons mode every week and make a gradation.
  * The image colors of each season are as follows.
    * spring flowers
    * summer leaves
    * autumn leaves
    * winter snow
* Label the radar chart scale with "1-, 10, 100, 1K, 10K+".
* Supports Halloween mode on github.
* The USERNAME can also be specified from the argument.
  * Usage: `node dist/index.js <USER-NAME>` without env `USERNAME`

## 2021-05-09, 0.1.0 release

First release.
