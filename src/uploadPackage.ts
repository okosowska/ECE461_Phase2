import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Read File In
async function uploadPackage(filePath: string) {
    try {
        const fileBuffer = fs.readFileSync(filePath);

        const base64File = fileBuffer.toString('base64');

        const filename = path.basename(filePath);

        const response = await axios.post('https://325oxpzvpa.execute-api.us-east-2.amazonaws.com/prod/upload', {
            body: {
                filename: filename,
                file: base64File
            }
        });

        console.log('Upload successful:', response.data);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Error response from API:', error.response?.data)
        } else if (error instanceof Error) {
            console.error('An error occurred:', error.message);
        } else {
            console.error('Unexpected error:', error);
        }
    }
}

uploadPackage(path.join(__dirname, 'test-package.zip'));