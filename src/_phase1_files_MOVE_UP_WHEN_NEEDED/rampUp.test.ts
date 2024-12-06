import { RampUp } from './metrics';
import * as fs from 'fs';
import * as path from 'path';
import * as winston from 'winston';

jest.mock('fs');
jest.mock('child_process');
jest.mock('winston', () => ({
    log: jest.fn(),
    configure: jest.fn(),
    remove: jest.fn(),
    transports: {
        File: jest.fn().mockImplementation(() => ({
            log: jest.fn(),
        })),
        Console: jest.fn(),
    },
}));

describe('RampUpTime Metric', () => {
    const mockReadFileSync = fs.readFileSync as jest.Mock;
    const mockReaddirSync = fs.readdirSync as jest.Mock;
    const mockLstatSync = fs.lstatSync as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('Test 1: README exists with sufficient length', async () => {
        // Mock the directory structure
        mockReaddirSync.mockReturnValue(['README.md']); // Simulate finding README
        mockLstatSync.mockReturnValue({ isDirectory: () => false, isSymbolicLink: () => false });

        // Mock a long README file
        mockReadFileSync.mockImplementation((filePath: string) => {
            if (filePath.endsWith('README.md')) {
                return 'A'.repeat(1500); // Simulate a README with 1500 characters
            }
            return '';
        });

        const packagePath = path.join(__dirname, 'mockRepo');
        const packageUrl = 'https://github.com/mock/repo';

        const score = await RampUp(packagePath, packageUrl);
        expect(score).toBeGreaterThanOrEqual(0.5);
    });

    test('Test 2: README exists but is too short', async () => {
        // Mock the directory structure
        mockReaddirSync.mockReturnValue(['README.md']); // Simulate finding README
        mockLstatSync.mockReturnValue({ isDirectory: () => false, isSymbolicLink: () => false });

        // Mock a short README file
        mockReadFileSync.mockImplementation((filePath: string) => {
            if (filePath.endsWith('README.md')) {
                return 'Short README'; // Simulate a short README
            }
            return '';
        });

        const packagePath = path.join(__dirname, 'mockRepo');
        const packageUrl = 'https://github.com/mock/repo';

        const score = await RampUp(packagePath, packageUrl);
        expect(score).toBeLessThanOrEqual(0.25);
    });

    test('Test 3: No README file', async () => {
        // Mock the directory structure with no README
        mockReaddirSync.mockReturnValue([]); // Simulate no README
        mockLstatSync.mockReturnValue({ isDirectory: () => false, isSymbolicLink: () => false });

        mockReadFileSync.mockImplementation(() => {
            throw new Error('File not found'); // Simulate file not found
        });

        const packagePath = path.join(__dirname, 'mockRepo');
        const packageUrl = 'https://github.com/mock/repo';

        const score = await RampUp(packagePath, packageUrl);
        expect(score).toBe(0.125); // Expect 0 score when README is missing
    });

    test('Test 4: Code comments analysis', async () => {
        // Mock the directory structure
        mockReaddirSync.mockReturnValue(['README.md', 'file1.ts']); // Simulate finding README and code file
        mockLstatSync.mockReturnValue({ isDirectory: () => false, isSymbolicLink: () => false });

        // Mock a README file and code files with comments
        mockReadFileSync.mockImplementation((filePath: string) => {
            if (filePath.endsWith('README.md')) {
                return 'A'.repeat(1500); // Simulate a README with 1500 characters
            }
            if (filePath.endsWith('.ts')) {
                return `
                    // This is a comment
                    function test() {
                        console.log('Hello');
                    }
                `;
            }
            return '';
        });

        const packagePath = path.join(__dirname, 'mockRepo');
        const packageUrl = 'https://github.com/mock/repo';

        const score = await RampUp(packagePath, packageUrl);
        expect(score).toBeGreaterThan(0.5);
    });

    test('Test 5: No README, but code is well-commented', async () => {
        // Mock the directory structure
        mockReaddirSync.mockReturnValue(['file1.ts']); // Simulate no README but a code file
        mockLstatSync.mockReturnValue({ isDirectory: () => false, isSymbolicLink: () => false });

        // Simulate missing README but well-commented code
        mockReadFileSync.mockImplementation((filePath: string) => {
            if (filePath.endsWith('README.md')) {
                throw new Error('File not found');
            }
            if (filePath.endsWith('.ts')) {
                return `
                    // This is a well-commented function
                    function test() {
                        // Logic for testing
                    }
                `;
            }
            return '';
        });

        const packagePath = path.join(__dirname, 'mockRepo');
        const packageUrl = 'https://github.com/mock/repo';

        const score = await RampUp(packagePath, packageUrl);
        expect(score).toBeGreaterThanOrEqual(0.5); // Expect a decent score for well-commented code despite no README
    });
});