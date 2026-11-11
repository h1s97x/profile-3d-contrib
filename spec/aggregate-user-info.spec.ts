import * as aggregate from '../src/aggregate-user-info'
import * as client from '../src/github-graphql';
import * as type from '../src/type';
import { AppError, ErrorCode, formatError } from '../src/errors';
import { dummyData } from './dummy-data';

describe('github-graphql', () => {
    it('fetchData', () => {
        const userInfo = aggregate.aggregateUserInfo(dummyData);

        expect(userInfo.contributionCalendar.length).toEqual(371);

        const languages: Array<type.LangInfo> = [
            {
                "language": "Jupyter Notebook",
                "color": "#DA5B0B",
                "contributions": 108
            },
            {
                "language": "Perl",
                "color": "#0298c3",
                "contributions": 73
            },
            {
                "language": "Kotlin",
                "color": "#F18E33",
                "contributions": 58
            },
            {
                "language": "TypeScript",
                "color": "#2b7489",
                "contributions": 31
            },
            {
                "language": "Java",
                "color": "#b07219",
                "contributions": 28
            },
            {
                "language": "Go",
                "color": "#00ADD8",
                "contributions": 20
            },
            {
                "language": "Python",
                "color": "#3572A5",
                "contributions": 10
            },
            {
                "language": "JavaScript",
                "color": "#f1e05a",
                "contributions": 7
            },
            {
                "language": "C",
                "color": "#555555",
                "contributions": 4
            },
            {
                "language": "Ruby",
                "color": "#701516",
                "contributions": 1
            }
        ];
        expect(userInfo.contributesLanguage).toEqual(languages);

        expect(userInfo.totalContributions).toEqual(366);
        expect(userInfo.totalCommitContributions).toEqual(344);
        expect(userInfo.totalIssueContributions).toEqual(4);
        expect(userInfo.totalPullRequestContributions).toEqual(12);
        expect(userInfo.totalPullRequestReviewContributions).toEqual(0);
        expect(userInfo.totalRepositoryContributions).toEqual(6);
        expect(userInfo.totalForkCount).toEqual(0);
        expect(userInfo.totalStargazerCount).toEqual(6);
    });

    it('throws a sanitized error on GraphQL errors without data', () => {
        const response: client.ResponseType = {
            errors: [
                { message: "Could not resolve to a User with the login of 'secret-user'." },
                { message: 'Some secondary error.' },
            ],
        };
        expect(() => aggregate.aggregateUserInfo(response)).toThrow(
            "GitHub GraphQL error: Could not resolve to a User with the login of 'secret-user'.; Some secondary error.",
        );
        try {
            aggregate.aggregateUserInfo(response);
            fail('expected aggregateUserInfo to throw');
        } catch (error) {
            expect(error).toBeInstanceOf(AppError);
            expect((error as AppError).code).toEqual(
                ErrorCode.API_BAD_RESPONSE,
            );
            expect((error as AppError).exitCode).toEqual(2);
        }
    });

    it('does not dump the raw response when data is missing', () => {
        const response = {
            data: undefined,
            extensions: { privateRepoName: 'my-secret-repo' },
        } as unknown as client.ResponseType;
        expect(() => aggregate.aggregateUserInfo(response)).toThrow(
            AppError,
        );
        // The thrown message must not echo the response payload; assert on
        // the serialized error instead of the return value, which is void.
        try {
            aggregate.aggregateUserInfo(response);
            fail('expected aggregateUserInfo to throw');
        } catch (error) {
            expect(formatError(error)).not.toContain('my-secret-repo');
        }
    });
});
