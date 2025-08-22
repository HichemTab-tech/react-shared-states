import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
    root: 'demo', // Set the root directory to the demo folder
    build: {
        outDir: resolve(__dirname, 'dist-demo'), // Output for the demo build (optional)
    },
    resolve: {
        alias: {
            // Allow your demo to resolve your library directly
            '%PACKAGE-NAME%': resolve(__dirname, '../src'),
        },
    },
    server: {
        port: 5021
    },
    plugins: [
        react(),
        tailwindcss(),
    ],
});