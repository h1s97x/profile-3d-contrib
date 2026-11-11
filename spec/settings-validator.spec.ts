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
        expect(
            result.warnings.some((w) => w.message.includes('unknown field')),
        ).toBeTruthy();
    });

    it('locates top-level keys in pretty-printed JSON', () => {
        const rawText = '{\n  "a": 1,\n  "type": "normal"\n}';
        expect(findKeyLine(rawText, 'type')).toEqual(3);
        expect(findKeyLine(rawText, 'missing')).toBeUndefined();
    });
});
