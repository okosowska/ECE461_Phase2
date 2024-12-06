import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import * as path from 'path';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
    	languageOptions: {
        	parserOptions: {
				project: 'tsconfig.package.json',
				tsconfigRootDir: import.meta.dirname,
        	},
			globals: {
				...globals.node,
			}
      	},
    },
    {
      	files: ['**/*.js'],
      	...tseslint.configs.disableTypeChecked,
    },
    {
        rules: {
			"@typescript-eslint/no-require-imports": "off",
		}
    },
	{
		ignores: [
			'node_modules/**',
            '**/*test*/**',
            '**/*example*/**',
            '**/*doc*/**',
            '**/*dist*/**',
            '**/*.config*.js',
            '**/*.config*.ts',
		]
	}
);