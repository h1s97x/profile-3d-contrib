import { readSettingJson } from '../src/settings-reader';
import { AppError, ErrorCode } from '../src/errors';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let workDir: string;

beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'settings-reader-'));
});

afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
});

const writeSettings = (name: string, content: string): string => {
    const filePath = join(workDir, name);
    writeFileSync(filePath, content);
    return filePath;
};

describe('settings-reader', () => {
    it('readSettingJson(Single Settings)', () => {
        const settings = readSettingJson('./spec/settings.json');
        if ('type' in settings) {
            expect(settings.type).toEqual('normal');
            expect(settings.backgroundColor).toEqual('#ffffff');
            expect(settings.foregroundColor).toEqual('#00000f');
        } else {
            throw new Error('invalid value');
        }
    });

    it('readSettingJson(Multiple Settings)', () => {
        const settings = readSettingJson('./spec/settings2.json');
        if ('length' in settings) {
            expect(settings.length).toEqual(2);
            expect(settings[0].type).toEqual('normal');
            expect(settings[1].type).toEqual('rainbow');
        } else {
            throw new Error('invalid value');
        }
    });

    it('fails with E_SETTINGS_INVALID on an unknown type', () => {
        const filePath = writeSettings(
            'typo.json',
            '{\n  "type": "norml",\n  "backgroundColor": "#fff"\n}\n',
        );
        try {
            readSettingJson(filePath);
            fail('expected readSettingJson to throw');
        } catch (error) {
            expect(error).toBeInstanceOf(AppError);
            const appError = error as AppError;
            expect(appError.code).toEqual(ErrorCode.SETTINGS_INVALID);
            expect(appError.exitCode).toEqual(1);
            expect(appError.message).toContain('norml');
            expect(appError.message).toContain('line 2');
            expect(appError.message).toContain('normal');
        }
    });

    it('fails with line info on malformed JSON', () => {
        const filePath = writeSettings(
            'broken.json',
            '{\n  "type": "normal",\n}\n',
        );
        expect(() => readSettingJson(filePath)).toThrow(
            /E_SETTINGS_INVALID.*line 3/s,
        );
    });

    it('fails on a missing file', () => {
        expect(() =>
            readSettingJson(join(workDir, 'no-such-file.json')),
        ).toThrow(/E_SETTINGS_INVALID/);
    });

    it('warns instead of failing on an unusual fileName', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        const filePath = writeSettings(
            'unsafe-name.json',
            JSON.stringify({
                type: 'normal',
                backgroundColor: '#ffffff',
                foregroundColor: '#00000f',
                strongColor: '#111133',
                weakColor: 'gray',
                radarColor: '#47a042',
                contribColors: [
                    '#efefef',
                    '#d8e887',
                    '#8cc569',
                    '#47a042',
                    '#1d6a23',
                ],
                fileName: 'custom name.svg',
            }),
        );
        const settings = readSettingJson(filePath);
        expect('type' in settings && settings.fileName).toEqual(
            'custom name.svg',
        );
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('fileName: "custom name.svg"'),
        );
        warnSpy.mockRestore();
    });

    it.each([
        ['parent traversal', '../../escape.svg'],
        ['nested path', 'out/custom.svg'],
        ['hidden file', '.hidden.svg'],
    ])('rejects a fileName with %s', (label, fileName) => {
        const filePath = writeSettings(
            `unsafe-${label.replace(/ /g, '-')}.json`,
            JSON.stringify({
                type: 'normal',
                backgroundColor: '#ffffff',
                foregroundColor: '#00000f',
                strongColor: '#111133',
                weakColor: 'gray',
                radarColor: '#47a042',
                contribColors: [
                    '#efefef',
                    '#d8e887',
                    '#8cc569',
                    '#47a042',
                    '#1d6a23',
                ],
                fileName,
            }),
        );
        expect(() => readSettingJson(filePath)).toThrow(/E_FILENAME_INVALID/);
    });

    it('skips fileName checks for non-object entries', () => {
        const filePath = writeSettings(
            'mixed-array.json',
            JSON.stringify([
                'not-an-object',
                {
                    type: 'normal',
                    backgroundColor: '#ffffff',
                    foregroundColor: '#00000f',
                    strongColor: '#111133',
                    weakColor: 'gray',
                    radarColor: '#47a042',
                    contribColors: [
                        '#efefef',
                        '#d8e887',
                        '#8cc569',
                        '#47a042',
                        '#1d6a23',
                    ],
                    fileName: 'custom name.svg',
                },
            ]),
        );
        expect(() => readSettingJson(filePath)).toThrow(
            /\[0\]: settings must be a JSON object/,
        );
    });

    it('wraps a non-Error parse failure', () => {
        const filePath = writeSettings('ok.json', '{"type": "normal"}');
        const parse = jest.spyOn(JSON, 'parse').mockImplementationOnce(() => {
            // eslint-disable-next-line @typescript-eslint/only-throw-error
            throw 'boom';
        });
        try {
            expect(() => readSettingJson(filePath)).toThrow(
                /failed to parse settings JSON/,
            );
        } finally {
            parse.mockRestore();
        }
    });

    it('reports a syntax error without a position', () => {
        const filePath = writeSettings('no-position.json', '{,}');
        const parse = jest.spyOn(JSON, 'parse').mockImplementationOnce(() => {
            throw new Error('Unexpected token');
        });
        try {
            expect(() => readSettingJson(filePath)).toThrow(
                /failed to parse settings JSON/,
            );
        } finally {
            parse.mockRestore();
        }
    });

    it('warns without a line number when the issue has none', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        const filePath = writeSettings(
            'no-line.json',
            JSON.stringify({
                type: 'rainbow',
                saturation: '80%',
                contribLightness: [10, 20, 30],
                duration: '10s',
                hueRatio: 1,
            }),
        );
        readSettingJson(filePath);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringMatching(/^WARNING: settings .*: missing field/),
        );
        warnSpy.mockRestore();
    });

    it('warns on a non-string fileName', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        const filePath = writeSettings(
            'bad-fileName.json',
            JSON.stringify({
                type: 'normal',
                backgroundColor: '#ffffff',
                foregroundColor: '#00000f',
                strongColor: '#111133',
                weakColor: 'gray',
                radarColor: '#47a042',
                contribColors: [
                    '#efefef',
                    '#d8e887',
                    '#8cc569',
                    '#47a042',
                    '#1d6a23',
                ],
                fileName: 42,
            }),
        );
        readSettingJson(filePath);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('fileName: expected a string'),
        );
        warnSpy.mockRestore();
    });

    it('warns without blocking on minor issues', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        const filePath = writeSettings(
            'warn.json',
            JSON.stringify({
                type: 'normal',
                backgroundColor: '#ffffff',
                foregroundColor: '#00000f',
                strongColor: '#111133',
                weakColor: 'gray',
                radarColor: '#47a042',
                contribColors: ['#efefef', '#d8e887'],
            }),
        );
        const settings = readSettingJson(filePath);
        expect('type' in settings && settings.type).toEqual('normal');
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('WARNING: settings'),
        );
        warnSpy.mockRestore();
    });
});
