import processURLs from './processUrls';

console.log('Running test_processURLs.ts');
const filePath = 'src/test_input.txt';

try {
    processURLs(filePath);
} 
catch (error) {
    console.error('Error running test_processUrls.ts:', error);
}