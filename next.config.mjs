/** @type {import('next').NextConfig} */

const nextConfig = {
    trailingSlash: true,
    reactStrictMode: false, // Disable React Strict Mode to prevent double rendering of components

    // 2. 移除生产环境的 Console：减少包体积和运行时开销
    compiler: {
        // removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
        // removeConsole: process.env.NODE_ENV === 'production',
    },

    // 自动按需引入，极大地减少首屏 JS 负担 
    experimental: {
        optimizePackageImports: ['numeric', 'three'],
    },

};

export default nextConfig;
