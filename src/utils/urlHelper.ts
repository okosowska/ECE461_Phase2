import axios from 'axios';
import * as jszip from 'jszip';

export const fetchPackageFromUrl = async (url: string): Promise<{ content: string; version?: string }> => {
    try {
        let zipUrl: string | null = null;

        if (url.includes('github.com')) {
            // Extract owner and repo name from URL
            const [, owner, repo] = url.match(/github\.com\/([^/]+)\/([^/]+)/) || [];
            if (!owner || !repo) {
                throw new Error('Invalid GitHub URL');
            }

            // Use GitHub API to fetch the default branch
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
            const apiResponse = await axios.get(apiUrl, {
                headers: {
                    Accept: 'application/vnd.github.v3+json',
                },
            });
            const defaultBranch = apiResponse.data.default_branch || 'main';

            // Construct the ZIP download URL
            zipUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${defaultBranch}`;
        } else if (url.includes('npmjs.com')) {
            const packageName = url.split('/').pop();
            const npmResponse = await axios.get(`https://registry.npmjs.org/${packageName}`);
            zipUrl = npmResponse.data?.dist?.tarball || null;
        }

        if (!zipUrl) {
            throw new Error('Unsupported URL format. Only GitHub or npm URLs are supported.');
        }

        // Download the ZIP file
        const response = await axios.get(zipUrl, { responseType: 'arraybuffer' });

        // Load the ZIP file
        const zip = await jszip.loadAsync(response.data);

        // Attempt to find the version in package.json
        let version;
        if (zip.files['package.json']) {
            const packageJson = JSON.parse(await zip.files['package.json'].async('string'));
            version = packageJson.version;
        }

        // Base64 encode the zip content
        const content = Buffer.from(response.data).toString('base64');

        return { content, version };
    } catch (error) {
        console.error('Error fetching package from URL:', error);
        throw new Error('Failed to fetch package from URL');
    }
};
