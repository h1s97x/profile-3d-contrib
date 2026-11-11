import axios from 'axios';
import { AppError, ErrorCode } from './errors';

/**
 * Thin client for the CNB OpenAPI (https://api.cnb.cool).
 *
 * Inside a CNB pipeline both `CNB_TOKEN` and `CNB_API_ENDPOINT` are
 * injected automatically, so the defaults below normally need no
 * configuration. Only the endpoints needed to build a contribution
 * card are implemented.
 */

/** One day in `GET /users/{username}/calendar`. */
export interface ActivityCalendarDate {
    commit_count?: number;
    issues_count?: number;
    pr_count?: number;
    score?: number;
    valid_cr_count?: number;
    valid_pr_count?: number;
}

/** `GET /users/{username}/calendar` -> { "YYYY-MM-DD": ActivityCalendarDate }. */
export type ActivityCalendar = { [date: string]: ActivityCalendarDate };

/** Primary language of a repository (`languages` field of `dto.Repos4User`). */
export interface RepoLanguage {
    color?: string;
    language?: string;
}

/** Subset of `dto.Repos4User` used by the aggregation layer. */
export interface CnbRepo {
    name?: string;
    path?: string;
    star_count?: number;
    fork_count?: number;
    languages?: RepoLanguage;
    created_at?: string;
    web_url?: string;
}

const DEFAULT_API_ENDPOINT = 'https://api.cnb.cool';
const PAGE_SIZE = 100;

const apiEndpoint = (): string => {
    const raw = process.env.CNB_API_ENDPOINT || DEFAULT_API_ENDPOINT;
    return raw.replace(/\/+$/, '');
};

/** Pull `errmsg` out of a CNB error body, if the response carries one. */
const serverMessage = (data: unknown): string | null => {
    if (data && typeof data === 'object' && 'errmsg' in data) {
        const { errmsg } = data as { errmsg?: unknown };
        if (typeof errmsg === 'string' && errmsg.length > 0) {
            return errmsg;
        }
    }
    return null;
};

const toAppError = (action: string, error: unknown): AppError => {
    if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const detail = serverMessage(error.response?.data);
        const suffix = detail ? `: ${detail}` : '';
        if (status === 401 || status === 403) {
            return new AppError(
                ErrorCode.API_BAD_RESPONSE,
                `${action} was rejected by the CNB API (HTTP ${status})${suffix}`,
                [
                    'CNB_TOKEN needs the account-engage:r (read) scope',
                    'inside a CNB pipeline CNB_TOKEN is provided automatically; check that the pipeline imports it',
                ],
            );
        }
        if (status === 404) {
            return new AppError(
                ErrorCode.API_BAD_RESPONSE,
                `${action} returned 404, user may not exist on CNB${suffix}`,
                ['verify USERNAME (PROFILE_NAME on CNB) points to an existing CNB account'],
            );
        }
        return new AppError(
            ErrorCode.API_BAD_RESPONSE,
            `${action} failed (HTTP ${status ?? 'no response'})${suffix}`,
            ['check connectivity to the CNB API endpoint'],
        );
    }
    return new AppError(
        ErrorCode.API_BAD_RESPONSE,
        `${action} failed: ${error instanceof Error ? error.message : String(error)}`,
        ['check connectivity to the CNB API endpoint'],
    );
};

const authHeaders = (token: string): { Authorization: string } => ({
    Authorization: `Bearer ${token}`,
});

/**
 * Fetch the activity calendar of a user.
 *
 * @param year `yyyy` style year, `null` means "the past year" which is
 *             the CNB API default when `year` is omitted.
 */
export const fetchCalendar = async (
    token: string,
    userName: string,
    year: number | null,
): Promise<ActivityCalendar> => {
    try {
        const response = await axios.get<ActivityCalendar>(
            `${apiEndpoint()}/users/${encodeURIComponent(userName)}/calendar`,
            {
                headers: authHeaders(token),
                params: year === null ? {} : { year: String(year) },
                timeout: 30000,
            },
        );
        return response.data ?? {};
    } catch (error) {
        throw toAppError(`fetching the CNB activity calendar of "${userName}"`, error);
    }
};

/**
 * Fetch owned repositories of a user, newest first, capped at `maxRepos`.
 *
 * The cap is enforced locally (like the GitHub data source) so the star /
 * fork totals never include repositories beyond the requested limit.
 */
export const fetchRepos = async (
    token: string,
    userName: string,
    maxRepos: number,
): Promise<CnbRepo[]> => {
    const repos: CnbRepo[] = [];
    for (let page = 1; ; page += 1) {
        let batch: CnbRepo[];
        try {
            const response = await axios.get<CnbRepo[]>(
                `${apiEndpoint()}/users/${encodeURIComponent(userName)}/repos`,
                {
                    headers: authHeaders(token),
                    params: { page, page_size: PAGE_SIZE },
                    timeout: 30000,
                },
            );
            batch = Array.isArray(response.data) ? response.data : [];
        } catch (error) {
            throw toAppError(
                `fetching the CNB repositories of "${userName}"`,
                error,
            );
        }
        repos.push(...batch);
        if (repos.length >= maxRepos || batch.length < PAGE_SIZE) {
            break;
        }
    }
    return repos.slice(0, maxRepos);
};
