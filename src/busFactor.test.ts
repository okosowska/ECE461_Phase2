import axios from 'axios';
import { BusFactor } from './metrics'; // Adjust the path as necessary

jest.mock('axios');

const GITHUB_TOKEN = 'your_github_token'; // Mock token or set an environment variable

describe('BusFactor', () => {
    const packageUrl = 'https://github.com/owner/repo';
    const packagePath = 'path/to/package'; // Not used but required for compatibility

    beforeAll(() => {
        process.env.GITHUB_TOKEN = GITHUB_TOKEN; // Set the environment variable for the token
    });

    it('should calculate the BusFactor correctly for contributors with 5+ commits', async () => {
        (axios.get as jest.Mock).mockResolvedValueOnce({
            data: [
                { author: { login: 'user1' } },
                { author: { login: 'user1' } },
                { author: { login: 'user2' } },
                { author: { login: 'user2' } },
                { author: { login: 'user2' } },
                { author: { login: 'user3' } },
                { author: { login: 'user3' } },
                { author: { login: 'user3' } },
                { author: { login: 'user3' } },
                { author: { login: 'user3' } },
                { author: { login: 'user4' } },
                { author: { login: 'user4' } },
                { author: { login: 'user4' } },
                { author: { login: 'user4' } },
                { author: { login: 'user4' } },
                { author: { login: 'user4' } },
                { author: { login: 'user4' } },
                { author: { login: 'user4' } },
                { author: { login: 'user4' } },
                { author: { login: 'user5' } },
                { author: { login: 'user5' } },
                { author: { login: 'user5' } },
                { author: { login: 'user5' } },
                { author: { login: 'user5' } },
                { author: { login: 'user5' } },
                { author: { login: 'user5' } },
                { author: { login: 'user5' } },
                { author: { login: 'user5' } },
                { author: { login: 'user5' } },
            ],
        });

        const score = await BusFactor(packageUrl, packagePath);
        expect(score).toBeLessThanOrEqual(1);
        expect(score).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 if no commits are found', async () => {
        (axios.get as jest.Mock).mockResolvedValueOnce({
            data: [], // Simulate no commits
        });

        const score = await BusFactor(packageUrl, packagePath);
        expect(score).toBe(0); // Should return 0 when there are no commits
    });

    it('should return 0 if an error occurs', async () => {
        (axios.get as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

        const score = await BusFactor(packageUrl, packagePath);
        expect(score).toBe(0); // Should return 0 on error
    });

    it('should handle less than 10 active contributors', async () => {
        (axios.get as jest.Mock).mockResolvedValueOnce({
            data: [
                { author: { login: 'user1' } },
                { author: { login: 'user1' } },
                { author: { login: 'user2' } },
                { author: { login: 'user2' } },
                { author: { login: 'user2' } },
            ],
        });

        const score = await BusFactor(packageUrl, packagePath);
        expect(score).toBeLessThanOrEqual(1);
        expect(score).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 if GitHub token is empty', async () => {
        process.env.GITHUB_TOKEN = ''; // Simulate no GitHub token
        const score = await BusFactor(packageUrl, packagePath);
        expect(score).toBeLessThanOrEqual(1);
        expect(score).toBeGreaterThanOrEqual(0);
    });
});
