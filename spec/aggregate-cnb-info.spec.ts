import * as aggregateCnb from '../src/aggregate-cnb-info';
import * as cnb from '../src/cnb-api';

const NOW = new Date('2024-12-31T12:00:00Z');

const day = (
    commit = 0,
    issues = 0,
    pr = 0,
    cr = 0,
): cnb.ActivityCalendarDate => ({
    commit_count: commit,
    issues_count: issues,
    pr_count: pr,
    valid_cr_count: cr,
});

describe('aggregate-cnb-info calendar', () => {
    it('pads the requested year with zero-count days', () => {
        const calendar = { '2024-03-01': day(2) };

        const userInfo = aggregateCnb.aggregateCnbUserInfo(
            calendar,
            [],
            2024,
            NOW,
        );

        expect(userInfo.contributionCalendar).toHaveLength(366); // leap year
        expect(userInfo.contributionCalendar[0].date.toISOString()).toBe(
            '2024-01-01T00:00:00.000Z',
        );
        const marchFirst = userInfo.contributionCalendar.find(
            (info) => info.date.toISOString().slice(0, 10) === '2024-03-01',
        );
        expect(marchFirst?.contributionCount).toBe(2);
        expect(marchFirst?.contributionLevel).toBeGreaterThan(0);
    });

    it('accepts the compact YYYYMMDD keys the live API returns', () => {
        const calendar = {
            '20240301': day(2),
            '20240302': day(0, 1),
        };

        const userInfo = aggregateCnb.aggregateCnbUserInfo(
            calendar,
            [],
            2024,
            NOW,
        );

        const counts = userInfo.contributionCalendar
            .filter((info) =>
                ['2024-03-01', '2024-03-02'].includes(
                    info.date.toISOString().slice(0, 10),
                ),
            )
            .map((info) => info.contributionCount);
        expect(counts).toEqual([2, 1]);
        expect(userInfo.totalContributions).toBe(3);
    });

    it('stops the current year at today like GitHub does', () => {
        const userInfo = aggregateCnb.aggregateCnbUserInfo(
            {},
            [],
            2024,
            new Date('2024-06-15T08:00:00Z'),
        );

        const last = userInfo.contributionCalendar.slice(-1)[0];
        expect(last.date.toISOString().slice(0, 10)).toBe('2024-06-15');
        expect(userInfo.contributionCalendar).toHaveLength(167);
    });

    it('fills gaps inside the range of a rolling year', () => {
        const calendar = {
            '2024-01-05': day(1),
            '2024-01-08': day(3),
        };

        const userInfo = aggregateCnb.aggregateCnbUserInfo(calendar, [], null, NOW);

        expect(userInfo.contributionCalendar).toHaveLength(4);
        const gap = userInfo.contributionCalendar.find(
            (info) => info.date.toISOString().slice(0, 10) === '2024-01-07',
        );
        expect(gap?.contributionCount).toBe(0);
        expect(gap?.contributionLevel).toBe(0);
    });

    it('returns an empty calendar when the API has no data', () => {
        const userInfo = aggregateCnb.aggregateCnbUserInfo({}, [], 2020, NOW);
        expect(userInfo.contributionCalendar).toHaveLength(366);
        expect(userInfo.totalContributions).toBe(0);
    });

    it('derives 0-4 levels from count quartiles', () => {
        const calendar: cnb.ActivityCalendar = {};
        for (let index = 1; index <= 8; index += 1) {
            const date = `2024-01-0${index}`;
            calendar[date] = day(index);
        }

        const userInfo = aggregateCnb.aggregateCnbUserInfo(
            calendar,
            [],
            2024,
            NOW,
        );
        const levels = userInfo.contributionCalendar
            .filter((info) => info.contributionCount > 0)
            .map((info) => info.contributionLevel);

        expect(levels).toEqual([1, 1, 1, 2, 2, 3, 3, 4]);
    });
});

describe('aggregate-cnb-info totals', () => {
    const calendar: cnb.ActivityCalendar = {
        '2024-02-01': day(5, 2, 1, 1),
        '2024-02-02': day(3, 0, 2, 0),
    };

    it('sums per-activity totals and total contributions', () => {
        const userInfo = aggregateCnb.aggregateCnbUserInfo(
            calendar,
            [],
            2024,
            NOW,
        );

        expect(userInfo.totalCommitContributions).toBe(8);
        expect(userInfo.totalIssueContributions).toBe(2);
        expect(userInfo.totalPullRequestContributions).toBe(3);
        expect(userInfo.totalPullRequestReviewContributions).toBe(1);
        expect(userInfo.totalContributions).toBe(13);
    });

    it('ignores days outside the requested year in the totals', () => {
        const wideCalendar: cnb.ActivityCalendar = {
            '2024-01-02': day(2, 1),
            '2023-12-30': day(100, 100), // before the requested year
            '2025-01-02': day(100, 100), // beyond the requested year
        };

        const yearInfo = aggregateCnb.aggregateCnbUserInfo(
            wideCalendar,
            [],
            2024,
            NOW,
        );

        expect(yearInfo.totalCommitContributions).toBe(2);
        expect(yearInfo.totalIssueContributions).toBe(1);
        expect(yearInfo.totalContributions).toBe(3);
    });

    it('ignores days after today in a rolling window', () => {
        const calendar: cnb.ActivityCalendar = {
            '2024-06-10': day(4),
            '2024-06-14': day(3),
            '2024-06-20': day(99), // future day, cannot be rendered
        };

        const userInfo = aggregateCnb.aggregateCnbUserInfo(
            calendar,
            [],
            null,
            new Date('2024-06-15T08:00:00Z'),
        );

        expect(userInfo.totalCommitContributions).toBe(7);
        expect(userInfo.totalContributions).toBe(7);
    });

    it('aggregates languages by repository count and stars/forks', () => {
        const repos: cnb.CnbRepo[] = [
            {
                star_count: 5,
                fork_count: 1,
                languages: { language: 'TypeScript', color: '#3178c6' },
            },
            {
                star_count: 3,
                fork_count: 2,
                languages: { language: 'TypeScript', color: '#3178c6' },
            },
            {
                star_count: 1,
                fork_count: 0,
                languages: { language: 'Rust', color: '#dea584' },
            },
            { star_count: 7, fork_count: 4 }, // no language, ignored by the pie
        ];

        const userInfo = aggregateCnb.aggregateCnbUserInfo(
            calendar,
            repos,
            2024,
            NOW,
        );

        expect(userInfo.contributesLanguage).toEqual([
            { language: 'TypeScript', color: '#3178c6', contributions: 2 },
            { language: 'Rust', color: '#dea584', contributions: 1 },
        ]);
        expect(userInfo.totalStargazerCount).toBe(16);
        expect(userInfo.totalForkCount).toBe(7);
    });

    it('counts repositories created within the period', () => {
        const repos: cnb.CnbRepo[] = [
            { created_at: '2024-02-01T00:00:00Z' },
            { created_at: '2024-06-01T00:00:00Z' },
            { created_at: '2023-12-31T00:00:00Z' }, // before the period
            { created_at: 'not-a-date' },
            {},
        ];

        const userInfo = aggregateCnb.aggregateCnbUserInfo(
            {},
            repos,
            2024,
            NOW,
        );

        expect(userInfo.totalRepositoryContributions).toBe(2);
    });
});

describe('aggregate-cnb-info halloween flag', () => {
    it('is true during October 25-31', () => {
        const userInfo = aggregateCnb.aggregateCnbUserInfo(
            {},
            [],
            2024,
            new Date('2024-10-28T00:00:00Z'),
        );
        expect(userInfo.isHalloween).toBe(true);
    });

    it('is false outside that window', () => {
        const userInfo = aggregateCnb.aggregateCnbUserInfo(
            {},
            [],
            2024,
            new Date('2024-10-20T00:00:00Z'),
        );
        expect(userInfo.isHalloween).toBe(false);
    });
});

describe('aggregate-cnb-info empty calendar', () => {
    it('returns an empty calendar without throwing (renderer fails fast)', () => {
        const userInfo = aggregateCnb.aggregateCnbUserInfo(
            {},
            [],
            null,
            NOW,
        );
        expect(userInfo.contributionCalendar).toEqual([]);
    });
});
