import semver from 'semver';

export const filterVersionsByRange = (versions: string[], range: string): string[] => {
    return versions.filter((version) => semver.satisfies(version, range));
};
