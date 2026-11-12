#!/usr/bin/env node
/**
 * Image entrypoint shared by the CNB plugin and the GitHub container action.
 *
 * CNB turns `settings.foo` into `PLUGIN_FOO` for plugin (image) tasks, and
 * plugin tasks do not receive variables injected by `imports`. Private
 * repository tokens must therefore come from `settingsFrom` (a secret
 * repository) rather than `imports`.
 *
 * `PLATFORM` is intentionally NOT defaulted here: the generator's own
 * `detectPlatform()` picks CNB when a CNB token is present and GitHub
 * otherwise, which is correct on both platforms.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const PARAM_MAP = {
    PLUGIN_USERNAME: 'USERNAME',
    PLUGIN_PLATFORM: 'PLATFORM',
    PLUGIN_ACCESS_TOKEN: 'CNB_ACCESS_TOKEN',
    PLUGIN_GITHUB_TOKEN: 'GITHUB_TOKEN',
    PLUGIN_GITHUB_ENDPOINT: 'GITHUB_ENDPOINT',
    PLUGIN_CNB_API_ENDPOINT: 'CNB_API_ENDPOINT',
    PLUGIN_MAX_REPOS: 'MAX_REPOS',
    PLUGIN_YEAR: 'YEAR',
    PLUGIN_SETTING_JSON: 'SETTING_JSON',
};

const env = { ...process.env };
for (const [from, to] of Object.entries(PARAM_MAP)) {
    const value = process.env[from];
    if (value !== undefined && value !== '') {
        env[to] = value;
    }
}

if (!env.USERNAME && env.CNB_REPO_SLUG) {
    env.USERNAME = env.CNB_REPO_SLUG.split('/')[0];
}
if (!env.USERNAME && env.GITHUB_REPOSITORY) {
    env.USERNAME = env.GITHUB_REPOSITORY.split('/')[0];
}
if (!env.USERNAME) {
    console.error(
        'ERROR: USERNAME is required (workflow env, settings.username, or the repository owner)',
    );
    process.exit(1);
}

const workspace =
    env.GITHUB_WORKSPACE || env.CNB_BUILD_WORKSPACE || process.cwd();
const generator = path.join(__dirname, 'dist', 'index.js');
const result = spawnSync(process.execPath, [generator, env.USERNAME], {
    stdio: 'inherit',
    env,
    cwd: workspace,
});
if (result.error) {
    console.error(`ERROR: ${result.error.message}`);
    process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
