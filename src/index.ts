import serverlessExpress from 'aws-serverless-express';
import app from './app';
import * as path from 'path';
import * as fs from 'fs';

// Define the directory path
const CLONED_REPOS_PATH = path.join('/tmp', 'cloned_repo');

// Create the directory at container startup
(async () => {
  try {
    await fs.promises.mkdir(CLONED_REPOS_PATH, { recursive: true });
    console.log(`Directory created at startup: ${CLONED_REPOS_PATH}`);
  } catch (error) {
    console.error(`Failed to create directory at startup: ${CLONED_REPOS_PATH}`, error);
  }
})();

const server = serverlessExpress.createServer(app);

export const lambdaHandler = (event: any, context: any) => {
    return serverlessExpress.proxy(server, event, context);
};