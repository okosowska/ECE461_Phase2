import * as fs from 'fs';
import * as readline from 'readline';
import simpleGit from 'simple-git';
import axios from 'axios';
import { URL } from 'url';
import { handleOutput } from './util';
import { computeMetrics } from './metrics';
import * as winston from 'winston';
import * as dotenv from 'dotenv';

dotenv.config();
const log_levels = ['warn', 'info', 'debug'];
const LOG_LEVEL: number = parseInt(process.env.LOG_LEVEL ?? '0', 10);
const LOG_FILE = process.env.LOG_FILE;

if (typeof LOG_FILE === 'string' && fs.existsSync(LOG_FILE)) {
    fs.rmSync(LOG_FILE);
}

winston.configure({
    level: log_levels[LOG_LEVEL],
    transports: [
        new winston.transports.File({ filename: LOG_FILE }),
    ]
});
winston.remove(winston.transports.Console);

/**
 * @function readURLFile
 * @description Reads a file line by line and extracts the URLs.
 * @param {string} filePath - The path to the file containing URLs.
 * @returns {Promise<string[]>} - A promise that resolves to an array of URLs.
 */
async function readURLFile(filePath: string): Promise<string[]> {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const urls: string[] = [];
    for await (const line of rl) {
        if (line.trim()) {
            urls.push(line);
        }
    }
    return urls;
}

/**
 * @function classifyAndConvertURL
 * @description Classifies an URL as either GitHub or npm, and if npm, converts it to a GitHub URL if possible.
 * @param {string} urlString - The URL to classify.
 * @returns {Promise<URL | null>} - A promise that resolves to a GitHub URL if found, or null if not.
 */
async function classifyAndConvertURL(urlString: string): Promise<URL | null> {
    try {
        const parsedUrl = new URL(urlString);

        if (parsedUrl.hostname === 'github.com') {
            return parsedUrl;
        }
        else if (parsedUrl.hostname === 'www.npmjs.com') {
            const packageName = parsedUrl.pathname.split('/').pop();
            if (!packageName) {
                // handleOutput('', `Invalid npm URL: ${urlString}`);
                return null;
            }

            try {
                const response = await axios.get(`https://registry.npmjs.org/${packageName}`);
                const repoUrl = response.data.repository?.url;

                if (repoUrl && repoUrl.includes('github.com')) {
                    const githubUrl = new URL(repoUrl.replace(/^git\+/, '').replace(/\.git$/, '').replace('ssh://git@github.com/', 'https://github.com/'));
                    githubUrl.pathname += '.git';
                    // handleOutput(`npm converted to GitHub URL: ${githubUrl.toString()}`, '');
                    return githubUrl;
                } else {
                    // handleOutput('', `No GitHub repository found for npm package: ${packageName}`);
                }
            } catch (error) {
                // handleOutput('', `Failed to retrieve npm package data: ${packageName}\nError message: ${error}`);
            }
        } else {
            // handleOutput('', `Unknown URL type: ${urlString}, neither GitHub nor npm`);
        }
    } catch (error) {
        // handleOutput('', `Failed to parse the URL: ${urlString}\nError message : ${error}`);
    }
    return null;
}

/**
 * @function cloneRepo
 * @description Clones a GitHub repository.
 * @param {string} githubUrl - The string url of the GitHub repository. It cannot clone from URL object.
 * @param {string} targetDir - The directory where the repo should be cloned.
 * @returns {Promise<void>}
 */
async function cloneRepo(githubUrl: string, targetDir: string): Promise<void>  {
    const git = simpleGit();
    // await handleOutput(`Cloning GitHub repo: ${githubUrl}`, '');
    try {
        await git.clone(githubUrl, targetDir, ["--depth", "1"]);
        // await handleOutput(`Cloned ${githubUrl} successfully.\n`, '');
    } catch (error) {
        throw new Error(`Failed to clone ${githubUrl}\nError message : ${error}`);
    }
}

/**
 * @function processURLs
 * @description Processes the URLs from a file, classifying and converting npm URLs to GitHub, and cloning repos.
 * @param {string} filePath - The path to the file containing URLs.
 * @returns {Promise<void>}
*/
async function processURLs(filePath: string): Promise<void> {
    try {
        const urls = await readURLFile(filePath);
        let i = 1;
        for (const url of urls) {
            const githubUrl = await classifyAndConvertURL(url);
            if (githubUrl)
            {
                const pathSegments = githubUrl.pathname.split('/').filter(Boolean);
                if (pathSegments.length != 2) await handleOutput('', `Not a repo url : ${pathSegments.toString()}`);
                const owner = pathSegments[0];
                const packageName = pathSegments[1].replace('.git', '');
                try{
                    await cloneRepo(githubUrl.toString(), `./cloned_repos/${owner} ${packageName}`);
                    await computeMetrics(githubUrl.toString(), `./cloned_repos/${owner} ${packageName}`)
                            .then(async result=>{
                                const resultObj = result as Record<string, unknown>; 
                                for (const [key, value] of Object.entries(resultObj)) {
                                    if (typeof value === 'number' && value % 1 !== 0) {
                                        resultObj[key] = Math.round(value * 1000) / 1000;
                                    }
                                }
                                await handleOutput(JSON.stringify(resultObj), '');
                            })
                            .catch(async (error: unknown)=>{
                                await handleOutput('', `Error computing metrics\nError message : ${error}`);
                            })
                }
                catch(error){
                    await handleOutput('', `Error handling url ${githubUrl}\nError message : ${error}`);
                }
            }
            else
            {
                await handleOutput('', 'GitHub URL is null.');
            }
        }
    } catch (error) {
        await handleOutput('', `Error processing the URL file\nError message : ${error}`);
    }
}

/**
 * @function processURL
 * @description Processes a single URL, classifying and converting npm URLs to GitHub, and cloning repos.
 * @param {string} url - The URL to process.
 * @returns {Promise<void>}
 */
async function processURL(url: string): Promise<Record<string, unknown> | null> {
    try {
        const githubUrl = await classifyAndConvertURL(url);
        if (githubUrl) {
            const pathSegments = githubUrl.pathname.split('/').filter(Boolean);
            if (pathSegments.length !== 2) {
                await handleOutput('', `Not a repo URL: ${pathSegments.toString()}`);
                return null;
            }
            const owner = pathSegments[0];
            const packageName = pathSegments[1].replace('.git', '');
            
            try {
                // await cloneRepo(githubUrl.toString(), `./cloned_repos/${owner} ${packageName}`);
                // await computeMetrics(githubUrl.toString(), `./cloned_repos/${owner} ${packageName}`)
                //     .then(async result => {
                //         const resultObj = result as Record<string, unknown>;
                //         for (const [key, value] of Object.entries(resultObj)) {
                //             if (typeof value === 'number' && value % 1 !== 0) {
                //                 resultObj[key] = Math.round(value * 1000) / 1000;
                //             }
                //         }
                //         await handleOutput(JSON.stringify(resultObj), '');
                //         console.log('processURL.ts: ', resultObj);
                //         return resultObj;
                //     })
                //     .catch(async (error: unknown) => {
                //         await handleOutput('', `Error computing metrics\nError message: ${error}`);
                //         return null;
                //     });
                await cloneRepo(githubUrl.toString(), `./cloned_repos/${owner} ${packageName}`);
                const result = await computeMetrics(githubUrl.toString(), `./cloned_repos/${owner} ${packageName}`);
                
                const resultObj = result as Record<string, unknown>;
                for (const [key, value] of Object.entries(resultObj)) {
                    if (typeof value === 'number' && value % 1 !== 0) {
                        resultObj[key] = Math.round(value * 1000) / 1000;
                    }
                }

                // Ensure returning result to the caller
                await handleOutput(JSON.stringify(resultObj), '');
                return resultObj;
            } catch (error) {
                await handleOutput('', `Error handling URL ${githubUrl}\nError message: ${(error as Error).message}`);
                return null;
            }
        } else {
            await handleOutput('', 'GitHub URL is null.');
            return null;
        }
    } catch (error) {
        await handleOutput('', `Error processing the URL\nError message: ${(error as Error).message}`);
        return null;
    }
    console.log('You shouldnt be here');
    return null;
};

/**
 * Lambda-compatible handler
 * Checks for either a 'filePath' (to use processURLs) or 'url' (to use processURL) parameter.
 * @param {object} event - The Lambda event object.
 * @param {object} context - The Lambda context object (not used here).
 * @returns {Promise<object>} - The response object for Lambda.
 */
async function handler(event: { filePath?: string, url?: string }, context: any): Promise<object> {
    if (event.filePath) {
        try {
            await processURLs(event.filePath);
            return { statusCode: 200, body: 'Finished processing URLs from file.' };
        } catch (error) {
            const err = error as Error;
            winston.log('debug', `Error processing URLs from file: ${err.message}`);
            return { statusCode: 500, body: `Error processing URLs from file: ${err.message}` };
        }
    } else if (event.url) {
        try {
            await processURL(event.url);
            return { statusCode: 200, body: `Finished processing URL: ${event.url}` };
        } catch (error) {
            const err = error as Error;
            winston.log('debug', `Error processing URL: ${err.message}`);
            return { statusCode: 500, body: `Error processing URL: ${err.message}` };
        }
    } else {
        return { statusCode: 400, body: 'No filePath or url provided in the event.' };
    }
};

/* Entry point */
if (require.main === module) {
    const filePath = process.argv[2];
    if (!filePath) {
        winston.log('debug', 'No file path given. Please provide a URL file path as an argument.');
        process.exit(1);
    }

    processURLs(filePath)
    .then(async () => {
        winston.log('info', 'Finished processing URLs.');
    })
    .catch(async (error) => {
        winston.log('debug', 'Error processing URLs: ${error}');
        process.exit(1);
    })
    .finally(() => {
        const cloned_repos = 'cloned_repos';
        fs.promises.rm(cloned_repos, { recursive: true, force: true }) // Deletes the directory and its contents
            .then(() => {
                winston.log('info', 'Deleted cloned repositories directory: ${cloned_repos}');
            })
            .catch((error) => {
                winston.log('debug', 'Failed to delete cloned_repos directory: ${error}');
            });
    });
}

// export default processURLs;
export { processURL };
// module.exports = {handler, readURLFile, classifyAndConvertURL, cloneRepo, processURLs}