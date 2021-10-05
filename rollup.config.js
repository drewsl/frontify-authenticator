import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';

const name = require('./package.json').main.replace('.umd.js', '');

const bundle = (config) => ({
    ...config,
    input: 'src/index.ts',
    external: (id) => !/^[./]/.test(id),
});

export default [
    bundle({
        plugins: [
            // commonjs(),
            esbuild({
                minify: process.env.NODE_ENV === 'production',
            }),
        ],
        output: [
            {
                file: `${name}.umd.js`,
                format: 'umd',
                name: 'FrontifyAuthenticator',
                sourcemap: true,
            },
            {
                file: `${name}.es.js`,
                format: 'es',
                sourcemap: true,
            },
            {
                file: `${name}.js`,
                format: 'iife',
                name: 'FrontifyAuthenticator',
                sourcemap: true,
            },
        ],
    }),
    bundle({
        plugins: [dts()],
        output: {
            file: `${name}.d.ts`,
            format: 'es',
        },
    }),
];
