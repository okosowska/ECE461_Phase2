/*
    computeMetrics is the only externally accessible function from this file. It facilitates running
    multiple metrics in parallel. To add a metric calculation, create a function definition that follows the 
    typing (type metricFunction) and add the function name to the metrics array. Metric functions must be 
    asynchronous (return promises). metricSample shows how to make a synchronous function asynchronous.
*/

import * as threading from 'worker_threads';
import * as path from 'path';
import { cpus } from 'os';
import { spawn } from 'child_process';
import axios from 'axios';
import { getOwnerAndPackageName } from './util';
import * as dotenv from 'dotenv';
import { ESLint } from 'eslint';
import * as fs from 'fs';
import * as winston from 'winston';

dotenv.config();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? ''
const ESLINT_CONFIG = path.join(process.cwd(), 'src', 'eslint_package.config.mjs');

const log_levels = ['warn', 'info', 'debug'];
const LOG_LEVEL: number = parseInt(process.env.LOG_LEVEL ?? '0', 10);
const LOG_FILE = process.env.LOG_FILE;

winston.configure({
    level: log_levels[LOG_LEVEL],
    transports: [
        new winston.transports.File({ filename: LOG_FILE })
    ]
});
winston.remove(winston.transports.Console);

/**
 * @type metricFunction
 * @description Type for metric calculating functions, should only return the result of the calculation.
 */
type metricFunction = (packageUrl: string, packagePath: string) => Promise<number>;
const metrics: metricFunction[] = [
    BusFactor,
    ResponsiveMaintainer,
    RampUp,
    Correctness,
    License,
];

const weights: Record<string, number> = { BusFactor: 0.25, License: 0.25, ResponsiveMaintainer: 0.2, Correctness: 0.1, RampUp: 0.2 };

/**
 * @interface metricPair
 * @description Type for a metric result, one for the score and one for the latency.
 */
interface metricPair {
    [key: string]: number;
    [key: `${string}_Latency`]: number;
};

/**
 * @type packageResult
 * @description Type for the result of the metrics computation.
 */
type packageResult = {
    URL: string;
    NetScore: number;
    NetScore_Latency: number;
} | metricPair;

/**
 * @function computeMetrics
 * @description This function is used to compute the metrics of a package.
 * @returns {packageResult} - A map describing the package, including the scores and latencies of the metrics.
 */
async function computeMetrics(packageUrl: string, packagePath: string): Promise<packageResult> {
    return new Promise((resolve, reject) => {
        /* Get the number of cores available - picked two metrics per core */
        const cores = cpus().length;
        const maxWorkers = Math.min(cores, 2 * metrics.length);
        const metricThreads: threading.Worker[] = [];
        const results: metricPair[] = [];
        const netScoreStart = Date.now();
        let completed = 0;
        let started = 0;

        function startNewWorker(metricIndex: number) {
            if (metricIndex >= metrics.length) {
                return;
            }

            const newWorker = new threading.Worker(__filename, {
                workerData: {
                    metricIndex: metricIndex, url: packageUrl, path: packagePath
                },
            });

            const subChannel = new threading.MessageChannel();
            newWorker.postMessage({ hereIsYourPort: subChannel.port1 }, [subChannel.port1]);

            subChannel.port2.on('message', (message: { metricName: string, result: [number, number] }) => {
                results.push({
                    [message.metricName]: message.result[0],
                    [`${message.metricName}_Latency`]: message.result[1]
                });
                completed++;

                if (completed === metrics.length) {
                    const netScore = results.reduce((acc, curr) => {
                        const metricName: string = Object.keys(curr)[0];
                        const metricScore = Math.max(0, curr[metricName]);
                        const metricWeight = weights[metricName];
                        return acc + metricScore * metricWeight;
                    }, 0);
                    const finalResult: packageResult = {
                        URL: packageUrl,
                        NetScore: netScore,
                        NetScore_Latency: (Date.now() - netScoreStart) / 1000,
                        ...results.reduce((acc, curr) => ({ ...acc, ...curr }), {})
                    };
                    const terminationPromises = metricThreads.map(worker => worker.terminate());
                    
                    Promise.all(terminationPromises).then(() => {
                        resolve(finalResult);
                    }).catch((error: unknown) => { });
                } else {
                    startNewWorker(started++);
                }
            });

            newWorker.on('error', (err) => {
                reject(err);
            });

            metricThreads.push(newWorker);
            started++;
        }

        for (let i = 0; i < maxWorkers; i++) {
            startNewWorker(i);
        }
    });
}

/**
 * @function metricsRunner
 * @param metricFunction - The function to run to collect a given metric.
 * @returns {number[]} - A pair of numbers representing the score ([0, 1]) and the latency in seconds.
 */
async function metricsRunner(metricFn: metricFunction, packageUrl: string, packagePath: string): Promise<number[]> {
    /* start the timer */
    const startTime = Date.now();
    const score: number = await metricFn(packageUrl, packagePath);
    /* stop the timer */
    const latency = (Date.now() - startTime) / 1000;

    return [score, latency];
}

/**
 * @function countIssue
 * @description A function that returns #issues in 'state'(ex: closed) from given repo information using GH API
 * @param {string} owner - the owner of the repo, we use this to construct the endpoint for API call
 * @param {string} packageName - package's name, used to construct API as well
 * @param {string} status - the status of the kinf of issue we want to get, like 'closed'
 * @returns {number} count - the number of issue in the status specified
 */
async function countIssue(owner: string, repo: string, state: string): Promise<number> {
    try {
        const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=${state}`;
        const response = await axios.get(url, {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`
            },
            params: {
                per_page: 1 /* Avoid fetching full data by looking at only the "Link" header for pagination */
            }
        });
        
        const linkHeader = response.headers.link;
        if (linkHeader) {
            /* Parse the "last" page from the pagination links */
            const lastPageMatch = linkHeader.match(/&page=(\d+)>; rel="last"/);
            if (lastPageMatch) {
                return parseInt(lastPageMatch[1], 10);
            }
        }
        return response.data.length;
    } catch (error) {
        return 0;
    }
}

/**
 * @function ResponsiveMaintainer
 * @description A metric that uses GH API to get (1- #openIssue/#allIssue) as ResponsiveMaintainer score.
 * @param {string} packageUrl - The GitHub repository URL.
 * @param {string} packagePath - (Not used here, but required for type compatibility).
 * @returns {number} score - The score for ResponsiveMaintainer, calculated as (1- #openIssue/#allIssue), 
 *                           if no issue was found it returns 1.
 */
async function ResponsiveMaintainer(packageUrl: string, packagePath: string): Promise<number> {
    winston.log('info', "Calculating ResponsiveMaintainer metric");
    let score = 0;
    const[owner, packageName] = getOwnerAndPackageName(packageUrl);
    try {
        if (GITHUB_TOKEN == '') throw new Error('No GitHub token specified');
        const totalIssues = await countIssue(owner, packageName, 'all');
        const openIssues = await countIssue(owner, packageName, 'open');

        if (totalIssues === 0) {
            winston.log('info', "In ResponsiveMaintainer metric found no issue for this repo");
            return 0; /* No issue at all, not an active repo */
        }

        score = 1 - (openIssues / totalIssues);
    } catch (error) {
        throw new Error(`Error calculating maintaine activeness\nError message : ${error}`)
    }

    winston.log('info', `ResponsiveMaintainer metric score = ${score.toString()}`);
    return score;
}

/**
 * @function BusFactor
 * @description A metric that calculates the number of contributors with 5+ commits in the last year.
 * @param {string} packageUrl - The GitHub repository URL.
 * @param {string} packagePath - (Not used here, but required for type compatibility).
 * @returns {Promise<number>} - The score for BusFactor, calculated as max(1, (#contributors who made 5+ commits last year / 10))
 */
async function BusFactor(packageUrl: string, packagePath: string): Promise<number> {
    winston.log('info', "Calculating BusFactor metric");
    const[owner, packageName] = getOwnerAndPackageName(packageUrl);
    try {
        if (GITHUB_TOKEN == '') throw new Error('No GitHub token specified');
        /* Trace back at most a year from today */
        const since = new Date();
        since.setFullYear(since.getFullYear() - 1);
        const url = `https://api.github.com/repos/${owner}/${packageName}/commits`;
        const response = await axios.get(url, {
            params: {
                since: since.toISOString(),
                per_page: 100, /* This is just a rough guess */
            },
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`
            }
        });

        const commits = response.data;

        if (!commits || commits.length === 0) return 0; /* No contributors found in the last year */

        /* Map to keep track of each contributor's commit count */
        const contributorCommits: { [key: string]: number } = {};

        /* Count commits per author */
        commits.forEach((commit: any) => {
            const author = commit.author?.login;
            if (author) {
                contributorCommits[author] = (contributorCommits[author] || 0) + 1;
            }
        });

        /* Filter contributors with 5+ commits */
        const activeContributors = Object.values(contributorCommits).filter(commitCount => commitCount >= 1).length;
        const score = activeContributors >= 10 ? 1 : activeContributors / 10;
        winston.log('info', `BusFactor metric score ${score.toString()}`);

        return score;
    } catch (error) {
        return 0;
    }
}

/**
 * @function Correctness
 * @description A metric that calculates the "Correctness" of the package through a combination of dependency analysis and linting
 * @param {string} packageUrl - The GitHub repository URL.
 * @param {string} packagePath - The path to the cloned repository.
 * @returns {number} - The score for Correctness, calculated as a weighted sum of the dependency and linting scores.
 */
async function Correctness(packageUrl: string, packagePath: string): Promise<number> {
    winston.log('info', "Calculating Correctness metric");

    const [dependencyResult, lintingResult] = await Promise.allSettled([
        dependencyAnalysis(packagePath).finally(async () => {
            const packageName = path.basename(packagePath).split(' ')[1];
            const tempProjectPath = path.join(process.cwd(), `temp-${packageName}`);
            try {
                await fs.promises.rm(tempProjectPath, { recursive: true, force: true });
            } catch (err) {
                winston.log('error', `Error deleting temporary directory: ${err}`);
            }
        }),
        linting(packagePath),
    ]);

    const dependencyScore = dependencyResult.status === 'fulfilled' ? dependencyResult.value : 0;
    const lintingScore = lintingResult.status === 'fulfilled' ? lintingResult.value : 0;

    if (dependencyResult.status === 'fulfilled') {
        winston.log('info', `Dependency score calculated, ${dependencyScore}`);
    } else {
        winston.log('error', `Dependency analysis failed: ${dependencyResult.reason}`);
    }

    if (lintingResult.status === 'fulfilled') {
        winston.log('info', `Linting score calculated, ${lintingScore}`);
    } else {
        winston.log('error', `Linting analysis failed: ${lintingResult.reason}`);
    }
    /* If both fail, reject the promise */
    if (dependencyResult.status === 'rejected' && lintingResult.status === 'rejected') {
        throw new Error(`Dependency analysis and linting failed: ${dependencyResult.reason}, ${lintingResult.reason}`);
    }
    return Math.max(0, (lintingScore + dependencyScore) * 0.5);
}

/**
 * @function dependencyAnalysis
 * @description Perform dependency analysis on the package by creating a dummy Node.js project,
 * installing the package, and running npm audit.
 * @param {string} packagePath - The path to the cloned repository or package to install.
 * @returns {Promise<number[]>} - The number of dependencies with each vulnerability level (low, moderate, high, critical).
 */
async function dependencyAnalysis(packagePath: string): Promise<number> {
    const packageName = path.basename(packagePath).split(' ')[1];
    const tempProjectPath = path.join(process.cwd(), `temp-${packageName}`);

    return new Promise<number>((resolve, reject) => {
        // Step 1: Create a temporary directory for the dummy project
        fs.mkdir(tempProjectPath, { recursive: true }, (err) => {
            if (err) {
                return reject(new Error(`Error creating temporary directory: ${err}`));
            }

            const init = spawn('npm', ['init', '-y'], { cwd: tempProjectPath });

            init.on('close', (code) => {
                if (code !== 0) {
                    return reject(new Error(`Error initializing npm project: ${code}`));
                }

                const install = spawn('npm', ['install', packageName], { cwd: tempProjectPath });

                install.on('stderr', (data) => {
                    winston.log('debug', `npm install stderr: ${data}`);
                });

                install.on('close', (code) => {
                    if (code !== 0) {
                        return reject(new Error(`Error installing package: ${code}`));
                    }

                    const audit = spawn('npm', ['audit', '--json'], { cwd: tempProjectPath });
                    let jsonFromAudit = '';

                    audit.stdout.on('data', (data) => {
                        jsonFromAudit += data;
                    });

                    audit.on('close', () => {
                        try {
                            const auditData = JSON.parse(jsonFromAudit);
                            const vulnerabilitiesJson = auditData.metadata.vulnerabilities;
                            winston.log('debug', `Vulnerabilities found: ${JSON.stringify(vulnerabilitiesJson)}`);
                            const levels = ['low', 'moderate', 'high', 'critical'];
                            const vulnerabilities = levels.map(level => vulnerabilitiesJson[level] || 0);
                            winston.log('debug', `Vulnerabilities: ${vulnerabilities}`);

                            const auditScore = 1 - vulnerabilities.reduce((acc, curr, idx) => acc + (curr * (0.02 + idx / 50)), 0);
                            resolve(Math.max(auditScore, 0));
                        } catch (error) {
                            reject(new Error(`Error parsing npm audit JSON: ${error}`));
                        }
                    });
                });
            });
        });
    });
}

/**
 * @function linting
 * @description Perform linting on the package, using ESLint.
 * @param {string} packagePath - The path to the cloned repository.
 * @returns {number} - The score for linting, based on the number of linter errors.
 */
async function linting(packagePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
        /* Create a new ESLint instance - see eslint_package.config.mjs for linter configuration */
        const eslint = new ESLint({
            overrideConfigFile: ESLINT_CONFIG,
            allowInlineConfig: true,
            globInputPaths: true,
            ignore: true,
        });
        /* Look for all js and ts files in the package */
        const pattern = path.join(packagePath, '**/*.{js,ts}');

        /* Run the linter and sum the error counts */
        eslint.lintFiles(pattern).then((results) => {
            winston.log('debug', `Linting results: ${JSON.stringify(results)}`);
            const errorCount = results.reduce((acc, curr) => acc + curr.errorCount, 0);
            const filesLinted = results.length;
            const lintScore = 1 - (errorCount / filesLinted / 10);
            resolve(Math.max(lintScore, 0));
        }).catch((error: unknown) => {
            reject(new Error(`${error}`));
        });
    });
}

/**
 * @function RampUp
 * @description Calculates the ramp-up time based on the presence of documentation and code comments.
 * @param {string} packageUrl - The GitHub repository URL.
 * @param {string} packagePath - The path to the cloned repository.
 * @returns {Promise<number>} - The score for ramp-up time between 0 and 1.
 */
async function RampUp(packageUrl: string, packagePath: string): Promise<number> {
    /* Analyze README, can either make readmeScore 0 if there's error or simply throw an error and skip the RampUp function */
    const readmePath = findReadmeFile(packagePath);
    let readmeScore = 0;
    if (readmePath) {
        try {
            const readmeContent = fs.readFileSync(readmePath, 'utf-8');
            readmeScore = readmeContent.length > 1500 ? 1 : (readmeContent.length > 1000 ? 0.75 : (readmeContent.length > 500 ? 0.5 : 0.25));
        } catch (error) {
            readmeScore = 0;
        }
    } else {
        readmeScore = 0;
    }


    /* Analyze code comments */
    const codeFiles = getAllCodeFiles(packagePath); // Function to get all relevant code files
    const { commentLines, totalLines } = analyzeCodeComments(codeFiles);

    /* Calculate comment density score (assuming >10% comment lines is a good ratio) */
    const commentDensity = commentLines / totalLines;
    const commentScore = commentDensity > 0.2 ? 1 : (commentDensity > 0.15 ? 0.75 : (commentDensity > 0.1 ? 0.5 : 0.25));

    /* Combine the scores (adjust weights as necessary) */
    const rampUpScore = 0.5 * readmeScore + 0.5 * commentScore;
    return Promise.resolve(rampUpScore);
}

/**
 * @function findReadmeFile
 * @description Recursively searches for a README file in the repository, skipping symbolic links.
 * @param {string} dir - The directory to start the search from.
 * @returns {string | null} - The path to the README file, or null if not found.
 */
function findReadmeFile(dir: string): string | null {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.lstatSync(fullPath);

        if (stat.isSymbolicLink()) {
            // Skip symbolic links to avoid loops
            continue;
        }

        if (stat.isDirectory()) {
            const found = findReadmeFile(fullPath);
            if (found) return found;
        } else if (file.toLowerCase().startsWith('readme')) {
            return fullPath;
        }
    }

    return null;
}

/**
 * @function getAllCodeFiles
 * @description Recursively finds all relevant code files in a directory (e.g., .js, .ts files), skipping symlinks.
 * @param {string} dir - The directory to search for code files.
 * @returns {string[]} - A list of file paths.
 */
function getAllCodeFiles(dir: string): string[] {
    let codeFiles: string[] = [];

    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.lstatSync(fullPath);

        if (stat.isSymbolicLink()) {
            continue;
        }

        if (stat.isDirectory()) {
            codeFiles = codeFiles.concat(getAllCodeFiles(fullPath)); // Recursive search in subdirectories
        } else if (file.endsWith('.ts') || file.endsWith('.js')) {
            codeFiles.push(fullPath);
        }
    }

    return codeFiles;
}

/**
 * @function analyzeCodeComments
 * @description Analyzes the number of comment lines and total lines of code in the given files.
 * @param {string[]} files - List of code file paths.
 * @returns {{commentLines: number, totalLines: number}} - The number of comment lines and total lines of code.
 */
function analyzeCodeComments(files: string[]): { commentLines: number, totalLines: number } {
    let commentLines = 0;
    let totalLines = 0;

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        totalLines += lines.length;
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
                commentLines++;
            }
        }
    }

    return { commentLines, totalLines };
}

/**
 * @function License
 * @description A metric that calculates if the package has a conforming LGPLv2.1 License
 * @param {string} packageUrl - The GitHub repository URL.
 * @param {string} packagePath - (Not used here, but required for type compatibility).
 * @returns {Promise<number>} - The score for license, calculated as int(isCompatible(License, LGPLv2.1))
 */

async function License(packageUrl: string, packagePath: string): Promise<number> {

    let score = 0;

    const[owner, packageName] = getOwnerAndPackageName(packageUrl);
    winston.log('debug', "owner: " + owner + " packageName: " + packageName);

    try {
        winston.log('info', "Trying to get license from GitHub API");

        if (GITHUB_TOKEN == '') throw new Error('No GitHub token specified');

        const url = `https://api.github.com/repos/${owner}/${packageName}/license`;
        winston.log('debug', "GitHub License API url: " + url);

        const response = await axios.get(url, {
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${GITHUB_TOKEN}`,
            }
        });

        winston.log('debug', "response: " + JSON.stringify(response.data));

        if (response.data.license?.spdx_id == 'LGPL-2.1' || response.data.license?.spdx_id == 'LGPL-2.1-only' || response.data.license?.spdx_id == 'MIT') {
            winston.log('info', "Got license from GitHub API");
            score = 1;
            winston.log('debug', "github api success, score: " + score.toString());
        }
    }
    catch (error) {
        winston.log('debug', "github api fail, calling license_file_runner");
        score = await license_file_runner(owner, packageName);
        if (score == 0 && error instanceof Error) {
            winston.log('debug', "license_file_runner fail, score: " + score.toString());
        } else if (score == 0) {
            winston.log('debug', "license_file_runner fail, score: " + score.toString());
        }
        winston.log('debug', "returning score: " + score.toString());
        return score;
    }
    if(score == 0) {
        winston.log('debug', "github api success but no results, calling license_file_runner");
        score = await license_file_runner(owner, packageName);
    }
    winston.log('debug', "returning score: " + score.toString());
    return score;
}

/**
 * @function license_file_runner
 * @description A function that runs the license metric through the package.json, README.md, and LICENSE files.
 * @param {string} owner - repository owner
 * @param {string} packageName - name of the package
 * @returns {Promise<number>} - the license score
 */

async function license_file_runner(owner: string, packageName: string): Promise<number> {
    let score = 0;
    winston.log('info', "Trying to get license from package.json");
    winston.log('debug', "passing package.json to license_thru_files");
    score = await license_thru_files(owner, packageName, 'package.json')
    if (score == 0) {
        winston.log('info', "Trying to get license from README.md");
        winston.log('debug', "passing README.md to license_thru_files");
        score = await license_thru_files(owner, packageName, 'README.md');
    }
    if (score == 0) {
        winston.log('info', "Trying to get license from LICENSE");
        winston.log('debug', "passing LICENSE to license_thru_files");
        score = await license_thru_files(owner, packageName, 'LICENSE');
    }

    winston.log('debug', "returning license_file_runner score to license: " + score.toString());
    return score;
}

/**
 * @function license_thru_files
 * @description A function that calculates the license score by reading the package.json, README.md, and LICENSE files.
 * @param {string} owner - the repository owner
 * @param {string} packageName - the name of the package
 * @param {string} filepath - the file to read the license from
 * @returns {Promise<number>} - the license score
 */
async function license_thru_files(owner: string, packageName: string, filepath: string): Promise<number> {
    let score = 0;
    try {
        const url = `https://api.github.com/repos/${owner}/${packageName}/contents/${filepath}`;
        winston.log('debug', "GitHub File Content API url: " + url);
        const response = await axios.get(url, {
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${GITHUB_TOKEN}`,
            }
        });
        winston.log('debug', "response: " + JSON.stringify(response.data));

        const result = atob(response.data.content);
        winston.log('debug', "result/file content: " + result);

        if (filepath == 'package.json') {
            winston.log('debug', "parsing package.json content: " + result);
            const json_result = JSON.parse(result);
            if (json_result.license == "MIT" || json_result.license == "LGPL-2.1" || json_result.license == "LGPL-2.1-only") {
                score = 1;
                winston.log('debug', "license found in package.json, score: " + score.toString());
            }
        }
        if (filepath == 'README.md') {
            winston.log('debug', "parsing README.md content: " + result);
            if (result.includes('MIT License') || result.includes('MIT license') || result.includes('LGPL-2.1 License')) {
                score = 1;
                winston.log('debug', "license found in README.md, score: " + score.toString());
            }
        }
        if (filepath == 'LICENSE') {
            winston.log('debug', "parsing LICENSE content: " + result);
            if (result.includes('MIT License') || result.includes('MIT license') || result.includes('LGPL-2.1 License')) {
                score = 1;
                winston.log('debug', "license found in LICENSE, score: " + score.toString());
            }
        }
    }
    catch (error) {
        winston.log('debug', "api GET to get file content failed, error: " + error);
        winston.log('debug', "returning license_thru_files score to license_file_runner: " + score.toString());
        return score;
    }
    winston.log('debug', "returning license_thru_files score to license_file_runner: " + score.toString());
    return score;
}

if (!threading.isMainThread) {
    const { metricIndex, url, path } = threading.workerData as { metricIndex: number, url: string, path: string };
    const metric = metrics[metricIndex];
    threading.parentPort?.once('message', (childPort: {hereIsYourPort: threading.MessagePort}) => {
        metricsRunner(metric, url, path).then((metricResult) => {
            childPort.hereIsYourPort.postMessage({ metricName: metric.name, result: metricResult });
            childPort.hereIsYourPort.close();
        }).catch((error: unknown) => {
            childPort.hereIsYourPort.postMessage({ metricName: metric.name, result: [-1, -1] });
            childPort.hereIsYourPort.close();
        });
    });
}

export { computeMetrics, Correctness, linting, dependencyAnalysis, RampUp, License, BusFactor, ResponsiveMaintainer, license_thru_files, countIssue };
