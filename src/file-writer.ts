import { mkdirSync, writeFileSync } from 'fs';
import { AppError, ErrorCode } from './errors';

export const OUTPUT_FOLDER = './profile-3d-contrib';

/**
 * Only plain file names are allowed: no path separators, no parent
 * directory references, no hidden files, no Windows drive names.
 * `fileName` can come from a user-provided settings JSON, so writing
 * must never escape OUTPUT_FOLDER.
 */
const SAFE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;

export const DEFAULT_FILE_NAME = 'profile-customize.svg';

/**
 * Same shape rule as `sanitizeFileName`, exposed so the settings reader
 * can decide *before* rendering whether a user-provided name is usable.
 */
export const isSafeFileName = (fileName: string): boolean =>
    SAFE_FILE_NAME.test(fileName) && !fileName.includes('..');

/**
 * Narrower than `isSafeFileName`: a plain-but-unusual name (an uppercase
 * suffix, say) is merely warned about, while anything that can leave
 * OUTPUT_FOLDER — separators, `..` segments, a leading dot — is rejected.
 */
export const escapesOutputFolder = (fileName: string): boolean =>
    !isSafeFileName(fileName) &&
    (fileName.includes('..') ||
        fileName.includes('/') ||
        fileName.includes('\\') ||
        fileName.startsWith('.'));

export const sanitizeFileName = (fileName: string): string => {
    if (!isSafeFileName(fileName)) {
        throw new AppError(
            ErrorCode.FILENAME_INVALID,
            `invalid output file name: "${fileName}"`,
            [
                'use a plain file name such as "profile-customize.svg"',
                'path separators, ".." segments and leading dots are not allowed',
            ],
        );
    }
    return fileName;
};

let isOutputFolderCreated = false;

const createOutputFolder = (): void => {
    if (!isOutputFolderCreated) {
        mkdirSync(OUTPUT_FOLDER, { recursive: true });
        isOutputFolderCreated = true;
    }
};

export const writeFile = (fileName: string, content: string): void => {
    createOutputFolder();
    writeFileSync(`${OUTPUT_FOLDER}/${sanitizeFileName(fileName)}`, content);
};
