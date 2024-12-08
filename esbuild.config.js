const esbuild = require('esbuild');

esbuild.build({
    entryPoints: ['./src/index.ts'],
    outfile: './index.js',
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    external: ['aws-sdk'],
    minify: true,
    sourcemap: true,
}).catch(() => process.exit(1));