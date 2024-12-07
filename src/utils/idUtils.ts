import crypto from 'crypto';

export function generatePackageID(name: string, version: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(`${name}-${version}`);
    return hash.digest('hex').substring(0, 10);
}
