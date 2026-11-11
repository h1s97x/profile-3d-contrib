import * as create from '../src/create-svg';
import * as aggregate from '../src/aggregate-user-info';
import * as template from '../src/color-template';
import * as type from '../src/type';
import { dummyData } from './dummy-data';

/**
 * Render output snapshot baseline.
 *
 * These snapshots pin the exact SVG bytes produced for each built-in
 * theme (animated and static). Any change to the render pipeline must
 * leave all 16 snapshots untouched; a diff here means the refactor
 * changed user-visible output.
 *
 * Run with TZ=UTC (see package.json "test" script) so that Date
 * parsing in aggregate-user-info is deterministic.
 */
const userInfo = aggregate.aggregateUserInfo(dummyData);

const CASES: ReadonlyArray<[string, type.Settings]> = [
    ['normal', template.NormalSettings],
    ['halloween', template.HalloweenSettings],
    ['season-north', template.NorthSeasonSettings],
    ['season-south', template.SouthSeasonSettings],
    ['night-view', template.NightViewSettings],
    ['night-green', template.NightGreenSettings],
    ['night-rainbow', template.NightRainbowSettings],
    ['gitblock', template.GitBlockSettings],
];

describe.each(CASES)('render snapshot: %s', (_name, settings) => {
    it('animated', () => {
        expect(create.createSvg(userInfo, settings, true)).toMatchSnapshot();
    });
    it('static', () => {
        expect(create.createSvg(userInfo, settings, false)).toMatchSnapshot();
    });
});
