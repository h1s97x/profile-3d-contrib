import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import * as cnb from '../src/cnb-api';
import { AppError, ErrorCode } from '../src/errors';

const mock = new MockAdapter(axios);
const BASE = 'https://api.cnb.cool';

afterEach(() => {
    mock.reset();
});

const repo = (index: number): cnb.CnbRepo => ({
    name: `repo-${index}`,
    path: `alice/repo-${index}`,
    star_count: 1,
    fork_count: 0,
    languages: { language: 'TypeScript', color: '#3178c6' },
});

describe('cnb-api fetchCalendar', () => {
    it('sends the bearer token and the year parameter', async () => {
        mock.onGet(`${BASE}/users/alice/calendar`).reply(200, {
            '2024-01-02': { commit_count: 3, pr_count: 1 },
        });

        const calendar = await cnb.fetchCalendar('dummy-token', 'alice', 2024);

        expect(calendar['2024-01-02']).toEqual({
            commit_count: 3,
            pr_count: 1,
        });
        const request = mock.history.get[0];
        expect(request.params).toEqual({ year: '2024' });
        expect(request.headers?.Authorization).toBe('Bearer dummy-token');
    });

    it('omits the year parameter when year is null', async () => {
        mock.onGet(`${BASE}/users/alice/calendar`).reply(200, {});

        await cnb.fetchCalendar('dummy-token', 'alice', null);

        expect(mock.history.get[0].params).toEqual({});
    });

    it('maps HTTP 403 to E_API_BAD_RESPONSE with a permission hint', async () => {
        mock.onGet(`${BASE}/users/alice/calendar`).reply(403, {});

        const error = await cnb
            .fetchCalendar('dummy-token', 'alice', 2024)
            .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.API_BAD_RESPONSE);
        expect((error as AppError).hints.join(' ')).toContain(
            'account-engage:r',
        );
    });

    it('surfaces the server errmsg from a CNB error body', async () => {
        mock.onGet(`${BASE}/users/alice/calendar`).reply(403, {
            errcode: 10023,
            errmsg: 'Missing required scopes: account-engage:r',
        });

        const error = await cnb
            .fetchCalendar('dummy-token', 'alice', 2024)
            .catch((e: unknown) => e);

        expect((error as AppError).message).toContain(
            'Missing required scopes: account-engage:r',
        );
    });

    it('maps HTTP 404 to a hint about the user name', async () => {
        mock.onGet(`${BASE}/users/ghost/calendar`).reply(404, {});

        const error = await cnb
            .fetchCalendar('dummy-token', 'ghost', 2024)
            .catch((e: unknown) => e);

        expect((error as AppError).hints.join(' ')).toContain('USERNAME');
    });
});

describe('cnb-api fetchRepos', () => {
    it('returns a single short page unchanged', async () => {
        mock.onGet(`${BASE}/users/alice/repos`).reply(200, [
            repo(0),
            repo(1),
            repo(2),
        ]);

        const repos = await cnb.fetchRepos('dummy-token', 'alice', 100);

        expect(repos).toHaveLength(3);
        expect(mock.history.get).toHaveLength(1);
    });

    it('paginates and truncates at MAX_REPOS', async () => {
        const page1 = Array.from({ length: 100 }, (_, i) => repo(i));
        const page2 = Array.from({ length: 100 }, (_, i) => repo(100 + i));
        mock.onGet(`${BASE}/users/alice/repos`).reply((config) => {
            const params = config.params as { page?: number } | undefined;
            const page = Number(params?.page);
            return [200, page === 1 ? page1 : page2];
        });

        const repos = await cnb.fetchRepos('dummy-token', 'alice', 150);

        expect(repos).toHaveLength(150);
        expect(mock.history.get).toHaveLength(2);
        expect(repos[149].name).toBe('repo-149');
    });

    it('stops paginating after a partial page', async () => {
        mock.onGet(`${BASE}/users/alice/repos`).reply(200, [repo(0)]);

        const repos = await cnb.fetchRepos('dummy-token', 'alice', 1000);

        expect(repos).toHaveLength(1);
        expect(mock.history.get).toHaveLength(1);
    });

    it('fetches every visible repository when no cap is given', async () => {
        const page1 = Array.from({ length: 100 }, (_, i) => repo(i));
        const page2 = Array.from({ length: 100 }, (_, i) => repo(100 + i));
        const page3 = Array.from({ length: 5 }, (_, i) => repo(200 + i));
        mock.onGet(`${BASE}/users/alice/repos`).reply((config) => {
            const page = Number((config.params as { page?: number })?.page);
            return [
                200,
                page === 1 ? page1 : page === 2 ? page2 : page3,
                { 'x-cnb-total': '205' },
            ];
        });

        const repos = await cnb.fetchRepos('dummy-token', 'alice');

        expect(repos).toHaveLength(205);
        expect(mock.history.get).toHaveLength(3);
        expect(mock.history.get[0].params).toMatchObject({ role: 'Guest' });
    });

    it('stops on the reported total even when pages are full', async () => {
        const page = Array.from({ length: 100 }, (_, i) => repo(i));
        mock.onGet(`${BASE}/users/alice/repos`).reply(200, page, {
            'x-cnb-total': '100',
        });

        const repos = await cnb.fetchRepos('dummy-token', 'alice');

        expect(repos).toHaveLength(100);
        expect(mock.history.get).toHaveLength(1);
    });
});
