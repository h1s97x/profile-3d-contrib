import * as template from './color-template';
import * as create from './create-svg';
import * as f from './file-writer';
import * as r from './settings-reader';
import * as dataSource from './data-source';
import { AppError, ErrorCode, formatError } from './errors';

export const main = async (): Promise<void> => {
    try {
        const platform = dataSource.detectPlatform();
        const token = dataSource.resolveToken(platform);
        const userName =
            3 <= process.argv.length ? process.argv[2] : process.env.USERNAME;
        if (!userName) {
            throw new AppError(
                ErrorCode.USERNAME_MISSING,
                'USERNAME is empty',
                ['pass the user name as an argument or set USERNAME'],
            );
        }
        const maxRepos = process.env.MAX_REPOS
            ? Number(process.env.MAX_REPOS)
            : 100;
        if (!Number.isInteger(maxRepos) || maxRepos < 1) {
            throw new AppError(
                ErrorCode.MAX_REPOS_INVALID,
                `MAX_REPOS must be a positive integer: "${process.env.MAX_REPOS ?? ''}"`,
                [
                    'set MAX_REPOS to 1 or more, or leave it unset for the default of 100',
                ],
            );
        }
        const year = process.env.YEAR ? Number(process.env.YEAR) : null;
        if (
            year !== null &&
            (!Number.isInteger(year) ||
                year < 2008 ||
                year > new Date().getFullYear())
        ) {
            throw new AppError(
                ErrorCode.YEAR_INVALID,
                `YEAR must be an integer between 2008 and the current year: "${process.env.YEAR ?? ''}"`,
                ['leave YEAR unset to use the current year'],
            );
        }

        const userInfo = await dataSource.fetchUserInfo(platform, {
            token,
            userName,
            maxRepos,
            year,
        });

        if (process.env.SETTING_JSON) {
            const settingFile = r.readSettingJson(process.env.SETTING_JSON);
            const settingInfos =
                'length' in settingFile ? settingFile : [settingFile];
            for (const settingInfo of settingInfos) {
                // The reader already warned about an unusable name, and
                // rejected the ones that could escape the output folder, so
                // a fallback here never widens the security boundary.
                const fileName =
                    typeof settingInfo.fileName === 'string' &&
                    f.isSafeFileName(settingInfo.fileName)
                        ? settingInfo.fileName
                        : f.DEFAULT_FILE_NAME;
                f.writeFile(
                    fileName,
                    create.createSvg(userInfo, settingInfo, false),
                );
            }
        } else if (process.env.ALL_THEMES === 'true') {
            const settings = userInfo.isHalloween
                ? template.HalloweenSettings
                : template.NormalSettings;

            f.writeFile(
                'profile-green-animate.svg',
                create.createSvg(userInfo, settings, true),
            );
            f.writeFile(
                'profile-green.svg',
                create.createSvg(userInfo, settings, false),
            );

            // Northern hemisphere
            f.writeFile(
                'profile-season-animate.svg',
                create.createSvg(userInfo, template.NorthSeasonSettings, true),
            );
            f.writeFile(
                'profile-season.svg',
                create.createSvg(userInfo, template.NorthSeasonSettings, false),
            );

            // Southern hemisphere
            f.writeFile(
                'profile-south-season-animate.svg',
                create.createSvg(userInfo, template.SouthSeasonSettings, true),
            );
            f.writeFile(
                'profile-south-season.svg',
                create.createSvg(userInfo, template.SouthSeasonSettings, false),
            );

            f.writeFile(
                'profile-night-view.svg',
                create.createSvg(userInfo, template.NightViewSettings, true),
            );

            f.writeFile(
                'profile-night-green.svg',
                create.createSvg(userInfo, template.NightGreenSettings, true),
            );

            f.writeFile(
                'profile-night-rainbow.svg',
                create.createSvg(userInfo, template.NightRainbowSettings, true),
            );

            f.writeFile(
                'profile-gitblock.svg',
                create.createSvg(userInfo, template.GitBlockSettings, true),
            );
        } else {
            // Default: a single image. Other themes are one `settings.theme`
            // away; ALL_THEMES=true (or `theme: all`) restores the legacy set.
            const settings = userInfo.isHalloween
                ? template.HalloweenSettings
                : template.NormalSettings;
            f.writeFile(
                'profile-green.svg',
                create.createSvg(userInfo, settings, false),
            );
        }
    } catch (error) {
        console.error(formatError(error));
        process.exitCode = error instanceof AppError ? error.exitCode : 1;
    }
};

/* istanbul ignore next */
if (require.main === module) {
    void main();
}
