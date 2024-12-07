import { ESLint } from 'eslint';
import winston from 'winston';
import path from 'path';
import { linting } from './metrics';

jest.mock('eslint');
jest.spyOn(winston, 'log').mockImplementation(jest.fn());

describe('Correctness Metric: Linting', () => {
    let mockESLintInstance: Partial<ESLint>;

    beforeEach(() => {
        mockESLintInstance = {
            lintFiles: jest.fn(),
        };
        (ESLint as jest.MockedClass<typeof ESLint>).mockImplementation(() => mockESLintInstance as ESLint);
        (winston.log as jest.Mock).mockClear();
    });

    test('should be successful', async () => {
        const lintResults = [
            { errorCount: 0, filePath: 'src/index.js' },
            { errorCount: 0, filePath: 'src/utils.js' },
        ];
        (mockESLintInstance.lintFiles as jest.Mock).mockResolvedValue(lintResults);

        const packagePath = path.join(__dirname, 'src');
        const score = await linting(packagePath);
        expect(score).toBe(1); // Adjust based on your scoring logic
    });

    test('should be a path does not exist error', async () => {
        const error = new Error('Path does not exist');
        (mockESLintInstance.lintFiles as jest.Mock).mockRejectedValue(error);
        const packagePath = path.join(__dirname, 'nonexistent');
        await expect(linting(packagePath)).rejects.toThrow('Error: Path does not exist');
    });
});
