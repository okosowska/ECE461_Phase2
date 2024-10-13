import  { License, license_thru_files } from './metrics';

describe('metrics.ts', () => {
    describe('license', () => {
        test('should return score 1 for a repo with a valid license using GitHub license REST API', async () => {
            const score = await License('https://github.com/hasansultan92/watch.js', '');
            expect(score).toBe(1);
        })
        test('should return score 1 for a repo with a valid license using package.json', async () => {
            const score = await License('https://github.com/prathameshnetake/libvlc', '');
            expect(score).toBe(1);
        })
        test('should return score 1 for a repo with a valid license using README', async () => {
            const score = await License('https://github.com/cloudinary/cloudinary_npm', '');
            expect(score).toBe(1);
        })
        test('should return score 1 for a repo with a valid license using LICENSE', async () => {
            const score = await License('https://github.com/lodash/lodash', '');
            expect(score).toBe(1);
        })
        test('should return score 0 for a repo without a valid license', async () => {
            const score = await License('https://github.com/ryanve/unlicensed', '');
            expect(score).toBe(0);
        })
    })
    describe('license_thru_files', () => {
        test('should return score 1 for a repo with a valid license using package.json', async () => {
            const score = await license_thru_files('prathameshnetake','libvlc', 'package.json');
            expect(score).toBe(1);
        })
        test('should return score 1 for a repo with a valid license using README', async () => {
            const score = await license_thru_files('cloudinary','cloudinary_npm', 'README.md');
            expect(score).toBe(1);
        })
        test('should return score 1 for a repo with a valid license using LICENSE', async () => {
            const score = await license_thru_files('lodash','lodash', 'LICENSE');
            expect(score).toBe(1);
        })
    })
})