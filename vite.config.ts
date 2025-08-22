import { defineConfig } from 'vite';
import banner from 'vite-plugin-banner';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import dts from 'vite-plugin-dts'; // Import the dts plugin
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import tailwindcss from '@tailwindcss/vite';


const bannerContent = `/*!
* %PACKAGE-NAME% v0.1.0
* (c) %AUTHOR-NAME%
* Released under the MIT License.
* Github: github.com/%GITHUB-OWNER-USERNAME%/%REPO-NAME%
*/
   `;

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'), // Library entry point
            name: 'ReactSurveyCreator',
            fileName: (format: string) => `main${format === 'es' ? '' : '.min'}.js`,
            formats: ['es', 'umd']
        },
        rollupOptions: {
            external: ['react', 'react-dom'], // Mark React, ReactDOM as external
            output: {
                globals: {
                    react: 'React',
                    'react-dom': 'ReactDOM'
                }
            }
        },
        terserOptions: {
            format: {
                comments: false
            }
        }
    },
    plugins: [
        tailwindcss(),
        react(),
        banner(bannerContent),
        cssInjectedByJsPlugin(),
        dts({
            entryRoot: 'src', // Base folder for type generation
            outDir: 'dist', // Ensures types go into `dist/`
            insertTypesEntry: true, // Adds the `types` field in package.json
            exclude: ['node_modules', 'dist'], // Exclude unnecessary files
        })

    ]
});