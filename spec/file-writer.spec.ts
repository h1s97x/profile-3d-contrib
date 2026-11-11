import { writeFile, sanitizeFileName, OUTPUT_FOLDER } from "../src/file-writer";
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
