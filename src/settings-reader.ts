import { readFileSync } from 'fs';
import * as type from './type';
import { AppError, ErrorCode } from './errors';
import { validateSettingFile } from './settings-validator';
import {
    escapesOutputFolder,
    isSafeFileName,
    sanitizeFileName,
} from './file-writer';

const toLineColumn = (
    content: string,
    position: number,
): { line: number; column: number } => {
    const before = content.slice(0, position);
    const lines = before.split('\n');
    return {
        line: lines.length,
        column: before.length - before.lastIndexOf('\n'),
    };
};

const parseJson = (content: string, filePath: string): unknown => {
    try {
        return JSON.parse(content) as unknown;
    } catch (error) {
        // Node parse errors look like: "... in JSON at position 123"
        const detail =
            error instanceof Error ? error.message : 'unknown parse error';
        const position = /position (\d+)/.exec(detail);
        const where = position
            ? (() => {
                  const { line, column } = toLineColumn(
                      content,
                      Number(position[1]),
                  );
                  return ` at line ${line}, column ${column}`;
              })()
            : '';
        throw new AppError(
            ErrorCode.SETTINGS_INVALID,
            `failed to parse settings JSON ${filePath}${where}: ${detail}`,
            ['check for trailing commas, comments or unquoted keys'],
        );
    }
};

/**
 * `fileName` is the only field that reaches the filesystem, so it is
 * checked *before* any rendering: silently writing elsewhere is worse
 * than failing. A name that merely looks odd is left to
 * `collectFileNameWarnings`; one that can leave the output folder — path
 * separators, `..`, a leading dot — is blocking.
 */
const ensureSafeFileNames = (parsed: unknown): void => {
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    entries.forEach((entry) => {
        if (!entry || typeof entry !== 'object') {
            return;
        }
        const { fileName } = entry as { fileName?: unknown };
        if (typeof fileName !== 'string') {
            return;
        }
        if (!escapesOutputFolder(fileName)) {
            return;
        }
        sanitizeFileName(fileName);
    });
};

/** Non-blocking notice for a `fileName` that is dropped in favour of the default. */
const collectFileNameWarnings = (parsed: unknown): string[] => {
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    const messages: string[] = [];
    entries.forEach((entry, index) => {
        if (!entry || typeof entry !== 'object') {
            return;
        }
        const { fileName } = entry as { fileName?: unknown };
        if (typeof fileName === 'string' && !isSafeFileName(fileName)) {
            const where = Array.isArray(parsed)
                ? `[${index}].fileName`
                : 'fileName';
            messages.push(
                `${where}: "${fileName}" is not a plain file name; using the default name`,
            );
        }
    });
    return messages;
};

export const readSettingJson = (filePath: string): type.SettingFile => {
    let content: string;
    try {
        content = readFileSync(filePath, {
            encoding: 'utf8',
            flag: 'r',
        });
    } catch {
        throw new AppError(
            ErrorCode.SETTINGS_INVALID,
            `cannot read settings file: ${filePath}`,
            ['check the SETTING_JSON path'],
        );
    }

    const parsed = parseJson(content, filePath);
    const { errors, warnings } = validateSettingFile(parsed, content);

    for (const warning of warnings) {
        const where = warning.line ? ` (line ${warning.line})` : '';
        console.warn(
            `WARNING: settings ${warning.path}${where}: ${warning.message}`,
        );
    }
    // Path traversal is blocking; an unusual-but-contained name only warns.
    ensureSafeFileNames(parsed);
    for (const warning of collectFileNameWarnings(parsed)) {
        console.warn(`WARNING: ${warning}`);
    }
    if (errors.length > 0) {
        const details = errors
            .map((issue) => {
                const where = issue.line ? ` (line ${issue.line})` : '';
                return `  - ${issue.path}${where}: ${issue.message}`;
            })
            .join('\n');
        throw new AppError(
            ErrorCode.SETTINGS_INVALID,
            `invalid settings JSON ${filePath}:\n${details}`,
        );
    }
    return parsed as type.SettingFile;
};
