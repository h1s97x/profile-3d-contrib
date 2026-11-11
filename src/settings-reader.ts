import { readFileSync } from 'fs';
import * as type from './type';
import { AppError, ErrorCode } from './errors';
import { validateSettingFile } from './settings-validator';

const toLineColumn = (
    content: string,
    position: number,
): { line: number; column: number } => {
    const before = content.slice(0, position);
    const lines = before.split('\n');
    return { line: lines.length, column: before.length - before.lastIndexOf('\n') };
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
            `::warning::settings ${warning.path}${where}: ${warning.message}`,
        );
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
