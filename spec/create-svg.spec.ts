import * as create from '../src/create-svg';
import * as aggregate from '../src/aggregate-user-info';
import * as template from '../src/color-template';
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
