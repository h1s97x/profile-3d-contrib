import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import * as dataSource from '../src/data-source';
import * as aggregate from '../src/aggregate-user-info';
import * as client from '../src/github-graphql';
import { AppError, ErrorCode } from '../src/errors';
import { dummyData } from './dummy-data';

const mock = new MockAdapter(axios);

afterEach(() => {
    mock.reset();
});

describe('data-source detectPlatform', () => {
    it('defaults to github', () => {
        expect(dataSource.detectPlatform({})).toBe('github');
    });

    it('detects CNB from the automatically injected CNB_TOKEN', () => {
        expect(dataSource.detectPlatform({ CNB_TOKEN: 'token' })).toBe('cnb');
    });

    it('honors an explicit PLATFORM', () => {
        expect(
            dataSource.detectPlatform({ PLATFORM: 'cnb', CNB_TOKEN: 'token' }),
        ).toBe('cnb');
        expect(
            dataSource.detectPlatform({ PLATFORM: 'GitHub', CNB_TOKEN: 'token' }),
        ).toBe('github');
        expect(
            dataSource.detectPlatform({ PLATFORM: ' cnb ' }),
        ).toBe('cnb');
    });

    it('rejects an unknown PLATFORM value', () => {
        const error = (() => {
            try {
                dataSource.detectPlatform({ PLATFORM: 'gitlab' });
                return null;
            } catch (e) {
                return e;
            }
        })();

        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.PLATFORM_INVALID);
    });
});

describe('data-source resolveToken', () => {
    it('reads GITHUB_TOKEN on github', () => {
        expect(
            dataSource.resolveToken('github', { GITHUB_TOKEN: 'gh' }),
        ).toBe('gh');
    });

    it('reads CNB_TOKEN on cnb', () => {
        expect(dataSource.resolveToken('cnb', { CNB_TOKEN: 'cnb-token' })).toBe(
            'cnb-token',
        );
    });

    it('prefers a user-provided CNB_ACCESS_TOKEN for private repositories', () => {
        const env = { CNB_TOKEN: 'pipeline-temp', CNB_ACCESS_TOKEN: 'pat' };
        expect(dataSource.detectPlatform({ CNB_ACCESS_TOKEN: 'pat' })).toBe('cnb');
        expect(dataSource.tokenEnvName('cnb', env)).toBe('CNB_ACCESS_TOKEN');
        expect(dataSource.resolveToken('cnb', env)).toBe('pat');
        expect(dataSource.tokenEnvName('cnb', { CNB_TOKEN: 'pipeline-temp' })).toBe(
            'CNB_TOKEN',
        );
    });

    it('fails with a platform specific hint when the token is missing', () => {
        const githubError = (() => {
            try {
                dataSource.resolveToken('github', {});
                return null;
            } catch (e) {
                return e;
            }
        })();
        const cnbError = (() => {
            try {
                dataSource.resolveToken('cnb', {});
                return null;
            } catch (e) {
                return e;
            }
        })();

        expect((githubError as AppError).code).toBe(ErrorCode.TOKEN_MISSING);
        expect((githubError as AppError).message).toContain('GITHUB_TOKEN');
        expect((cnbError as AppError).message).toContain('CNB_TOKEN');
    });
});

describe('data-source fetchUserInfo dispatch', () => {
    const options = {
        token: 'dummy-token',
        userName: 'alice',
        maxRepos: 100,
        year: 2024,
    };

    it('routes github through the GraphQL fetcher', async () => {
        mock.onPost(client.URL).reply(200, dummyData);

        const userInfo = await dataSource.fetchUserInfo('github', options);

        expect(userInfo).toEqual(aggregate.aggregateUserInfo(dummyData));
    });

    it('routes cnb through the REST fetcher and aggregator', async () => {
        mock.onGet(new RegExp('/users/alice/calendar')).reply(200, {
            '2024-01-02': { commit_count: 2, issues_count: 1 },
        });
        mock.onGet(new RegExp('/users/alice/repos')).reply(200, [
            {
                name: 'repo',
                star_count: 4,
                fork_count: 1,
                languages: { language: 'TypeScript', color: '#3178c6' },
            },
        ]);

        const userInfo = await dataSource.fetchUserInfo('cnb', options);

        expect(userInfo.contributionCalendar).toHaveLength(366);
        expect(userInfo.totalContributions).toBe(3);
        expect(userInfo.totalStargazerCount).toBe(4);
        expect(userInfo.contributesLanguage).toEqual([
            { language: 'TypeScript', color: '#3178c6', contributions: 1 },
        ]);
    });
});
