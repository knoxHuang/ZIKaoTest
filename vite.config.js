import { defineConfig } from 'vite'

export default defineConfig({
    base: './', // 确保在 GitHub Pages 的二级目录下也能正确加载资源
    build: {
        outDir: 'dist',
    }
})
