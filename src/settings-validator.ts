/**
 * Zero-dependency structural validator for settings JSON.
 *
 * Design rules (phase 1):
 * - An unknown or missing `type` is a *blocking* error, because the
 *   renderer would otherwise silently produce a fully transparent
 *   SVG (defect B1).
 * - A combination the renderer cannot draw at all is also blocking:
 *   no color string makes d3.rgb() throw, a missing bitmap `top`
 *   panel makes the pattern lookup throw. Anything that merely
 *   degrades the picture stays a warning.
 * - Every other issue (missing fields, wrong primitive types, odd
 *   color strings, ...) is a *warning* so existing user configs keep
 *   working.
 */

export interface ValidationIssue {
    /** JSON-ish path of the offending field, e.g. "type" or "[1].darkMode.contribColors" */
    path: string;
    message: string;
    /** 1-based line number in the source text when it can be located */
    line?: number;
}

export interface ValidationResult {
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
}

export const KNOWN_TYPES = [
    'normal',
    'season',
    'rainbow',
    'bitmap',
    'pie_lang_only',
    'radar_contrib_only',
] as const;

type KnownType = (typeof KNOWN_TYPES)[number];

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Accepts hex colors, CSS color names, CSS functions like
 * rgb(255,200,55) and percentages like "20%" (contribLightness).
 */
const COLORISH =
    /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+(?:\([\d\s.,%]+\))?|\d+(?:\.\d+)?%)$/;

const L10N_KEYS: Record<string, ReadonlyArray<string>> = {
    full: ['commit', 'repo', 'review', 'pullreq', 'issue', 'contrib'],
    radarOnly: ['commit', 'repo', 'review', 'pullreq', 'issue'],
};

const REQUIRED_COMMON_FIELDS: Record<KnownType, ReadonlyArray<string>> = {
    normal: [
        'backgroundColor',
        'foregroundColor',
        'strongColor',
        'weakColor',
        'radarColor',
    ],
    season: [
        'backgroundColor',
        'foregroundColor',
        'strongColor',
        'weakColor',
        'radarColor',
    ],
    rainbow: [
        'backgroundColor',
        'foregroundColor',
        'strongColor',
        'weakColor',
        'radarColor',
    ],
    bitmap: [
        'backgroundColor',
        'foregroundColor',
        'strongColor',
        'weakColor',
        'radarColor',
    ],
    pie_lang_only: ['backgroundColor', 'foregroundColor'],
    radar_contrib_only: [
        'backgroundColor',
        'foregroundColor',
        'weakColor',
        'radarColor',
    ],
};

const OPTIONAL_FIELDS: Record<KnownType, ReadonlyArray<string>> = {
    normal: [
        'type',
        'contribColors',
        'darkMode',
        'growingAnimation',
        'fileName',
        'l10n',
        '$schema',
    ],
    season: [
        'type',
        'contribColors1',
        'contribColors2',
        'contribColors3',
        'contribColors4',
        'darkMode',
        'growingAnimation',
        'fileName',
        'l10n',
        '$schema',
    ],
    rainbow: [
        'type',
        'saturation',
        'contribLightness',
        'duration',
        'hueRatio',
        'darkMode',
        'growingAnimation',
        'fileName',
        'l10n',
        '$schema',
    ],
    bitmap: [
        'type',
        'contribPatterns',
        'darkMode',
        'growingAnimation',
        'fileName',
        'l10n',
        '$schema',
    ],
    pie_lang_only: [
        'type',
        'backgroundColor',
        'foregroundColor',
        'darkMode',
        'growingAnimation',
        'fileName',
        '$schema',
    ],
    radar_contrib_only: [
        'type',
        'backgroundColor',
        'foregroundColor',
        'weakColor',
        'radarColor',
        'darkMode',
        'growingAnimation',
        'fileName',
        'l10n',
        '$schema',
    ],
};

/** Best-effort line lookup for a top-level key in pretty-printed JSON. */
export const findKeyLine = (
    rawText: string | undefined,
    key: string,
): number | undefined => {
    if (!rawText) {
        return undefined;
    }
    const pattern = new RegExp(`^\\s*"${key}"\\s*:`, 'm');
    const match = pattern.exec(rawText);
    if (!match) {
        return undefined;
    }
    return rawText.slice(0, match.index).split('\n').length;
};

const checkColor = (
    value: unknown,
    path: string,
    warnings: ValidationIssue[],
): void => {
    if (typeof value !== 'string') {
        warnings.push({
            path,
            message: `expected a color string but got ${typeof value}`,
        });
    } else if (!COLORISH.test(value)) {
        warnings.push({
            path,
            message: `"${value}" does not look like a hex or CSS color`,
        });
    }
};

const checkColorArray = (
    value: unknown,
    path: string,
    warnings: ValidationIssue[],
): void => {
    if (!Array.isArray(value)) {
        warnings.push({ path, message: 'expected an array of 5 colors' });
        return;
    }
    if (value.length !== 5) {
        warnings.push({
            path,
            message: `expected 5 colors but got ${value.length}`,
        });
    }
    value.forEach((color, index) =>
        checkColor(color, `${path}[${index}]`, warnings),
    );
};

const checkL10n = (
    value: unknown,
    path: string,
    keys: ReadonlyArray<string>,
    warnings: ValidationIssue[],
): void => {
    if (!isObject(value)) {
        warnings.push({ path, message: 'expected an object of labels' });
        return;
    }
    for (const [key, label] of Object.entries(value)) {
        if (!keys.includes(key)) {
            warnings.push({
                path: `${path}.${key}`,
                message: `unknown label key (expected one of: ${keys.join(', ')})`,
            });
        } else if (typeof label !== 'string') {
            warnings.push({
                path: `${path}.${key}`,
                message: 'label must be a string',
            });
        }
    }
};

/**
 * Panel colors are read with d3.rgb() while building the stylesheet, so
 * they must be strings. The left/right panels fall back to the top panel,
 * which is why only `top` owns both colors.
 */
const checkPanelColor = (
    panel: Record<string, unknown>,
    panelPath: string,
    key: 'backgroundColor' | 'foregroundColor',
    required: boolean,
    errors: ValidationIssue[],
): void => {
    const path = `${panelPath}.${key}`;
    if (!(key in panel)) {
        if (required) {
            errors.push({
                path,
                message: `missing field "${key}"; the left and right panels derive their color from it`,
            });
        }
        return;
    }
    if (typeof panel[key] !== 'string') {
        errors.push({
            path,
            message: `expected a color string but got ${typeof panel[key]}`,
        });
        return;
    }
};

const checkContribPatterns = (
    value: unknown,
    path: string,
    errors: ValidationIssue[],
    warnings: ValidationIssue[],
): void => {
    if (!Array.isArray(value)) {
        warnings.push({
            path,
            message: 'expected an array of 5 contribution patterns',
        });
        return;
    }
    if (value.length !== 5) {
        warnings.push({
            path,
            message: `expected 5 contribution patterns but got ${value.length}`,
        });
    }
    value.forEach((pattern, index) => {
        const patternPath = `${path}[${index}]`;
        if (!isObject(pattern)) {
            warnings.push({ path: patternPath, message: 'expected an object' });
            return;
        }
        const top = pattern.top;
        if (!isObject(top)) {
            // create-3d-contrib reads contribPatterns[i].top.width for
            // every week, so a missing top panel is a hard crash.
            errors.push({
                path: `${patternPath}.top`,
                message: 'missing top panel; the 3D calendar needs it',
            });
        }
        for (const side of ['top', 'left', 'right'] as const) {
            const panel = pattern[side];
            const panelPath = `${patternPath}.${side}`;
            if (!isObject(panel)) {
                if (side !== 'top') {
                    warnings.push({
                        path: panelPath,
                        message: 'expected a panel object',
                    });
                }
                continue;
            }
            if (typeof panel.width !== 'number') {
                warnings.push({
                    path: `${panelPath}.width`,
                    message: 'panel width must be a number',
                });
            }
            if (!Array.isArray(panel.bitmap)) {
                warnings.push({
                    path: `${panelPath}.bitmap`,
                    message: 'panel bitmap must be an array',
                });
            }
            // Side panels inherit from `top` when their own color is
            // unusable, so only `top` must carry both colors. A string is
            // enough; the value itself is never parsed here.
            checkPanelColor(
                panel,
                panelPath,
                'backgroundColor',
                side === 'top',
                errors,
            );
            checkPanelColor(
                panel,
                panelPath,
                'foregroundColor',
                side === 'top',
                errors,
            );
        }
    });
};

const validateOne = (
    input: unknown,
    basePath: string,
    rawText: string | undefined,
    errors: ValidationIssue[],
    warnings: ValidationIssue[],
    depth: number,
): void => {
    const pathOf = (key: string): string =>
        basePath ? `${basePath}.${key}` : key;

    if (!isObject(input)) {
        errors.push({
            path: basePath || '(root)',
            message: 'settings must be a JSON object',
        });
        return;
    }

    // Blocking: the renderer dispatches on `type`; a typo here used to
    // produce a fully transparent SVG without any message.
    const typeValue = input.type;
    if (typeof typeValue !== 'string' || typeValue.length === 0) {
        errors.push({
            path: pathOf('type'),
            message: `missing "type" (expected one of: ${KNOWN_TYPES.join(', ')})`,
            line: depth === 0 ? findKeyLine(rawText, 'type') : undefined,
        });
        return;
    }
    if (!(KNOWN_TYPES as ReadonlyArray<string>).includes(typeValue)) {
        errors.push({
            path: pathOf('type'),
            message: `unknown type "${typeValue}" (expected one of: ${KNOWN_TYPES.join(', ')})`,
            line: depth === 0 ? findKeyLine(rawText, 'type') : undefined,
        });
        return;
    }
    const settingsType = typeValue as KnownType;

    // Warnings: required common fields.
    for (const field of REQUIRED_COMMON_FIELDS[settingsType]) {
        if (!(field in input)) {
            warnings.push({
                path: pathOf(field),
                message: `missing field "${field}" for type "${settingsType}"`,
                line: depth === 0 ? findKeyLine(rawText, field) : undefined,
            });
        } else {
            checkColor(input[field], pathOf(field), warnings);
        }
    }

    // Warnings: per-type extra fields.
    if (settingsType === 'normal') {
        if (!('contribColors' in input)) {
            warnings.push({
                path: pathOf('contribColors'),
                message: 'missing field "contribColors" for type "normal"',
            });
        } else {
            checkColorArray(
                input.contribColors,
                pathOf('contribColors'),
                warnings,
            );
        }
    }
    if (settingsType === 'season') {
        for (const field of [
            'contribColors1',
            'contribColors2',
            'contribColors3',
            'contribColors4',
        ] as const) {
            if (!(field in input)) {
                warnings.push({
                    path: pathOf(field),
                    message: `missing field "${field}" for type "season"`,
                });
            } else {
                checkColorArray(input[field], pathOf(field), warnings);
            }
        }
    }
    if (settingsType === 'rainbow') {
        if (!('contribLightness' in input)) {
            warnings.push({
                path: pathOf('contribLightness'),
                message: 'missing field "contribLightness" for type "rainbow"',
            });
        } else {
            checkColorArray(
                input.contribLightness,
                pathOf('contribLightness'),
                warnings,
            );
        }
        if (typeof input.saturation !== 'string') {
            warnings.push({
                path: pathOf('saturation'),
                message: 'missing or non-string field "saturation" (ex. "80%")',
            });
        }
        if (typeof input.duration !== 'string') {
            warnings.push({
                path: pathOf('duration'),
                message: 'missing or non-string field "duration" (ex. "10s")',
            });
        }
        if (typeof input.hueRatio !== 'number') {
            warnings.push({
                path: pathOf('hueRatio'),
                message: 'missing or non-number field "hueRatio"',
            });
        }
    }
    if (settingsType === 'bitmap') {
        if (!('contribPatterns' in input)) {
            warnings.push({
                path: pathOf('contribPatterns'),
                message: 'missing field "contribPatterns" for type "bitmap"',
            });
        } else {
            checkContribPatterns(
                input.contribPatterns,
                pathOf('contribPatterns'),
                errors,
                warnings,
            );
        }
    }

    // Warnings: optional well-known fields.
    if (
        'growingAnimation' in input &&
        typeof input.growingAnimation !== 'boolean'
    ) {
        warnings.push({
            path: pathOf('growingAnimation'),
            message: 'expected a boolean',
        });
    }
    if ('fileName' in input && typeof input.fileName !== 'string') {
        warnings.push({
            path: pathOf('fileName'),
            message: 'expected a string',
        });
    }
    if ('l10n' in input) {
        const keys =
            settingsType === 'radar_contrib_only'
                ? L10N_KEYS.radarOnly
                : L10N_KEYS.full;
        checkL10n(input.l10n, pathOf('l10n'), keys, warnings);
    }

    // Warnings: unknown fields may be typos.
    const knownFields = new Set([
        ...REQUIRED_COMMON_FIELDS[settingsType],
        ...OPTIONAL_FIELDS[settingsType],
    ]);
    for (const key of Object.keys(input)) {
        if (!knownFields.has(key)) {
            warnings.push({
                path: pathOf(key),
                message: `unknown field "${key}" for type "${settingsType}"`,
                line: depth === 0 ? findKeyLine(rawText, key) : undefined,
            });
        }
    }

    // darkMode shares the shape of its parent type, one level deep.
    if ('darkMode' in input) {
        if (!isObject(input.darkMode)) {
            warnings.push({
                path: pathOf('darkMode'),
                message: 'expected an object mirroring the parent settings',
            });
        } else if (depth === 0) {
            const darkMode = input.darkMode;
            if ('type' in darkMode && darkMode.type !== settingsType) {
                warnings.push({
                    path: pathOf('darkMode.type'),
                    message: `darkMode.type "${String(darkMode.type)}" differs from the parent type "${settingsType}"`,
                });
            }
            validateOne(
                { type: settingsType, ...darkMode },
                pathOf('darkMode'),
                undefined,
                errors,
                warnings,
                depth + 1,
            );
        }
    }
};

const FALLBACK_SETTINGS_TYPE: KnownType = 'normal';

/**
 * Run the per-object checks for one entry, tolerating an unusable `type`.
 *
 * A wrong `type` is still an error, but returning right away would hide
 * every other problem in the file. Re-run the checks with the widest
 * field set (`normal`) and keep only the warnings, so a typo in `type`
 * does not mask a broken bitmap pattern.
 */
const validateEntry = (
    entry: unknown,
    basePath: string,
    rawText: string | undefined,
    errors: ValidationIssue[],
    warnings: ValidationIssue[],
): void => {
    validateOne(entry, basePath, rawText, errors, warnings, 0);
    if (!isObject(entry)) {
        return;
    }
    const typeValue = entry.type;
    const isUsable =
        typeof typeValue === 'string' &&
        (KNOWN_TYPES as ReadonlyArray<string>).includes(typeValue);
    if (isUsable) {
        return;
    }
    const fallbackWarnings: ValidationIssue[] = [];
    validateOne(
        { ...entry, type: FALLBACK_SETTINGS_TYPE },
        basePath,
        rawText,
        [],
        fallbackWarnings,
        0,
    );
    const seen = new Set(warnings.map((w) => `${w.path}\u0000${w.message}`));
    for (const warning of fallbackWarnings) {
        if (!seen.has(`${warning.path}\u0000${warning.message}`)) {
            warnings.push(warning);
        }
    }
};

/**
 * Validate a parsed settings JSON value (single object or array).
 * `rawText` is optional and only used to locate line numbers.
 */
export const validateSettingFile = (
    input: unknown,
    rawText?: string,
): ValidationResult => {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    if (Array.isArray(input)) {
        if (input.length === 0) {
            warnings.push({
                path: '(root)',
                message: 'settings array is empty',
            });
        }
        input.forEach((entry, index) =>
            validateEntry(entry, `[${index}]`, undefined, errors, warnings),
        );
    } else {
        validateEntry(input, '', rawText, errors, warnings);
    }

    return { errors, warnings };
};
