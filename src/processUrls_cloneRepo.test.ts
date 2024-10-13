import { cloneRepo } from './processUrls';
import simpleGit from 'simple-git';

// Mock simpleGit function
jest.mock('simple-git');

describe('cloneRepo function', () => {
    let mockGitClone: jest.Mock;

    beforeEach(() => {
        // Clear any previous mock calls and reset simple-git
        mockGitClone = jest.fn();
        (simpleGit as jest.Mock).mockReturnValue({
            clone: mockGitClone,
        });
    });

    it('should clone the repository to the target directory with --depth 1', async () => {
        const mockUrl = 'https://github.com/example/repo.git';
        const mockTargetDir = '/some/target/dir';

        mockGitClone.mockResolvedValueOnce(null); // Mocking successful clone

        await cloneRepo(mockUrl, mockTargetDir);

        // Check if git.clone was called with the correct arguments, including --depth 1
        expect(mockGitClone).toHaveBeenCalledWith(mockUrl, mockTargetDir, ['--depth', '1']);
    });

    it('should throw an error if cloning fails', async () => {
        const mockUrl = 'https://github.com/example/repo.git';
        const mockTargetDir = '/some/target/dir';

        const errorMessage = 'Failed to clone repository';
        mockGitClone.mockRejectedValueOnce(new Error(errorMessage));

        await expect(cloneRepo(mockUrl, mockTargetDir)).rejects.toThrow(errorMessage);
    });
});
