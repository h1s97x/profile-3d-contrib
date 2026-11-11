import * as aggregateCnb from '../src/aggregate-cnb-info';
import * as create from '../src/create-svg';
import * as template from '../src/color-template';
import * as cnb from '../src/cnb-api';

/**
 * Render integration: a `type.UserInfo` built from CNB payloads must
 * flow through the untouched render pipeline.
 */

const NOW = new Date('2024-12-31T12:00:00Z');

const buildCalendar = (): cnb.ActivityCalendar => {
    const calendar: cnb.ActivityCalendar = {};
    for (let dayOfYear = 0; dayOfYear < 366; dayOfYear += 1) {
        const date = new Date(Date.UTC(2024, 0, 1 + dayOfYear));
        const pattern = (dayOfYear * 37) % 23; // deterministic pseudo data
        if (pattern === 0) {
            continue;
        }
        calendar[date.toISOString().slice(0, 10)] = {
            commit_count: pattern % 7,
            issues_count: pattern % 3,
            pr_count: pattern % 2,
            valid_cr_count: pattern % 2,
        };
    }
    return calendar;
};

const REPOS: cnb.CnbRepo[] = [
    {
        star_count: 12,
        fork_count: 3,
        languages: { language: 'TypeScript', color: '#3178c6' },
        created_at: '2024-03-01T00:00:00Z',
    },
    {
        star_count: 5,
        fork_count: 1,
        languages: { language: 'Rust', color: '#dea584' },
        created_at: '2023-11-01T00:00:00Z',
    },
    {
        star_count: 1,
        fork_count: 0,
        languages: { language: 'Go', color: '#00add8' },
        created_at: '2024-08-15T00:00:00Z',
    },
];

const userInfo = aggregateCnb.aggregateCnbUserInfo(
    buildCalendar(),
    REPOS,
    2024,
    NOW,
);

describe('cnb render integration', () => {
    it('renders the full 3D profile from CNB data', () => {
        const svg = create.createSvg(userInfo, template.NormalSettings, false);

        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).toContain('cont-top-');
        expect(svg).toContain(String(userInfo.totalContributions));
        expect(svg).toMatchSnapshot();
    });

    it('renders the animated variant', () => {
        const svg = create.createSvg(userInfo, template.NormalSettings, true);

        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).toMatchSnapshot();
    });

    it('renders every other built-in theme from CNB data', () => {
        const settingsList = [
            template.HalloweenSettings,
            template.NorthSeasonSettings,
            template.SouthSeasonSettings,
            template.NightViewSettings,
            template.NightGreenSettings,
            template.NightRainbowSettings,
            template.GitBlockSettings,
        ];
        for (const settings of settingsList) {
            const svg = create.createSvg(userInfo, settings, false);
            expect(svg.startsWith('<svg')).toBe(true);
            expect(svg).toContain('TypeScript');
        }
    });
});
