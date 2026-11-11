import * as aggregate from './aggregate-user-info';
import * as aggregateCnb from './aggregate-cnb-info';
import * as client from './github-graphql';
import * as cnbApi from './cnb-api';
import * as type from './type';
import { AppError, ErrorCode } from './errors';

/**
 * Data source abstraction.
 *
 * GitHub and CNB expose very different APIs, but both are mapped onto
 * the same `type.UserInfo` model, so the renderer never knows which
 * platform the data came from.
 */

export type Platform = 'github' | 'cnb';

export interface FetchOptions {
    token: string;
    userName: string;
    maxRepos: number;
    year: number | null;
}

/**
 * Decide which platform to query.
 *
 * Priority:
 * 1. explicit `PLATFORM` environment variable;
 * 2. automatic detection — CNB pipelines inject `CNB_TOKEN`, so its
 *    presence selects CNB;
 * 3. GitHub, the historical default.
 */
export const detectPlatform = (
    env: NodeJS.ProcessEnv = process.env,
): Platform => {
    const explicit = env.PLATFORM?.trim().toLowerCase();
    if (explicit) {
        if (explicit === 'github' || explicit === 'cnb') {
            return explicit;
        }
        throw new AppError(
            ErrorCode.PLATFORM_INVALID,
            `PLATFORM must be "github" or "cnb": "${env.PLATFORM ?? ''}"`,
            ['remove PLATFORM to auto-detect, or set it to "github" / "cnb"'],
        );
    }
    if (env.CNB_TOKEN) {
        return 'cnb';
    }
    return 'github';
};

/** Token environment variable name for a platform. */
export const tokenEnvName = (platform: Platform): string =>
    platform === 'cnb' ? 'CNB_TOKEN' : 'GITHUB_TOKEN';

/** Read the token for a platform, failing fast when it is missing. */
export const resolveToken = (
    platform: Platform,
    env: NodeJS.ProcessEnv = process.env,
): string => {
    const name = tokenEnvName(platform);
    const token = env[name];
    if (!token) {
        throw new AppError(
            ErrorCode.TOKEN_MISSING,
            `${name} is empty`,
            platform === 'cnb'
                ? [
                      'CNB pipelines provide CNB_TOKEN automatically; otherwise create an access token with the account-engage:r (read) scope',
                  ]
                : ['set a personal access token as the GITHUB_TOKEN secret'],
        );
    }
    return token;
};

/** Fetch and normalize profile data for the given platform. */
export const fetchUserInfo = async (
    platform: Platform,
    options: FetchOptions,
): Promise<type.UserInfo> => {
    if (platform === 'cnb') {
        const calendar = await cnbApi.fetchCalendar(
            options.token,
            options.userName,
            options.year,
        );
        const repos = await cnbApi.fetchRepos(
            options.token,
            options.userName,
            options.maxRepos,
        );
        return aggregateCnb.aggregateCnbUserInfo(calendar, repos, options.year);
    }
    const response = await client.fetchData(
        options.token,
        options.userName,
        options.maxRepos,
        options.year,
    );
    return aggregate.aggregateUserInfo(response);
};
