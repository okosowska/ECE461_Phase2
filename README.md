# group21-phase1

A Command-Line Interface (CLI) tool designed for analyzing URLs in text files.

## Installation

1. **Clone this repository:**
   ```bash
   git clone https://github.com/ECE46100/group21-phase1.git
2. **Install the necessary dependencies:**
   ```bash
   ./run install

## Testing
1. **Test the program**
   ```bash
   ./run test

## Analyse Urls
1. **Run analysis on a given file**
   ```bash
   ./run /path/to/your/url_file.txt
   
The tool will classify and process the URLs in the specified file, converting npm URLs to their GitHub counterparts (if available), and log any issues encountered during the analysis.

## File Format
The input file should contain one URL per line. The tool will skip empty or invalid lines and handle errors gracefully.

Example of a valid file: 
```bash
https://github.com/example/repo1
https://www.npmjs.com/package/express
invalid-url
https://github.com/example/repo2
```
## Logging
The tool logs important information using Winston:

Warnings for invalid or unknown URLs.
Information about successful conversions (e.g., npm URL to GitHub URL).
Errors for any issues during URL processing.

## Development
Running Unit Tests:
The tests are written using Jest. You can run them by using:

```bash
   npx jest /path_to_test_file.test
```
The tool uses mocks for external services such as npm registry lookups (via axios) and logging (via Winston).
