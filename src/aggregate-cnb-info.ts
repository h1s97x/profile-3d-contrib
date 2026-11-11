import * as type from './type';
import * as cnbApi from './cnb-api';

/**
 * Maps CNB OpenAPI payloads onto the platform-neutral `type.UserInfo`
 * model consumed by the renderer.
 *
 * Differences from the GitHub data source (documented in README):
 * - the CNB calendar exposes raw activity counts per day instead of
 *   GitHub's pre-computed 0-4 contribution levels, so levels are
 *   derived with the same quartile rule GitHub uses;
 * - language statistics are based on the primary language of each
 *   repository (CNB has no per-language contribution breakdown), so
 *   every repository weighs 1;
 * - pull request reviews are represented by `valid_cr_count`.
 */

const OTHER_COLOR = '#444444';
const DAY_MS = 24 * 60 * 60 * 1000;

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

/** GitHub counts commits, issues and pull requests as contributions. */
const dailyContributionCount = (
    day: cnbApi.ActivityCalendarDate | undefined,
): number => {
    if (!day) {
        return 0;
    }
    return (day.commit_count ?? 0) + (day.issues_count ?? 0) + (day.pr_count ?? 0);
};

const quartileThresholds = (counts: number[]): [number, number, number] => {
    const positive = counts.filter((count) => count > 0).sort((a, b) => a - b);
    if (positive.length === 0) {
        return [0, 0, 0];
    }
    const at = (quantile: number): number =>
        positive[Math.min(positive.length - 1, Math.floor(positive.length * quantile))];
    return [at(0.25), at(0.5), at(0.75)];
};

const levelOf = (
    count: number,
    thresholds: [number, number, number],
): number => {
    if (count <= 0) {
        return 0;
    }
    const [first, second, third] = thresholds;
    if (count <= first) {
        return 1;
    }
    if (count <= second) {
        return 2;
    }
    if (count <= third) {
        return 3;
    }
    return 4;
};

const isHalloween = (now: Date): boolean =>
    now.getUTCMonth() === 9 && now.getUTCDate() >= 25;

/**
 * Build a dense, Sunday-agnostic list of days.
 *
 * The renderer aligns columns by `date.getUTCDay()`, so every day in
 * the range must be present (missing days become zero-count days).
 */
const buildCalendar = (
    calendar: cnbApi.ActivityCalendar,
    year: number | null,
    now: Date,
): type.CalendarInfo[] => {
    const keys = Object.keys(calendar).sort();
    let start: Date;
    let end: Date;
    if (year !== null) {
        start = new Date(Date.UTC(year, 0, 1));
        // Like GitHub, the requested year ends today for the current year
        // and on December 31 for past years.
        const lastDayOfYear = Date.UTC(year, 11, 31);
        end = new Date(Math.min(lastDayOfYear, now.getTime()));
    } else if (keys.length > 0) {
        start = new Date(`${keys[0]}T00:00:00Z`);
        end = new Date(`${keys[keys.length - 1]}T00:00:00Z`);
    } else {
        return [];
    }
    if (end.getTime() < start.getTime()) {
        return [];
    }

    const days: Array<{ date: Date; count: number }> = [];
    for (
        let timestamp = start.getTime();
        timestamp <= end.getTime();
        timestamp += DAY_MS
    ) {
        const date = new Date(timestamp);
        days.push({
            date,
            count: dailyContributionCount(calendar[toIsoDate(date)]),
        });
    }

    const thresholds = quartileThresholds(days.map((day) => day.count));
    return days.map((day) => ({
        contributionCount: day.count,
        contributionLevel: levelOf(day.count, thresholds),
        date: day.date,
    }));
};

const sumBy = <T>(items: T[], pick: (item: T) => number | undefined): number =>
    items.reduce((total, item) => total + (pick(item) ?? 0), 0);

const buildLanguages = (repos: cnbApi.CnbRepo[]): type.LangInfo[] => {
    const stats: { [language: string]: type.LangInfo } = {};
    repos.forEach((repo) => {
        const language = repo.languages?.language;
        if (!language) {
            return;
        }
        const color = repo.languages?.color || OTHER_COLOR;
        const info = stats[language];
        if (info) {
            info.contributions += 1;
        } else {
            stats[language] = { language, color, contributions: 1 };
        }
    });
    return Object.values(stats).sort((a, b) => b.contributions - a.contributions);
};

const repositoriesCreatedWithin = (
    repos: cnbApi.CnbRepo[],
    calendar: type.CalendarInfo[],
): number => {
    if (calendar.length === 0) {
        return 0;
    }
    const start = calendar[0].date.getTime();
    const end = calendar[calendar.length - 1].date.getTime() + DAY_MS;
    return repos.filter((repo) => {
        if (!repo.created_at) {
            return false;
        }
        const createdAt = new Date(repo.created_at).getTime();
        return Number.isFinite(createdAt) && createdAt >= start && createdAt < end;
    }).length;
};

export const aggregateCnbUserInfo = (
    calendar: cnbApi.ActivityCalendar,
    repos: cnbApi.CnbRepo[],
    year: number | null,
    now: Date = new Date(),
): type.UserInfo => {
    const contributionCalendar = buildCalendar(calendar, year, now);
    const days = Object.values(calendar);

    return {
        isHalloween: isHalloween(now),
        contributionCalendar,
        contributesLanguage: buildLanguages(repos),
        totalContributions: contributionCalendar.reduce(
            (total, day) => total + day.contributionCount,
            0,
        ),
        totalCommitContributions: sumBy(days, (day) => day.commit_count),
        totalIssueContributions: sumBy(days, (day) => day.issues_count),
        totalPullRequestContributions: sumBy(days, (day) => day.pr_count),
        totalPullRequestReviewContributions: sumBy(
            days,
            (day) => day.valid_cr_count,
        ),
        totalRepositoryContributions: repositoriesCreatedWithin(
            repos,
            contributionCalendar,
        ),
        totalForkCount: sumBy(repos, (repo) => repo.fork_count),
        totalStargazerCount: sumBy(repos, (repo) => repo.star_count),
    };
};
