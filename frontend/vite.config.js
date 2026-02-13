import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    return {
        base: '/',
        plugins: [react()],
        define: {
            'import.meta.env.VITE_API_BASE': JSON.stringify(env.VITE_API_BASE || process.env.VITE_DEV_BACKEND || 'http://127.0.0.1:8300')
        },
        resolve: {
            alias: {
                'services/api': path.resolve(__dirname, '../services/api.js')
            }
        },
        server: {
            port: 5173,
            strictPort: true,
            host: true,
            proxy: {
                '/api': {
                    target: env.VITE_API_BASE || process.env.VITE_DEV_BACKEND || 'http://127.0.0.1:8300',
                    changeOrigin: true
                },
                '/public': {
                    target: env.VITE_API_BASE || process.env.VITE_DEV_BACKEND || 'http://127.0.0.1:8300',
                    changeOrigin: true
                }
            },
            fs: {
                strict: true,
                allow: [
                    path.resolve(__dirname),
                    path.resolve(__dirname, '..')
                ]
            }
        },
        preview: {
            port: 5173
        },
        build: {
            outDir: 'dist',
            emptyOutDir: true,
            rollupOptions: {
                output: {
                    entryFileNames: `assets/[name]-[hash].js`,
                    chunkFileNames: `assets/[name]-[hash].js`,
                    assetFileNames: `assets/[name]-[hash].[ext]`
                }
            }
        }
    }
})
