#!/usr/bin/env node
/**
 * Image entrypoint shared by the CNB plugin and the GitHub container action.
 *
 * Two ways to configure the rendering:
 *  1. Flat `settings.*` keys (like cnb-metrics): theme, output, colors,
 *     animation, l10n. These are assembled into a settings object here.
 *  2. Advanced: `settings_json` (inline JSON) or `settings_file` (a path).
 *
 * In all cases the generator is invoked unchanged: it reads a settings file
 * from `SETTING_JSON`, so the entrypoint writes a temporary file and points
 * that variable at it. Nothing in `src/` needs to know about plugin settings.
 *
 * When no rendering option is given, `SETTING_JSON` stays unset and the
 * generator writes its single default image, `profile-green.svg`. Setting
 * `theme: all` toggles the full set of 10 via `ALL_THEMES`.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
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
    // Legacy name: a settings file path.
    PLUGIN_SETTING_JSON: 'SETTING_JSON',
};

const THEMES = {
    green: 'NormalSettings.json',
    normal: 'NormalSettings.json',
    halloween: 'HalloweenSettings.json',
    season: 'NorthSeasonSettings.json',
    'season-south': 'SouthSeasonSettings.json',
    'night-view': 'NightViewSettings.json',
    'night-green': 'NightGreenSettings.json',
    'night-rainbow': 'NightRainbowSettings.json',
    gitblock: 'GitBlockSettings.json',
};

const COLOR_KEYS = {
    background_color: 'backgroundColor',
    foreground_color: 'foregroundColor',
    strong_color: 'strongColor',
    weak_color: 'weakColor',
    radar_color: 'radarColor',
};

const FLAT_KEYS = [
    'THEME',
    'OUTPUT',
    'ANIMATION',
    'L10N',
    'CONTRIB_COLORS',
    ...Object.keys(COLOR_KEYS).map((k) => k.toUpperCase()),
];

/**
 * Read a flat option. CNB exposes `settings.foo` as PLUGIN_FOO; GitHub
 * Actions has no such conversion (the action declares no inputs), so plain
 * env keys are accepted too — one configuration style works on both sides.
 */
const get = (key) => {
    const value = process.env[`PLUGIN_${key}`] ?? process.env[key];
    return value === undefined || value === '' ? undefined : value;
};

const parseBool = (value) => /^(true|1|yes|on)$/i.test(value);

const fail = (message) => {
    console.error(`ERROR: ${message}`);
    process.exit(1);
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
    fail('USERNAME is required (workflow env, settings.username, or the repository owner)');
}

const inlineJson = get('SETTINGS_JSON');
const settingsFile = get('SETTINGS_FILE') || process.env.PLUGIN_SETTING_JSON;
const hasFlat = FLAT_KEYS.some((key) => get(key) !== undefined);
const theme = (get('THEME') || 'green').toLowerCase();

let tempFile;
const writeTemp = (content) => {
    tempFile = path.join(os.tmpdir(), `profile-3d-contrib-${process.pid}.json`);
    fs.writeFileSync(tempFile, content, 'utf8');
    env.SETTING_JSON = tempFile;
};

if (inlineJson) {
    // Hand the raw JSON to the generator's own validator, which reports
    // line numbers and blocks unsafe file names.
    writeTemp(inlineJson);
} else if (settingsFile) {
    env.SETTING_JSON = settingsFile;
} else if (theme === 'all') {
    env.ALL_THEMES = 'true';
} else if (hasFlat) {
    const themeFile = THEMES[theme];
    if (!themeFile) {
        fail(`unknown theme "${theme}"; available: all, ${Object.keys(THEMES).join(', ')}`);
    }
    const settings = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'settings', themeFile), 'utf8'),
    );
    settings.fileName = get('OUTPUT') || `profile-${theme}.svg`;

    for (const [key, field] of Object.entries(COLOR_KEYS)) {
        const value = get(key.toUpperCase());
        if (value !== undefined) {
            settings[field] = value;
        }
    }
    const colors = get('CONTRIB_COLORS');
    if (colors !== undefined) {
        const parsed = colors.split(',').map((c) => c.trim()).filter(Boolean);
        if (parsed.length !== 5) {
            fail('contrib_colors needs exactly 5 comma-separated colors');
        }
        if (settings.type === 'season' || settings.type === 'bitmap') {
            console.warn(`WARNING: contrib_colors is ignored for theme "${theme}"`);
        } else {
            settings.contribColors = parsed;
        }
    }
    const animation = get('ANIMATION');
    if (animation !== undefined) {
        settings.growingAnimation = parseBool(animation);
    }
    const l10n = get('L10N');
    if (l10n !== undefined) {
        try {
            settings.l10n = { ...(settings.l10n || {}), ...JSON.parse(l10n) };
        } catch {
            fail('l10n must be a JSON object');
        }
    }
    writeTemp(JSON.stringify(settings, null, 2));
}

const workspace =
    env.GITHUB_WORKSPACE || env.CNB_BUILD_WORKSPACE || process.cwd();
const generator = path.join(__dirname, 'dist', 'index.js');
const result = spawnSync(process.execPath, [generator, env.USERNAME], {
    stdio: 'inherit',
    env,
    cwd: workspace,
});

if (tempFile) {
    try {
        fs.unlinkSync(tempFile);
    } catch {
        // Best effort cleanup; the file lives in the OS temp directory.
    }
}
if (result.error) {
    fail(result.error.message);
}
process.exit(result.status === null ? 1 : result.status);
