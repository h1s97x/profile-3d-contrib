/**
 * Structured error code system.
 *
 * Every user-facing failure carries a stable `E_*` code, a short
 * message and optional actionable hints. Exit code convention:
 * 1 = configuration / input error, 2 = remote API error.
 */
export const ErrorCode = {
    TOKEN_MISSING: 'E_TOKEN_MISSING',
    USERNAME_MISSING: 'E_USERNAME_MISSING',
    MAX_REPOS_INVALID: 'E_MAX_REPOS_INVALID',
    YEAR_INVALID: 'E_YEAR_INVALID',
    YEAR_EMPTY: 'E_YEAR_EMPTY',
    SETTINGS_INVALID: 'E_SETTINGS_INVALID',
    FILENAME_INVALID: 'E_FILENAME_INVALID',
    GITHUB_NO_DATA: 'E_GITHUB_NO_DATA',
    GITHUB_AUTH: 'E_GITHUB_AUTH',
    GITHUB_RATE_LIMIT: 'E_GITHUB_RATE_LIMIT',
    GITHUB_NETWORK: 'E_GITHUB_NETWORK',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const EXIT_CODE_BY_ERROR: Readonly<Record<ErrorCode, number>> = {
    E_TOKEN_MISSING: 1,
    E_USERNAME_MISSING: 1,
    E_MAX_REPOS_INVALID: 1,
    E_YEAR_INVALID: 1,
    E_YEAR_EMPTY: 1,
    E_SETTINGS_INVALID: 1,
    E_FILENAME_INVALID: 1,
    E_GITHUB_NO_DATA: 2,
    E_GITHUB_AUTH: 2,
    E_GITHUB_RATE_LIMIT: 2,
    E_GITHUB_NETWORK: 2,
};

export class AppError extends Error {
    constructor(
        readonly code: ErrorCode,
        message: string,
        readonly hints: ReadonlyArray<string> = [],
    ) {
        super(`[${code}] ${message}`);
        this.name = 'AppError';
    }

    get exitCode(): number {
        return EXIT_CODE_BY_ERROR[this.code] ?? 1;
    }
}

/** Format any thrown value for `console.error`, keeping AppError hints. */
export const formatError = (error: unknown): string => {
    if (error instanceof AppError) {
        const hints = error.hints.map((hint) => `  hint: ${hint}`);
        return [error.message, ...hints].join('\n');
    }
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
};
