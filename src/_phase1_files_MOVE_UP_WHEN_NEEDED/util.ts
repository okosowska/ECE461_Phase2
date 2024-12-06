/**
 * @function handleOutput
 * @description Handles the output of the result, error message, or log file. At least one of the message/errorMessage must be specified.
 * @param {string} message - Optional message to log.
 * @param {string} errorMessage - Optional error message to log.
 * @param {number} endpoint - Display endpoint for output (0: console, 1: log file).
 */
export function handleOutput(message = '', errorMessage = '', endpoint = 0): void {
    switch(endpoint) { 
        case 0: { 
            if (message != '') console.log(message);
            if (errorMessage != '') console.error(errorMessage);
            break; 
        } 
        case 1: { 
            break;   
        } 
        default: { 
            if (message != '') console.log(message);
            if (errorMessage != '') console.error(new Error(errorMessage));
            break; 
        } 
     } 
}

/**
 * @function getOwnerAndPackageName
 * @description A function that extracts owner and packageName from a valid github repo url
 * @param {string} packageUrl - The GitHub repository url(string).
 * @returns {[string, string]} - [Owner, packageName]
 */
export function getOwnerAndPackageName(packageUrl: string): [string, string]{
    const pathSegments = packageUrl.split('/').filter(Boolean);
    const owner = pathSegments[pathSegments.length-2];
    const packageName = pathSegments[pathSegments.length-1].replace('.git', '');
    return [owner, packageName];
}