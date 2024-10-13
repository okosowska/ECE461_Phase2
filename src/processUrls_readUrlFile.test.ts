import * as fs from 'fs';
import * as path from 'path';
import { readURLFile } from './processUrls';
import * as readline from 'readline';
import * as winston from 'winston';

// Mock winston completely
jest.mock('winston', () => ({
    createLogger: jest.fn(() => ({
        log: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    })),
    transports: {
        File: jest.fn(),
        Console: jest.fn(),
    },
    format: {
        simple: jest.fn(),
        json: jest.fn(),
    },
    configure: jest.fn(),
    remove: jest.fn(),
}));

jest.mock('readline');
jest.mock('fs');

describe('readURLFile', () => {
    const testFilePath = path.join(__dirname, 'test_input.txt');
    const mockReadStream = {
        on: jest.fn(),
        close: jest.fn(),
    };

    const mockInterface = {
        [Symbol.asyncIterator]: jest.fn(),
        close: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should read the file and return an array of URLs', async () => {
        const fileContents = [
            'https://github.com/cloudinary/cloudinary_npm',
            'https://www.npmjs.com/package/express',
            'https://github.com/nullivex/nodist',
            'httpsasdfasdf://github.com/midas1214/hw1_github_tutorial.git', // Invalid URL format
            'https://github.com/lodash/lodash',
            'https://www.npmjs.com/package/browserify',
            'https://github.com/midas1214/hw1_github_tutorial.git',
            'https://github.com/ECE46100/group21-phase1/issues'
        ];

        // Mocking the readline async iterator
        mockInterface[Symbol.asyncIterator].mockReturnValue({
            async *[Symbol.asyncIterator]() {
                for (const line of fileContents) {
                    yield line;
                }
            }
        });

        // Mocking the creation of the file stream and readline interface
        (fs.createReadStream as jest.Mock).mockReturnValue(mockReadStream);
        // Mock readline.createInterface to simulate async iteration
        (readline.createInterface as jest.Mock).mockReturnValue({
            [Symbol.asyncIterator]: jest.fn().mockReturnValue({
                next: jest
                    .fn()
                    .mockResolvedValueOnce({ value: fileContents[0], done: false })
                    .mockResolvedValueOnce({ value: fileContents[1], done: false })
                    .mockResolvedValueOnce({ value: fileContents[2], done: false })
                    .mockResolvedValueOnce({ value: fileContents[3], done: false })
                    .mockResolvedValueOnce({ value: fileContents[4], done: false })
                    .mockResolvedValueOnce({ value: fileContents[5], done: false })
                    .mockResolvedValueOnce({ value: fileContents[6], done: false })
                    .mockResolvedValueOnce({ value: fileContents[7], done: false })
                    .mockResolvedValueOnce({ done: true }),
            }),
        });

        const result = await readURLFile(testFilePath);

        expect(result).toEqual(fileContents);
        expect(fs.createReadStream).toHaveBeenCalledWith(testFilePath);
        expect(readline.createInterface).toHaveBeenCalledWith({
            input: mockReadStream,
            crlfDelay: Infinity,
        });
    });

    it('should skip empty lines', async () => {
        const fileContents = [
            'https://github.com/cloudinary/cloudinary_npm',
            '',
            'https://www.npmjs.com/package/express',
            '   ', // Empty space line
            'https://github.com/nullivex/nodist'
        ];

        const expectedResult = [
            'https://github.com/cloudinary/cloudinary_npm',
            'https://www.npmjs.com/package/express',
            'https://github.com/nullivex/nodist'
        ];

        mockInterface[Symbol.asyncIterator].mockReturnValue({
            async *[Symbol.asyncIterator]() {
                for (const line of fileContents) {
                    yield line;
                }
            }
        });

        (readline.createInterface as jest.Mock).mockReturnValue({
            [Symbol.asyncIterator]: jest.fn().mockReturnValue({
                next: jest
                    .fn()
                    .mockResolvedValueOnce({ value: fileContents[0], done: false })
                    .mockResolvedValueOnce({ value: fileContents[1], done: false })
                    .mockResolvedValueOnce({ value: fileContents[2], done: false })
                    .mockResolvedValueOnce({ value: fileContents[3], done: false })
                    .mockResolvedValueOnce({ value: fileContents[4], done: false })
                    .mockResolvedValueOnce({ done: true }),
            }),
        });

        const result = await readURLFile(testFilePath);

        expect(result).toEqual(expectedResult);
    });

    it('should return an empty array if the file is empty', async () => {
        const fileContents: string[] = [];

        
        (readline.createInterface as jest.Mock).mockReturnValue({
            [Symbol.asyncIterator]: jest.fn().mockReturnValue({
                next: jest
                    .fn()
                    .mockResolvedValueOnce({ done: true }),
            }),
        });

        mockInterface[Symbol.asyncIterator].mockReturnValue({
            async *[Symbol.asyncIterator]() {
                for (const line of fileContents) {
                    yield line;
                }
            }
        });

        const result = await readURLFile(testFilePath);

        expect(result).toEqual([]);
    });

    it('should handle errors during file reading', async () => {
        // Simulate an error in creating a file stream
        (fs.createReadStream as jest.Mock).mockImplementation(() => {
            throw new Error('File not found');
        });

        await expect(readURLFile(testFilePath)).rejects.toThrow('File not found');
        expect(fs.createReadStream).toHaveBeenCalledWith(testFilePath);
    });
});
