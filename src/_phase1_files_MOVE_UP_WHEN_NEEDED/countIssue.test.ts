import axios from 'axios';
import { countIssue } from './metrics'; // Adjust the path as necessary
// import * as dotenv from 'dotenv';
jest.mock('axios');

// dotenv.config();
// const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? ''

describe('countIssue', () => {
    const owner = 'ownerName';
    const repo = 'repoName';
    const state = 'closed';

    it('should return the count of closed issues from the last page', async () => {
        // Mocking the axios response
        (axios.get as jest.Mock).mockResolvedValueOnce({
            headers: {
                link: `<https://api.github.com/repos/ownerName/repoName/issues?state=closed&page=3>; rel="last", <https://api.github.com/repos/ownerName/repoName/issues?state=closed&page=1>; rel="first"`,
            },
            data: [], // Data is not relevant when using pagination
        });

        const count = await countIssue(owner, repo, state);
        expect(count).toBe(3); // Expect the count to match the last page number
    });

    it('should return the count of issues when no pagination is needed', async () => {
        (axios.get as jest.Mock).mockResolvedValueOnce({
            headers: {
                link: null, // No pagination link
            },
            data: new Array(5).fill({}), // Simulating 5 issues
        });

        const count = await countIssue(owner, repo, state);
        expect(count).toBe(5); // Should return the length of the data array
    });

    it('should return 0 when an error occurs', async () => {
        (axios.get as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

        const count = await countIssue(owner, repo, state);
        expect(count).toBe(0); // Should return 0 on error
    });
});
