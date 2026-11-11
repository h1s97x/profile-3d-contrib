import axios from 'axios';
import * as type from './type';

export const URL =
    process.env.GITHUB_ENDPOINT || 'https://api.github.com/graphql';
const maxReposOneQuery = 100;

export type CommitContributionsByRepository = Array<{
    contributions: {
        totalCount: number;
    };
    repository: {
        primaryLanguage: {
            name: string;
            /** "#RRGGBB" */
            color: string | null;
        } | null;
    };
}>;

export type ContributionCalendar = {
    isHalloween: boolean;
    totalContributions: number;
    weeks: Array<{
        contributionDays: Array<{
            contributionCount: number;
            contributionLevel: type.ContributionLevel;
            /** "YYYY-MM-DD hh:mm:ss.SSS+00:00" */
            date: string;
        }>;
    }>;
};

export type Repositories = {
    edges: Array<{
        cursor: string;
    }>;
    nodes: Array<{
        forkCount: number;
        stargazerCount: number;
    }>;
};

/** Response(first) of GraphQL */
export type ResponseType = {
    data?: {
        user: {
            contributionsCollection: {
                commitContributionsByRepository: CommitContributionsByRepository;
                contributionCalendar: ContributionCalendar;
                totalCommitContributions: number;
                totalIssueContributions: number;
                totalPullRequestContributions: number;
                totalPullRequestReviewContributions: number;
                totalRepositoryContributions: number;
            };
            repositories: Repositories;
        };
    };
    errors?: Array<{
        message: string;
        type?: string;
        // snip
    }>;
};

/** Response(next) of GraphQL */
export type ResponseNextType = {
    data?: {
        user: {
            repositories: Repositories;
        };
    };
    errors?: Array<{
        message: string;
        type?: string;
        // snip
    }>;
};

export const fetchFirst = async (
    token: string,
    userName: string,
    year: number | null = null,
    maxRepos: number = maxReposOneQuery,
): Promise<ResponseType> => {
    const yearArgs = year
        ? `(from:"${year}-01-01T00:00:00.000Z", to:"${year}-12-31T23:59:59.000Z")`
        : '';
    const maxRepoCommitContribs = Math.min(
        Math.max(1, maxRepos),
        maxReposOneQuery,
    );
    const headers = {
        Authorization: `bearer ${token}`,
    };
    const request = {
        query: `
            query($login: String!) {
                user(login: $login) {
                    contributionsCollection${yearArgs} {
                        contributionCalendar {
                            isHalloween
                            totalContributions
                            weeks {
                                contributionDays {
                                    contributionCount
                                    contributionLevel
                                    date
                                }
                            }
                        }
                        commitContributionsByRepository(maxRepositories: ${maxRepoCommitContribs}) {
                            repository {
                                primaryLanguage {
                                    name
                                    color
                                }
                            }
                            contributions {
                                totalCount
                            }
                        }
                        totalCommitContributions
                        totalIssueContributions
                        totalPullRequestContributions
                        totalPullRequestReviewContributions
                        totalRepositoryContributions
                    }
                    repositories(first: ${maxReposOneQuery}, ownerAffiliations: OWNER) {
                        edges {
                            cursor
                        }
                        nodes {
                            forkCount
                            stargazerCount
                        }
                    }
                }
            }
        `.replace(/\s+/g, ' '),
        variables: { login: userName },
    };

    const response = await axios.post<ResponseType>(URL, request, {
        headers: headers,
    });
    return response.data;
};

export const fetchNext = async (
    token: string,
    userName: string,
    cursor: string,
): Promise<ResponseNextType> => {
    const headers = {
        Authorization: `bearer ${token}`,
    };
    const request = {
        query: `
            query($login: String!, $cursor: String!) {
                user(login: $login) {
                    repositories(after: $cursor, first: ${maxReposOneQuery}, ownerAffiliations: OWNER) {
                        edges {
                            cursor
                        }
                        nodes {
                            forkCount
                            stargazerCount
                        }
                    }
                }
            }
        `.replace(/\s+/g, ' '),
        variables: {
            login: userName,
            cursor: cursor,
        },
    };
    const response = await axios.post<ResponseNextType>(URL, request, {
        headers: headers,
    });
    return response.data;
};

/** Fetch data from GitHub GraphQL */
export const fetchData = async (
    token: string,
    userName: string,
    maxRepos: number,
    year: number | null = null,
): Promise<ResponseType> => {
    const res1 = await fetchFirst(token, userName, year, maxRepos);
    const result = res1.data;

    if (result && result.user.repositories.nodes.length === maxReposOneQuery) {
        const repos1 = result.user.repositories;
        let cursor = repos1.edges[repos1.edges.length - 1].cursor;
        while (repos1.nodes.length < maxRepos) {
            const res2 = await fetchNext(token, userName, cursor);
            if (res2.data) {
                const repos2 = res2.data.user.repositories;
                repos1.nodes.push(...repos2.nodes);
                repos1.edges.push(...repos2.edges);
                if (repos2.nodes.length !== maxReposOneQuery) {
                    break;
                }
                cursor = repos2.edges[repos2.edges.length - 1].cursor;
            } else {
                break;
            }
        }
    }

    // The pagination loop above appends whole pages, so the collected
    // repositories may overshoot `maxRepos` by up to one page. Truncate
    // to the configured cap so fork/star totals are not inflated.
    if (result && result.user.repositories.nodes.length > maxRepos) {
        console.info(
            `repositories used for statistics are truncated to the ${maxRepos} most recently pushed ones (MAX_REPOS=${maxRepos})`,
        );
        result.user.repositories.nodes.length = maxRepos;
        result.user.repositories.edges.length = maxRepos;
    }
    return res1;
};
