import semver from 'semver';

export const isExactVersion = (version: string): boolean => {
    return semver.valid(version) !== null && !version.includes('-') && !version.startsWith('^') && !version.startsWith('~');
};

export const isBoundedRange = (version: string): boolean => {
    return version.includes('-') && version.split('-').length === 2;
};

export const parseBoundedRange = (version: string): { minVersion: string; maxVersion: string } | null => {
    const [minVersion, maxVersion] = version.split('-');
    if (semver.valid(minVersion) && semver.valid(maxVersion)) {
        return { minVersion, maxVersion };
    }
    return null;
};

export const satisfiesRange = (version: string, range: string): boolean => {
    return semver.satisfies(version, range);
};
