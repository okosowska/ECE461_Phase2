import { processURLs } from './processUrls';
import { computeMetrics } from './metrics';
import fs from 'fs';

// make compute metrics do nothing
jest.mock('./metrics', () => ({
    computeMetrics: jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
            resolve({});
        });
    }),
}));

describe('processURLs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    test('should process URLs correctly and capture print statements', async () => {
        const filePath = 'src/one_url.txt';

        // Call the function
        await processURLs(filePath).then(() => {
            expect(fs.existsSync('cloned_repos/cloudinary cloudinary_npm')).toBe(true);
        });

        // Check that the function did not throw any error
        expect(processURLs(filePath)).resolves.not.toThrow();
        

        // Clean up cloned repositories after the test
        const cloned_repos = 'cloned_repos';
        await fs.promises.rm(cloned_repos, { recursive: true, force: true });
    });
});
