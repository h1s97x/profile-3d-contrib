# Changelog
<!-- markdownlint-disable MD024 -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) since version 0.9.2,
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Behavior changes (bug fixes)

- **`MAX_REPOS` is now a real cap.** The repository pagination previously overshot the limit by up to 99 entries (whole 100-repository pages were appended), inflating total fork/star counts. The merged repository list is now truncated to `MAX_REPOS` and an info message is logged when truncation happens. If you set `MAX_REPOS`, your fork/star totals may **decrease** to the correct value.
- **Invalid settings `type` now fails fast.** A typo such as `"type": "norml"` previously produced a fully transparent SVG without any message. The action now exits with code 1 and prints `E_SETTINGS_INVALID` including the line number and the list of valid types. Other settings issues (missing fields, odd values) only emit `::warning::` messages and do not block execution.
- **Empty contribution years fail fast.** Requesting a year without contribution data (or a year dropped by GitHub's data retention) previously crashed with an obscure `TypeError` inside d3. The action now exits with code 1 and prints `E_YEAR_EMPTY` with actionable hints.

### Added

- **Structured error codes.** All user-facing failures carry a stable `E_*` code and hints. Exit code convention: `1` = configuration/input error, `2` = remote API error.
- **Settings validator and JSON schema.** Zero-dependency structural validation of `SETTING_JSON` files, plus `schema/settings.schema.json` (draft-07) for IDE autocompletion.
- **Render output snapshot tests.** 16 SVG snapshots (8 built-in themes × animated/static) guard against accidental output changes.
- `MAX_REPOS` / `YEAR` environment variables are validated for sane ranges (`MAX_REPOS` must be a positive integer, `YEAR` must be within 2008..current year).
- Output file names from settings are validated (`E_FILENAME_INVALID` on path traversal attempts).

### Changed

- **API error output no longer dumps raw responses.** GraphQL failures previously serialized the whole response into logs, which could leak private repository names. Only server-provided error messages are printed now.
- The GraphQL `errors` field type was corrected from a fixed one-element tuple to an array (type-level only).
- `commitContributionsByRepository` now honors `MAX_REPOS` (capped at GitHub's maximum of 100).

### Fixed (internal)

- **Build pipeline.** `tsconfig.json` `rootDir` is now `./src` so `npm run build` works again (upstream commit `e733579c` had broken the `dist0/index.js` path). `npm run clean` also removes `dist0`.
- Removed a duplicated `text-anchor` attribute and a redundant per-file `mkdirSync` call.
- Importing `dist/index.js` as a library no longer runs `main()` as a side effect (`require.main` guard).

## [1.0.0] - 2026-10-03

First release after the **maintenance handover**. Rendering logic and output format are **identical** to `0.9.3`; this release contains no functional changes.

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

### Known issues (not fixed here)

These all predate `0.9.3`. This release is infrastructure-only and deliberately does not fix them; they are the subject of `docs/spec/02-phase1-correctness.md`.

- **Settings JSON is not validated at runtime.** A typo in the `type` field (e.g. `"norml"`) produces a **fully transparent SVG with exit code 0** — a completely silent failure. Highest impact; recommended first. @see `docs/spec/02-phase1-correctness.md` B1
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
