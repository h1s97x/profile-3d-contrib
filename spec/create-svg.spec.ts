import * as create from '../src/create-svg';
import * as aggregate from '../src/aggregate-user-info';
import * as template from '../src/color-template';
import * as type from '../src/type';
import { AppError, ErrorCode } from '../src/errors';
import { dummyData } from './dummy-data';

describe('create-svg', () => {
    it('fails fast with E_YEAR_EMPTY on an empty contribution calendar', () => {
        const userInfo = aggregate.aggregateUserInfo(dummyData);
        const emptyUserInfo = { ...userInfo, contributionCalendar: [] };
        try {
            create.createSvg(emptyUserInfo, template.NormalSettings, false);
            fail('expected createSvg to throw');
        } catch (error) {
            expect(error).toBeInstanceOf(AppError);
            expect((error as AppError).code).toEqual(ErrorCode.YEAR_EMPTY);
            expect((error as AppError).exitCode).toEqual(1);
        }
    });
});

describe('create-svg resilience to unusable settings', () => {
    /**
     * Settings JSON is user input: the validator warns on most issues, so
     * the renderer must not throw for anything that is merely cosmetic.
     */
    const userInfo = aggregate.aggregateUserInfo(dummyData);
    const bitmap: type.BitmapPatternSettings = template.GitBlockSettings;

    it('renders a bitmap pattern with a missing top panel', () => {
        const settings = {
            ...bitmap,
            contribPatterns: bitmap.contribPatterns.map((pattern, index) => ({
                ...pattern,
                top: index === 0 ? undefined : pattern.top,
            })),
        } as unknown as type.Settings;
        expect(() => create.createSvg(userInfo, settings, false)).not.toThrow();
    });

    it('renders a bitmap pattern with a non-string panel color', () => {
        const settings = {
            ...bitmap,
            contribPatterns: bitmap.contribPatterns.map((pattern) => ({
                ...pattern,
                top: { ...pattern.top, backgroundColor: 0x161b22 },
            })),
        } as unknown as type.Settings;
        const svg = create.createSvg(userInfo, settings, false);
        expect(svg).toContain('.cont-top-bg-0 { fill: ; }');
    });

    it('renders a bitmap pattern with a missing panel width', () => {
        const settings = {
            ...bitmap,
            contribPatterns: bitmap.contribPatterns.map((pattern) => ({
                ...pattern,
                top: { ...pattern.top, width: undefined },
            })),
        } as unknown as type.Settings;
        expect(() => create.createSvg(userInfo, settings, false)).not.toThrow();
    });
});
