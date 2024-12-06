import axios from 'axios';
import { ResponsiveMaintainer } from './metrics'; // Adjust the import path as necessary
jest.mock('axios');

const GITHUB_TOKEN = 'your_github_token'; // Mock token or set an environment variable

describe('ResponsiveMaintainer', () => {
    const packageUrl = 'https://github.com/owner/repo';
    const packagePath = 'path/to/package'; // Not used but required for compatibility

    beforeAll(() => {
        process.env.GITHUB_TOKEN = GITHUB_TOKEN; // Set the environment variable for the token
    });

    it('should return a score of 0 when there are no issues', async () => {
        (axios.get as jest.Mock).mockResolvedValueOnce({
            data: [], // Simulate no issues
        });

        const score = await ResponsiveMaintainer(packageUrl, packagePath);
        expect(score).toBe(0); // Should return 0 when there are no issues
    });

    it('should calculate the score correctly when there are open issues', async () => {
        (axios.get as jest.Mock).mockResolvedValueOnce({
            headers: {
                link: '<https://api.github.com/repos/owner/repo/issues?page=2>; rel="next", <https://api.github.com/repos/owner/repo/issues?page=3>; rel="last"',
            },
            data: [
                { state: 'open' }, { state: 'open' }, // Simulating open issues
                { state: 'closed' }, { state: 'closed' }
            ],
        });

        const totalIssuesResponse = {
            headers: {
                link: '<https://api.github.com/repos/owner/repo/issues?page=2>; rel="next", <https://api.github.com/repos/owner/repo/issues?page=3>; rel="last"',
            },
            data: [
                { state: 'open' }, { state: 'closed' }, // Simulating total issues
                { state: 'closed' },
            ],
        };

        (axios.get as jest.Mock).mockResolvedValueOnce(totalIssuesResponse); // Total issues
        (axios.get as jest.Mock).mockResolvedValueOnce({
            data: [{ state: 'open' }, { state: 'open' }], // Simulating open issues
        }); // Open issues

        const score = await ResponsiveMaintainer(packageUrl, packagePath);
        expect(score).toBeLessThanOrEqual(1);
        expect(score).toBeGreaterThanOrEqual(0);
    });

    it('should return a score of 0 if no issues are found', async () => {
        (axios.get as jest.Mock).mockResolvedValueOnce({
            data: [], // Simulate no issues
        });

        const score = await ResponsiveMaintainer(packageUrl, packagePath);
        expect(score).toBe(0); // Should return 0 when there are no issues
    });

    it('should handle errors from axios gracefully', async () => {
        (axios.get as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

        const score = await ResponsiveMaintainer(packageUrl, packagePath);
        expect(score).toBe(0); // Should return 0 on error
    });
});
