#!/usr/bin/env node
/**
 * CNB plugin entrypoint for profile-3d-contrib.
 *
 * CNB turns `settings.foo` into `PLUGIN_FOO` for plugin (image) tasks, and
 * plugin tasks do not receive variables injected by `imports`. Private
 * repository tokens must therefore come from `settingsFrom` (a secret
 * repository) rather than `imports`.
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
env.PLATFORM = env.PLATFORM || 'cnb';
for (const [from, to] of Object.entries(PARAM_MAP)) {
    const value = process.env[from];
    if (value !== undefined && value !== '') {
        env[to] = value;
    }
}

if (!env.USERNAME && env.CNB_REPO_SLUG) {
    env.USERNAME = env.CNB_REPO_SLUG.split('/')[0];
}
if (!env.USERNAME) {
    console.error(
        'ERROR: settings.username is required (or run inside a CNB profile repository)',
    );
    process.exit(1);
}

const generator = path.join(__dirname, 'dist', 'index.js');
const result = spawnSync(process.execPath, [generator, env.USERNAME], {
    stdio: 'inherit',
    env,
});
if (result.error) {
    console.error(`ERROR: ${result.error.message}`);
    process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
