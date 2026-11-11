import { findKeyLine, validateSettingFile } from '../src/settings-validator';
import { readFileSync } from 'fs';

const validNormal = {
    type: 'normal',
    backgroundColor: '#ffffff',
    foregroundColor: '#00000f',
    strongColor: '#111133',
    weakColor: 'gray',
    radarColor: '#47a042',
    contribColors: ['#efefef', '#d8e887', '#8cc569', '#47a042', '#1d6a23'],
};

const validRainbow = {
    type: 'rainbow',
    backgroundColor: '#00000f',
    foregroundColor: '#eeeeff',
    strongColor: 'rgb(255,200,55)',
    weakColor: '#aaaaaa',
    radarColor: 'rgb(255,200,55)',
    growingAnimation: true,
    saturation: '50%',
    contribLightness: ['20%', '30%', '35%', '40%', '50%'],
    duration: '10s',
    hueRatio: -7,
};

const validTopPanel = {
    width: 7,
    bitmap: [0x7f],
    backgroundColor: '#161b22',
    foregroundColor: '#39d353',
};

const validPattern = {
    top: validTopPanel,
    left: { width: 7, bitmap: [0x7f] },
    right: { width: 7, bitmap: [0x7f] },
};

const validBitmap = {
    type: 'bitmap',
    backgroundColor: '#000000',
    foregroundColor: '#ffffff',
    strongColor: '#ffffff',
    weakColor: '#aaaaaa',
    radarColor: '#ffffff',
    contribPatterns: [
        validPattern,
        validPattern,
        validPattern,
        validPattern,
        validPattern,
    ],
};

describe('settings-validator', () => {
    it('accepts valid settings without any noise', () => {
        const result = validateSettingFile(validNormal);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
    });

    it('accepts css functions and percentages as colors', () => {
        const result = validateSettingFile(validRainbow);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
    });

    it('accepts the bundled spec fixtures without warnings', () => {
        for (const file of ['./spec/settings.json', './spec/settings2.json']) {
            const content = readFileSync(file, 'utf8');
            const result = validateSettingFile(JSON.parse(content), content);
            expect(result.errors).toEqual([]);
            expect(result.warnings).toEqual([]);
        }
    });

    it('blocks an unknown type with the list of valid values', () => {
        const rawText = '{\n  "type": "norml"\n}\n';
        const result = validateSettingFile({ type: 'norml' }, rawText);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].path).toEqual('type');
        expect(result.errors[0].message).toContain('unknown type "norml"');
        expect(result.errors[0].message).toContain('normal');
        expect(result.errors[0].message).toContain('radar_contrib_only');
        expect(result.errors[0].line).toEqual(2);
    });

    it('blocks a missing type', () => {
        const result = validateSettingFile({ backgroundColor: '#fff' });
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].path).toEqual('type');
    });

    it('blocks non-object roots and array entries', () => {
        expect(validateSettingFile('text').errors).toHaveLength(1);
        expect(validateSettingFile([validNormal, 42]).errors).toHaveLength(1);
        expect(validateSettingFile([validNormal, 42]).errors[0].path).toEqual(
            '[1]',
        );
    });

    it('warns on missing fields but does not block', () => {
        const missing: Record<string, unknown> = { ...validNormal };
        delete missing.contribColors;
        const result = validateSettingFile(missing);
        expect(result.errors).toEqual([]);
        expect(
            result.warnings.some((w) => w.path === 'contribColors'),
        ).toBeTruthy();
    });

    it('warns on unknown fields (typos)', () => {
        const result = validateSettingFile({
            ...validNormal,
            backgroundColour: '#fff',
        });
        expect(
            result.warnings.some((w) => w.path === 'backgroundColour'),
        ).toBeTruthy();
    });

    it('warns on malformed contribColors', () => {
        const result = validateSettingFile({
            ...validNormal,
            contribColors: ['#fff', '#fff'],
        });
        expect(
            result.warnings.some((w) =>
                w.message.includes('expected 5 colors'),
            ),
        ).toBeTruthy();
    });

    it('warns on a darkMode type mismatch and validates nested fields', () => {
        const result = validateSettingFile({
            ...validNormal,
            darkMode: { ...validNormal, type: 'season' },
        });
        expect(
            result.warnings.some((w) => w.path === 'darkMode.type'),
        ).toBeTruthy();
        expect(result.errors).toEqual([]);
    });

    it('warns on malformed bitmap contribPatterns', () => {
        const top: Record<string, unknown> = { ...validTopPanel, width: 7 };
        delete top.bitmap;
        const result = validateSettingFile({
            ...validBitmap,
            contribPatterns: [{ top }],
        });
        expect(result.errors).toEqual([]);
        expect(
            result.warnings.some((w) =>
                w.message.includes('expected 5 contribution patterns'),
            ),
        ).toBeTruthy();
        expect(
            result.warnings.some((w) => w.path === 'contribPatterns[0].left'),
        ).toBeTruthy();
        expect(
            result.warnings.some(
                (w) => w.path === 'contribPatterns[0].top.bitmap',
            ),
        ).toBeTruthy();
    });

    it('accepts a full bitmap settings object without noise', () => {
        const result = validateSettingFile(validBitmap);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
    });

    it('blocks a bitmap pattern without a top panel instead of crashing', () => {
        const contribPatterns = [{ left: { width: 7, bitmap: [0x7f] } }];
        const result = validateSettingFile({ ...validBitmap, contribPatterns });
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].path).toEqual('contribPatterns[0].top');
    });

    it('blocks non-string top panel colors that d3.rgb() would reject', () => {
        const contribPatterns = [
            { top: { ...validTopPanel, backgroundColor: 0x161b22 } },
        ];
        const result = validateSettingFile({ ...validBitmap, contribPatterns });
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].path).toEqual(
            'contribPatterns[0].top.backgroundColor',
        );
    });

    it('blocks a bitmap pattern whose top panel is not an object', () => {
        const contribPatterns = [{ top: 'nope' }];
        const result = validateSettingFile({ ...validBitmap, contribPatterns });
        expect(
            result.errors.some((e) => e.path === 'contribPatterns[0].top'),
        ).toBeTruthy();
    });

    it('keeps checking fields when the type is a typo', () => {
        const result = validateSettingFile({
            type: 'bitmapm',
            contribPatterns: [{ left: { width: 7 } }],
        });
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].path).toEqual('type');
        expect(result.warnings.some((w) => w.path === 'bitmap2')).toBeFalsy();
        // The fallback pass must not duplicate the error it already has.
        expect(result.errors.filter((e) => e.path === 'type')).toHaveLength(1);
        expect(
            result.warnings.some((w) => w.message.includes('unknown field')),
        ).toBeTruthy();
    });


    it('warns when a top-level color is not a string or looks unusable', () => {
        const result = validateSettingFile({
            ...validNormal,
            backgroundColor: 0,
            foregroundColor: 'not a color!',
        });
        expect(result.errors).toEqual([]);
        expect(
            result.warnings.some(
                (w) =>
                    w.path === 'backgroundColor' &&
                    w.message.includes('expected a color string'),
            ),
        ).toBeTruthy();
        expect(
            result.warnings.some(
                (w) =>
                    w.path === 'foregroundColor' &&
                    w.message.includes('does not look like a hex or CSS color'),
            ),
        ).toBeTruthy();
    });

    it('warns on a non-array contribColors', () => {
        const result = validateSettingFile({
            ...validNormal,
            contribColors: 'rainbow',
        });
        expect(
            result.warnings.some(
                (w) =>
                    w.path === 'contribColors' &&
                    w.message.includes('expected an array of 5 colors'),
            ),
        ).toBeTruthy();
    });

    it('warns on malformed season color arrays', () => {
        const result = validateSettingFile({
            type: 'season',
            backgroundColor: '#ffffff',
            foregroundColor: '#00000f',
            strongColor: '#111133',
            weakColor: 'gray',
            radarColor: '#47a042',
            contribColors1: ['#fff', '#fff'],
            contribColors2: '#fff',
            contribColors3: ['#aaa', '#bbb', '#ccc', '#ddd', '#eee'],
        });
        expect(result.errors).toEqual([]);
        expect(
            result.warnings.some(
                (w) =>
                    w.path === 'contribColors1' &&
                    w.message.includes('expected 5 colors'),
            ),
        ).toBeTruthy();
        expect(
            result.warnings.some(
                (w) =>
                    w.path === 'contribColors2' &&
                    w.message.includes('expected an array of 5 colors'),
            ),
        ).toBeTruthy();
        expect(
            result.warnings.some(
                (w) => w.path === 'contribColors4' && w.message.includes('missing'),
            ),
        ).toBeTruthy();
    });

    it('warns on missing rainbow-only fields', () => {
        const { saturation, duration, hueRatio, ...rest } = validRainbow;
        expect(saturation && duration && hueRatio).toBeDefined();
        const result = validateSettingFile(rest);
        expect(result.errors).toEqual([]);
        for (const field of ['saturation', 'duration', 'hueRatio']) {
            expect(
                result.warnings.some((w) => w.path === field),
            ).toBeTruthy();
        }
    });

    it('warns on a missing contribPatterns and a non-array one', () => {
        const { contribPatterns, ...rest } = validBitmap;
        expect(contribPatterns).toBeDefined();
        const missing = validateSettingFile(rest);
        expect(
            missing.warnings.some(
                (w) =>
                    w.path === 'contribPatterns' &&
                    w.message.includes('missing field'),
            ),
        ).toBeTruthy();
        const notArray = validateSettingFile({
            ...validBitmap,
            contribPatterns: 'nope',
        });
        expect(
            notArray.warnings.some(
                (w) =>
                    w.path === 'contribPatterns' &&
                    w.message.includes('expected an array of 5 contribution patterns'),
            ),
        ).toBeTruthy();
    });

    it('warns on bitmap panels that are not objects or lack numbers', () => {
        const result = validateSettingFile({
            ...validBitmap,
            contribPatterns: [
                {
                    top: { ...validTopPanel, width: '7' },
                    left: 'nope',
                    right: {},
                },
            ],
        });
        expect(result.errors).toEqual([]);
        for (const path of [
            'contribPatterns[0].top.width',
            'contribPatterns[0].left',
            'contribPatterns[0].right.bitmap',
        ]) {
            expect(result.warnings.some((w) => w.path === path)).toBeTruthy();
        }
    });

    it('warns when a contribution pattern entry is not an object', () => {
        const result = validateSettingFile({
            ...validBitmap,
            contribPatterns: ['nope'],
        });
        expect(
            result.warnings.some(
                (w) =>
                    w.path === 'contribPatterns[0]' &&
                    w.message.includes('expected an object'),
            ),
        ).toBeTruthy();
    });

    it('warns on non-boolean growingAnimation and non-string fileName', () => {
        const result = validateSettingFile({
            ...validNormal,
            growingAnimation: 'yes',
            fileName: 42,
        });
        expect(result.warnings.some((w) => w.path === 'growingAnimation')).toBeTruthy();
        expect(result.warnings.some((w) => w.path === 'fileName')).toBeTruthy();
    });

    it('validates l10n labels and narrows the key set for radar', () => {
        const result = validateSettingFile({
            ...validNormal,
            l10n: { commit: 1, bogus: 'x' },
        });
        expect(result.warnings.some((w) => w.path === 'l10n.commit')).toBeTruthy();
        expect(result.warnings.some((w) => w.path === 'l10n.bogus')).toBeTruthy();

        const notObject = validateSettingFile({
            ...validNormal,
            l10n: 'hi',
        });
        expect(
            notObject.warnings.some(
                (w) => w.path === 'l10n' && w.message.includes('expected an object'),
            ),
        ).toBeTruthy();

        const radar = validateSettingFile({
            type: 'radar_contrib_only',
            backgroundColor: '#ffffff',
            foregroundColor: '#00000f',
            weakColor: 'gray',
            radarColor: '#47a042',
            l10n: { repo: 'Repos' },
        });
        expect(radar.warnings.some((w) => w.path === 'l10n.repo')).toBeFalsy();
        expect(radar.errors).toEqual([]);
    });

    it('treats an empty type string as missing', () => {
        const result = validateSettingFile(
            { type: '', bogusKey: 1 },
            '{\n  "type": ""\n}',
        );
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].path).toEqual('type');
        expect(result.errors[0].message).toContain('missing "type"');
        expect(result.errors[0].line).toEqual(2);
    });

    it('returns when a darkMode entry is not an object', () => {
        const result = validateSettingFile({
            type: 'bitmap',
            contribPatterns: 'nope',
            darkMode: { type: 'bitmap', contribPatterns: 'nope' },
        });
        expect(result.errors).toEqual([]);
        // one from the parent, one from the nested entry
        expect(
            result.warnings.filter(
                (w) =>
                    w.path === 'contribPatterns' ||
                    w.path === 'darkMode.contribPatterns',
            ),
        ).toHaveLength(2);
    });

    it('warns on a non-object darkMode', () => {
        const result = validateSettingFile({ ...validNormal, darkMode: 'dark' });
        expect(
            result.warnings.some(
                (w) =>
                    w.path === 'darkMode' &&
                    w.message.includes('expected an object'),
            ),
        ).toBeTruthy();
    });

    it('warns on an empty settings array', () => {
        const result = validateSettingFile([]);
        expect(result.errors).toEqual([]);
        expect(
            result.warnings.some((w) => w.message.includes('array is empty')),
        ).toBeTruthy();
    });


    it('warns on a missing rainbow contribLightness', () => {
        const { contribLightness, ...rest } = validRainbow;
        expect(contribLightness).toBeDefined();
        const result = validateSettingFile(rest);
        expect(
            result.warnings.some(
                (w) =>
                    w.path === 'contribLightness' &&
                    w.message.includes('missing field'),
            ),
        ).toBeTruthy();
    });

    it('blocks a top panel without a foregroundColor', () => {
        const top: Record<string, unknown> = { ...validTopPanel };
        delete top.foregroundColor;
        const result = validateSettingFile({
            ...validBitmap,
            contribPatterns: [{ top }],
        });
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].path).toEqual(
            'contribPatterns[0].top.foregroundColor',
        );
    });


    it('locates the offending key in a pretty-printed file', () => {
        const rawText = '{\n  "type": "bitmap",\n  "bogusKey": 1\n}';
        const result = validateSettingFile(
            {
                type: 'bitmap',
                bogusKey: 1,
                darkMode: {
                    bogusKey: 2,
                    contribPatterns: [{ top: 'nope' }],
                },
            },
            rawText,
        );
        const unknown = result.warnings.filter((w) =>
            w.message.includes('unknown field "bogusKey"'),
        );
        expect(unknown).toHaveLength(2);
        // A nested entry without its own `type` cannot be located by key.
        expect(
            result.errors.some(
                (e) => e.path === 'darkMode.contribPatterns[0].top',
            ),
        ).toBeTruthy();
        const [top, nested] = unknown;
        expect(top.line).toEqual(3);
        expect(nested.path).toEqual('darkMode.bogusKey');
        expect(nested.line).toBeUndefined();
    });

    it('does not treat whitespace inside a pretty-printed file as a hit', () => {
        const rawText = '{\n\n  \n  "type": "bitmap"\n}';
        const missing: Record<string, unknown> = { type: 'bitmap' };
        const result = validateSettingFile(missing, rawText);
        const contribPatterns = result.warnings.find(
            (w) => w.path === 'contribPatterns',
        );
        expect(missing).not.toHaveProperty('contribPatterns');
        expect(result.errors).toEqual([]);
        expect(contribPatterns).toBeDefined();
    });

    it('locates top-level keys in pretty-printed JSON', () => {
        const rawText = '{\n  "a": 1,\n  "type": "normal"\n}';
        expect(findKeyLine(rawText, 'type')).toEqual(3);
        expect(findKeyLine(rawText, 'missing')).toBeUndefined();
    });
});
