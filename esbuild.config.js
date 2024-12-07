const esbuild = require('esbuild');

esbuild.build({
    entryPoints: ['./src/index.ts'],
    outfile: './dist/index.js',
    bundle: true,
    platform: 'node',
    target: 'node18',
    external: ['aws-sdk'],
    minify: true,
    sourcemap: true,
}).catch(() => process.exit(1));