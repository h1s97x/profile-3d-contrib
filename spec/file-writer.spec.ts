import {
    DEFAULT_FILE_NAME,
    OUTPUT_FOLDER,
    escapesOutputFolder,
    isSafeFileName,
    sanitizeFileName,
    writeFile,
} from '../src/file-writer';
import { AppError, ErrorCode } from '../src/errors';
import { rmSync, readFileSync, existsSync } from 'fs';

afterEach(() => {
    rmSync(OUTPUT_FOLDER, { recursive: true, force: true });
});

describe('file-writer', () => {
    it('writeFile', () => {
        writeFile('write-svg.svg', 'work');
        const content = readFileSync(`${OUTPUT_FOLDER}/write-svg.svg`, {
            encoding: 'utf8',
            flag: 'r',
        });
        expect(content).toEqual('work');
    });

    it('accepts plain customize file names', () => {
        expect(sanitizeFileName('profile-customize.svg')).toEqual(
            'profile-customize.svg',
        );
        expect(sanitizeFileName('green.dark.svg')).toEqual('green.dark.svg');
    });

    it.each([
        ['parent traversal', '../evil.svg'],
        ['nested traversal', 'foo/../../evil.svg'],
        ['unix absolute', '/etc/passwd'],
        ['windows absolute', 'C:\\\\Windows\\\\evil.svg'],
        ['sub directory', 'sub/dir.svg'],
        ['hidden file', '.hidden.svg'],
        ['empty name', ''],
    ])('rejects %s', (_label, fileName) => {
        try {
            sanitizeFileName(fileName);
            fail('expected sanitizeFileName to throw');
        } catch (error) {
            expect(error).toBeInstanceOf(AppError);
            expect((error as AppError).code).toEqual(
                ErrorCode.FILENAME_INVALID,
            );
        }
    });

    it('does not write outside the output folder', () => {
        expect(() => writeFile('../escape.svg', 'work')).toThrow(AppError);
        expect(existsSync('escape.svg')).toBeFalsy();
    });
});

describe('isSafeFileName', () => {
    it('matches the sanitizer without throwing', () => {
        expect(isSafeFileName('profile-customize.svg')).toBeTruthy();
        expect(isSafeFileName('sub/dir.svg')).toBeFalsy();
        expect(isSafeFileName('../evil.svg')).toBeFalsy();
    });

    it('exposes the default name used as a fallback', () => {
        expect(isSafeFileName(DEFAULT_FILE_NAME)).toBeTruthy();
    });
});

describe('escapesOutputFolder', () => {
    it.each([
        ['parent traversal', '../evil.svg'],
        ['nested path', 'sub/dir.svg'],
        ['windows separator', 'sub\\dir.svg'],
        ['hidden file', '.hidden.svg'],
    ])('flags %s', (_label, fileName) => {
        expect(escapesOutputFolder(fileName)).toBeTruthy();
    });

    it.each([
        ['plain name', 'profile-customize.svg'],
        ['dot in name', 'green.dark.svg'],
        ['unusual but contained', 'Profile.SVG'],
    ])('does not flag %s', (_label, fileName) => {
        expect(escapesOutputFolder(fileName)).toBeFalsy();
    });
});
