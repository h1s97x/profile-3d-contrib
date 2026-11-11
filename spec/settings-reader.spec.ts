import { readSettingJson } from "../src/settings-reader";
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
        if ("type" in settings) {
            expect(settings.type).toEqual('normal');
            expect(settings.backgroundColor).toEqual('#ffffff');
            expect(settings.foregroundColor).toEqual('#00000f');
        } else {
            throw new Error("invalid value")
        }
    });

    it('readSettingJson(Multiple Settings)', () => {
        const settings = readSettingJson('./spec/settings2.json');
        if ("length" in settings) {
            expect(settings.length).toEqual(2);
            expect(settings[0].type).toEqual('normal');
            expect(settings[1].type).toEqual('rainbow');
        } else {
            throw new Error("invalid value")
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
            expect.stringContaining('::warning::'),
        );
        warnSpy.mockRestore();
    });
});
