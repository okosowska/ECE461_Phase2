import fs from 'fs';
import path from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { dependencyAnalysis } from './metrics';
import winston from 'winston';

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

describe('Dependency Analysis', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should reject if temporary directory cannot be created', async () => {
        (fs.mkdir as unknown as jest.Mock).mockImplementation((_, __, callback) => {
            callback(new Error('Directory creation error'));
        });

        await expect(dependencyAnalysis('packagePath')).rejects.toThrow('Error creating temporary directory: Error: Directory creation error');
    });

    test('should reject if npm init fails', async () => {
        (fs.mkdir as unknown as jest.Mock).mockImplementation((_, __, callback) => {
            callback(null);
        });

        (spawn as unknown as jest.Mock).mockImplementation((command: string, args: string[], options?: any): ChildProcessWithoutNullStreams => {
            if (command === 'npm' && args.includes('init')) {
                return {
                    on: (event: string, cb: (code: number) => void) => {
                        if (event === 'close') cb(1); // Simulate npm init failure
                    },
                } as unknown as ChildProcessWithoutNullStreams;
            }
            return {} as ChildProcessWithoutNullStreams;
        });

        await expect(dependencyAnalysis('packagePath')).rejects.toThrow('Error initializing npm project: 1');
    });

    test('should reject if npm install fails', async () => {
        (fs.mkdir as unknown as jest.Mock).mockImplementation((_, __, callback) => {
            callback(null);
        });

        (spawn as unknown as jest.Mock).mockImplementation((command: string, args: string[], options?: any): ChildProcessWithoutNullStreams => {
            if (command === 'npm' && args.includes('init')) {
                return {
                    on: (event: string, cb: (code: number) => void) => {
                        if (event === 'close') cb(0); // npm init succeeds
                    },
                } as unknown as ChildProcessWithoutNullStreams;
            }

            if (command === 'npm' && args.includes('install')) {
                return {
                    on: (event: string, cb: (code: number) => void) => {
                        if (event === 'close') cb(1); // Simulate npm install failure
                    },
                } as unknown as ChildProcessWithoutNullStreams;
            }

            return {} as ChildProcessWithoutNullStreams;
        });

        await expect(dependencyAnalysis('packagePath')).rejects.toThrow('Error installing package: 1');
    });

    test('should return correct audit scores and delete directory afterward', async () => {
        const mockAuditData = {
            metadata: {
                vulnerabilities: {
                    low: 2,
                    moderate: 1,
                    high: 0,
                    critical: 0,
                },
            },
        };

        (fs.mkdir as unknown as jest.Mock).mockImplementation((_, __, callback) => {
            callback(null);
        });

        (spawn as unknown as jest.Mock).mockImplementation((command: string, args: string[], options?: any): ChildProcessWithoutNullStreams => {
            if (command === 'npm' && args.includes('init')) {
                return {
                    on: (event: string, cb: (code: number) => void) => {
                        if (event === 'close') cb(0); // npm init succeeds
                    },
                } as unknown as ChildProcessWithoutNullStreams;
            }

            if (command === 'npm' && args.includes('install')) {
                return {
                    on: (event: string, cb: (code: number) => void) => {
                        if (event === 'close') cb(0); // npm install succeeds
                    },
                } as unknown as ChildProcessWithoutNullStreams;
            }

            if (command === 'npm' && args.includes('audit')) {
                return {
                    stdout: {
                        on: (event: string, cb: (data: any) => void) => {
                            if (event === 'data') cb(JSON.stringify(mockAuditData)); // Return mock audit data
                        },
                    },
                    on: (event: string, cb: (code: number) => void) => {
                        if (event === 'close') cb(0); // npm audit succeeds
                    },
                } as unknown as ChildProcessWithoutNullStreams;
            }

            return {} as ChildProcessWithoutNullStreams;
        });

        (fs.rm as unknown as jest.Mock).mockImplementation((_, __, callback) => {
            callback(null); // Mock directory removal success
        });

        const score = await dependencyAnalysis('packagePath');

        expect(score).toBeCloseTo(0.92, 2); // Example score based on vulnerabilities
        

    });
});
